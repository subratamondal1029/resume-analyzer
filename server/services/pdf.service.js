import fs from "fs/promises";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import axios from "axios";
import FormData from "form-data";
import { GoogleGenAI, ApiError as GoogleApiError } from "@google/genai";
import ApiError from "../utils/ApiError.js";

class PDFService {
  constructor() {
    this.ocrApiUrl = process.env.TESSERACT_API;
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // 1) Extract text from full PDF
  async extractTextFromPdf(pdfPath) {
    const buffer = await fs.readFile(pdfPath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const pageCount = pdf.numPages;

    if (pageCount === 0) {
      throw new ApiError(400, "The PDF document contains no pages.");
    } else if (pageCount > 5) {
      throw new ApiError(
        400,
        "The PDF document exceeds the maximum page limit of 5 pages."
      );
    }

    const result = await extractText(pdf, { mergePages: true });
    return result.text;
  }

  // 2) Split PDF into pages in-memory (returns array of Uint8Array for each page)
  async splitPdfPages(pdfPath) {
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
  async pagesToOCR(pdfPageBuffers, languages = ["eng"]) {
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

      const resp = await axios.post(this.ocrApiUrl, form, {
        headers: form.getHeaders(),
      });
      responses.push(resp.data);
    }

    return responses;
  }

  // 4) Check document against rules using Gemini AI
  async checkRule(text, rules) {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
      Below is the extracted text from the resume:
      ---RESUME_START---
      ${text}
      ---RESUME_END---
      REVIEW_CRITERIA: ${rules}
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        temperature: 0.1,
        maxOutputTokens: 512,
        topP: 0.8,
        systemInstruction: `SYSTEM: You are an expert resume reviewer. Output STRICT valid JSON only, no commentary.
        USER: You will receive a resume and review criteria including:
        - role: The target job role/position
        - skills: Array of required skills (e.g., ["html", "javascript", "react"])
        - experience: Experience level to validate (check if projects and work experience match the level, not just years. For freshers, evaluate project quality and relevance)
        - other_details: Any additional requirements
        
        INSTRUCTIONS:
        1. Evaluate the resume comprehensively against ALL provided criteria.
        2. For experience: Don't just count years. Assess if the candidate's projects, internships, or work history demonstrate competency matching the required level. Freshers with strong relevant projects can pass.
        3. For skills: Check if the resume demonstrates the required technical skills through projects, work experience, or explicit mention.
        4. Decide PASS or FAIL based on overall fit.
        5. Provide specific evidence from the resume (mention sections, project names, or experiences).
        6. Provide concise reasoning in 2-3 sentences explaining your decision, highlighting key strengths or gaps.
        7. Output an integer confidence score 0-100 (higher = more confident in the assessment).
        
        Return ONLY this exact JSON object:
        { "status": "pass|fail", "evidence": "specific evidence from resume", "reasoning": "2-3 sentence explanation of the decision", "confidence": 0 }
        
        Return exactly one JSON object and nothing else.
        `,
      },
    });

    return response.text;
  }
}

const pdfService = new PDFService();

export default pdfService;
