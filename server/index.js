import express from "express";
import cors from "cors";
import pdfAnalyzeRouter from "./routers/pdfAnalyze.route.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api/pdf-analyze", pdfAnalyzeRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
