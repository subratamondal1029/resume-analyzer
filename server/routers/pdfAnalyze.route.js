import { Router } from "express";
import upload from "../middlewares/upload.middleware.js";
import {
  pdfAnalyze,
  pdfAnalyzeStatus,
} from "../controllers/pdfAnalyze.controller.js";

const router = Router();

router
  .post("/", upload.single("file"), pdfAnalyze)
  .get("/status/:id", pdfAnalyzeStatus);

export default router;
