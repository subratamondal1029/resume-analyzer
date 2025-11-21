import fs from "fs";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import pdfService from "../services/pdf.service.js";
import {
  progresses,
  createProgress,
  updateProgress,
  deleteProgress,
} from "../state/progress.js";

const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error("File delete failed: ", err);
  });
};

const initAsyncAnalysis = async (filePath, rules, analysisId) => {
  try {
    // get Full document Text
    updateProgress(analysisId, "Reading document...", 30);
    let extractedText = await pdfService.extractTextFromPdf(filePath);
    console.log("Extracted Text Length:", extractedText.length);

    const textLengthThreshold = parseInt(process.env.TEXT_THRESHOLD) || 100;

    if (extractedText.length < textLengthThreshold) {
      // Treat as scanned pdf
      console.log("Text too short, running OCR...");
      updateProgress(analysisId, "Extracting content using OCR...", 50);

      const pages = await pdfService.splitPdfPages(filePath);

      const ocrResponses = await pdfService.pagesToOCR(pages, ["eng"]);

      extractedText = ocrResponses.map((res) => res?.data?.stdout).join("\n");
      console.log("OCR Text Length:", extractedText.length);
    }

    updateProgress(analysisId, "Checking Rules...", 80);
    const cleanedText = extractedText.trim().replace(/\s+/g, " ");
    const llmResponse = await pdfService.checkRule(cleanedText, rules);

    updateProgress(analysisId, "Almost There...", 90);
    const cleanedLlmResponse = llmResponse
      .replace(/```json/, "")
      .replace(/```/, "")
      .trim();

    const responseData = JSON.parse(cleanedLlmResponse);
    updateProgress(analysisId, "Analyzing Completed!", 100, responseData);

    setTimeout(() => {
      deleteProgress(analysisId);
      deleteFile(filePath);
    }, 2000);
  } catch (error) {
    updateProgress(analysisId, `Error while Analyzing Document`, 100, {
      error: error.message || "something when wrong",
    });
    deleteFile(filePath);
  }
};

const pdfAnalyze = asyncHandler(async (req, res) => {
  let filePath;
  try {
    const file = req.file;
    let rules = JSON.parse(req.body.rules);

    if (!rules) throw new ApiError(400, "No rules provided");

    if (!file) {
      throw new ApiError(400, "No file uploaded");
    }

    filePath = file.path;

    const analysisId = Date.now().toString();
    createProgress(analysisId);
    console.log(`Analyzing PDF file: ${file.originalname}`);

    initAsyncAnalysis(file.path, rules, analysisId);

    res.json(
      new ApiResponse(200, "PDF analysis started", {
        fileName: file.originalname,
        analysisId,
      })
    );
  } catch (error) {
    deleteFile(filePath);
    throw error;
  }
});

const pdfAnalyzeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const progress = progresses[id];

  if (!progress) {
    throw new ApiError(404, "Analysis not found");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send current progress immediately
  res.write(
    `data: ${JSON.stringify({
      status: progress.status,
      progress: progress.progress,
    })}\n\n`
  );

  // Listen for future updates
  const onProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.progress >= 100) {
      res.end();
    }
  };

  progress.emitter.on("progress", onProgress);

  req.on("close", () => {
    progress.emitter.off("progress", onProgress);
    res.end();
  });
});

export { pdfAnalyze, pdfAnalyzeStatus };
