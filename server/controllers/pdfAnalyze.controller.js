import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  progresses,
  createProgress,
  updateProgress,
} from "../state/progress.js";

const pdfAnalyze = asyncHandler(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  const analysisId = Date.now().toString();
  createProgress(analysisId);

  console.log(`Analyzing PDF file: ${file.originalname}`);

  // Simulate analysis progress (replace with your actual analysis logic)
  setTimeout(() => updateProgress(analysisId, "Reading document...", 30), 1000);
  setTimeout(() => updateProgress(analysisId, "Extracting text...", 60), 2000);
  setTimeout(
    () => updateProgress(analysisId, "Analyzing content...", 90),
    3000
  );
  setTimeout(
    () =>
      updateProgress(analysisId, "Complete!", 100, {
        status: "pass",
        rule: "Document must mention a date.",
        evidence: "Found in page 1: 'Published 2024'",
        reasoning: "Document includes a publication year.",
        confidence: 92,
      }),
    4000
  );

  res.json(
    new ApiResponse(200, "PDF analysis started", {
      fileName: file.originalname,
      analysisId,
    })
  );
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
