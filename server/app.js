import express from "express";
import cors from "cors";
import pdfAnalyzeRouter from "./routers/pdfAnalyze.route.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api/pdf-analyze", pdfAnalyzeRouter);

export default app;
