// pdf_pipeline.js
import fs from 'fs';
import path from 'path';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from 'canvas';
import fetch from 'node-fetch'; // or global fetch on Node 18+
import crypto from 'crypto';

const TESSERACT_API = process.env.TESSERACT_API_URL;
const GEMINI_API = process.env.GEMINI_API_URL;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TEXT_THRESHOLD = Number(process.env.TEXT_THRESHOLD ?? 150);
const RENDER_SCALE = Number(process.env.RENDER_SCALE ?? 2);
const CONCURRENT_OCR = Number(process.env.CONCURRENT_OCR ?? 3);
const OCR_TIMEOUT_MS = 120000; // 2 minutes per OCR request

// utility: hash buffer
function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// 1) Extract text layer from a single page
async function extractTextFromPage(page) {
  const textContent = await page.getTextContent();
  const items = textContent.items || [];
  const text = items.map(it => it.str || '').join(' ');
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed;
}

// 2) Render page to PNG buffer (node-canvas)
async function renderPageToPNGBuffer(page, scale = RENDER_SCALE) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  // pdfjs rendering to node-canvas
  await page.render({ canvasContext: ctx, viewport }).promise;
  const pngBuffer = canvas.toBuffer('image/png');
  return pngBuffer;
}

// 3) Call user self-hosted Tesseract API (expects image buffer) -> returns { text, confidence? }
async function callTesseractApi(imageBuffer, filename = 'page.png') {
  // adapt headers/body depending on your API; this assumes multipart/form-data accepts file field "file"
  const form = new FormData();
  form.append('file', new Blob([imageBuffer]), filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const res = await fetch(TESSERACT_API, {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Tesseract API error ${res.status}: ${txt}`);
    }
    const json = await res.json();
    return json; // expect { text: "...", confidence: 80 } or similar
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// 4) Process whole PDF and return pages array with metadata
export async function processPdfBuffer(pdfBuffer, opts = {}) {
  // opts: { cache } - optional object with get(hash) / set(hash,value)
  const cache = opts.cache;
  const docHash = sha256hex(pdfBuffer);
  if (cache) {
    const cached = await cache.get?.(docHash);
    if (cached) return cached;
  }

  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const doc = await loadingTask.promise;
  const pagesMeta = [];

  // We'll limit concurrent OCR calls with a simple worker pool
  const ocrQueue = [];
  let activeOcr = 0;

  function enqueueOcr(task) {
    return new Promise((resolve, reject) => {
      ocrQueue.push({ task, resolve, reject });
      processQueue();
    });
  }
  async function processQueue() {
    if (activeOcr >= CONCURRENT_OCR) return;
    const item = ocrQueue.shift();
    if (!item) return;
    activeOcr++;
    try {
      const r = await item.task();
      item.resolve(r);
    } catch (e) {
      item.reject(e);
    } finally {
      activeOcr--;
      processQueue();
    }
  }

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);

    // 1) Extract text layer
    const text = await extractTextFromPage(page);
    const charCount = (text || '').replace(/\s+/g, ' ').trim().length;

    const pageObj = {
      pageNumber: i,
      charCount,
      source: null,      // 'text' | 'ocr'
      text: null,
      ocrConfidence: null,
      pageHash: null,    // optional: hash of page content
    };

    if (charCount >= TEXT_THRESHOLD) {
      pageObj.source = 'text';
      pageObj.text = text;
      pageObj.pageHash = sha256hex(Buffer.from(text || '', 'utf8'));
    } else {
      // Need OCR: render page to PNG buffer first but defer actual OCR call via queue
      const pngBuffer = await renderPageToPNGBuffer(page, RENDER_SCALE);
      pageObj.renderedImageBytes = pngBuffer.length;
      pageObj.pageHash = sha256hex(pngBuffer);

      // Enqueue OCR call (rate-limited by CONCURRENT_OCR)
      const ocrResult = await enqueueOcr(async () => {
        const res = await callTesseractApi(pngBuffer, `page-${i}.png`);
        // expected { text, confidence } from your Tesseract API
        return res;
      });

      pageObj.source = 'ocr';
      pageObj.text = (ocrResult && ocrResult.text) ? String(ocrResult.text) : '';
      pageObj.ocrConfidence = ocrResult && ocrResult.confidence ? Number(ocrResult.confidence) : null;
    }

    // keep only useful fields (drop heavy buffers)
    delete pageObj.renderedImageBytes;
    pagesMeta.push(pageObj);

    // free page
    page.cleanup?.();
  }

  await doc.destroy();

  if (cache) await cache.set?.(docHash, pagesMeta);
  return pagesMeta;
}

// 5) Build prompt and call Gemini for a single rule (strict JSON expected)
export async function callGeminiForRule(pagesMeta, ruleText) {
  // join pages into a single string with page markers
  const docJoined = pagesMeta.map(p => `Page ${p.pageNumber}:\n${(p.text || '').trim()}`).join('\n\n---PAGE---\n\n');

  const prompt = `SYSTEM: You are a strict rule-checker. Output ONLY valid JSON matching the schema, no extra text.\n\nUSER: Below is the extracted text from document pages:\n---DOC_START---\n${docJoined}\n---DOC_END---\n\nRULE_TO_CHECK: "${ruleText}"\n\nINSTRUCTIONS:\n1) Decide PASS or FAIL whether the document satisfies the rule.\n2) Provide one short evidence sentence that includes page number.\n3) Provide 1-2 sentence reasoning.\n4) Output an integer confidence 0-100.\n5) Return ONLY this exact JSON object:\n{ \"rule\":\"\", \"status\":\"pass|fail\", \"evidence\":\"\", \"reasoning\":\"\", \"confidence\":0 }\n\nReturn exactly one JSON object and nothing else.`;

  // adapt to Gemini API payload shape; this is a generic example
  const body = {
    input: prompt,
    parameters: { temperature: 0, maxOutputTokens: 400 }
  };

  const res = await fetch(GEMINI_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GEMINI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const txt = await res.text();
  // robust: extract first JSON substring
  const jsonText = extractFirstJson(txt);
  const parsed = JSON.parse(jsonText);

  // normalize
  parsed.rule = parsed.rule ?? ruleText;
  parsed.status = (parsed.status || '').toLowerCase() === 'pass' ? 'pass' : 'fail';
  parsed.confidence = Math.max(0, Math.min(100, Number(parsed.confidence || 0)));

  return parsed;
}

function extractFirstJson(s) {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in LLM response');
  return s.slice(start, end + 1);
}

