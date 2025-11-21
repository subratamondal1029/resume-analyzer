import fs from "fs/promises";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import axios from "axios";
import FormData from "form-data";
import { GoogleGenAI, ApiError as GoogleApiError } from "@google/genai";
dotenv.config({ path: "./server/.env" });
import ApiError from "./utils/ApiError.js";
const ocrApiUrl = process.env.TESSERACT_API;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1) Extract text from full PDF
export async function extractTextFromPdf(pdfPath) {
  const buffer = await fs.readFile(pdfPath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return result.text;
}

// 2) Split PDF into pages in-memory (returns array of Uint8Array for each page)
export async function splitPdfPages(pdfPath) {
  const bytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pageCount = pdfDoc.getPageCount();
  const pageBuffers = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copied] = await newDoc.copyPages(pdfDoc, [i]);
    newDoc.addPage(copied);
    const newBytes = await newDoc.save();
    pageBuffers.push(newBytes);
  }
  return pageBuffers;
}

// 3) For each PDF page buffer: render to image, wrap into Blob, send to OCR API
export async function pagesToOCR(
  pdfPageBuffers,
  ocrApiUrl,
  languages = ["eng"]
) {
  const responses = [];

  for (let idx = 0; idx < pdfPageBuffers.length; idx++) {
    const pageBytes = pdfPageBuffers[idx];
    // Render page as image buffer via unpdf
    const imageArrayBuffer = await renderPageAsImage(
      new Uint8Array(pageBytes),
      1,
      { scale: 2, canvasImport: () => import("@napi-rs/canvas") }
    );
    const imageBuffer = Buffer.from(imageArrayBuffer); // convert ArrayBuffer to Buffer

    // Build form-data submission
    const form = new FormData();
    const options = { languages };
    form.append("options", JSON.stringify(options));
    form.append("file", imageBuffer, {
      filename: `page_${idx + 1}.png`,
      contentType: "image/png",
    });

    const resp = await axios.post(ocrApiUrl, form, {
      headers: form.getHeaders(),
    });
    responses.push(resp.data);
  }

  return responses;
}

async function checkRule(text, rules) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
    Below is the extracted text from document pages:
    ---DOC_START---
    ${text}
    ---DOC_END---
    RULE_TO_CHECK: ${rules}
    `,
    config: {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      temperature: 0.1,
      maxOutputTokens: 512,
      topP: 0.8,
      systemInstruction: `SYSTEM: You are a precise rule-checker. Output STRICT valid JSON only, no commentary.
      USER: Below is the extracted text from document pages:
      ---DOC_START---
      [TEXT HERE]
      ---DOC_END---
      RULE_TO_CHECK: "[<the rule here>, <the rule2 here>, <the rule3 here>]"
      INSTRUCTIONS:
      1. Decide PASS or FAIL whether the document satisfies the rule.
      2. Provide one short evidence sentence that includes page number.
      3. Provide a 1–2 sentence reasoning.
      4. Output an integer confidence 0–100 (higher = more sure).
      5. Return ONLY this exact JSON object matching schema:
        [{ "rule":"", "status":"pass|fail", "evidence":"", "reasoning":"", "confidence":0 }, ...]\n
      Return exactly one JSON array with the number of objects depend on rules and nothing else.
      `,
    },
  });

  return response.text;
}

const getText = async (filePath) => {
  try {
    let text = await extractTextFromPdf(filePath);
    console.log("Extracted Text:", text.length);

    if (text.length < parseInt(process.env.TEXT_THRESHOLD)) {
      console.log("Text too short, running OCR...");
      const pages = await splitPdfPages(filePath);

      const ocrResponses = await pagesToOCR(pages, ocrApiUrl, ["eng"]);
      text = ocrResponses.map((res) => res?.data?.stdout).join("\n");
      console.log("OCR Text length:", text.length);
    }

    const cleanedText = text.trim().replace(/\s+/g, " ");

    const llmResponse = await checkRule(cleanedText, [
      "The document must mention at least one date.",
      "The document must define at least one term.",
    ]);

    const cleanedLlmResponse = llmResponse
      .replace(/```json/, "")
      .replace(/```/, "")
      .trim();

    return JSON.parse(cleanedLlmResponse);
  } catch (error) {
    let errorResponse = error;
    if (error instanceof GoogleApiError) {
      const err = JSON.parse(error.message)?.error;

      if (err) {
        errorResponse = new ApiError(err.code, err.message);
      } else
        errorResponse = new ApiError(500, "Unknown error from Google GenAI");
    } else if (error instanceof ApiError) {
      errorResponse = error;
    } else {
      errorResponse = new ApiError(
        500,
        error.message || "Unknown error occurred"
      );
    }

    return { errorResponse };
  }
};

const filePath = process.argv[2] || "NIYAMR_Fullstack_Assignment.pdf";
console.log(await getText(filePath));
