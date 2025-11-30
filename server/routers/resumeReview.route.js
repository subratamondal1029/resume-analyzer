import { Router } from "express";
import upload from "../middlewares/upload.middleware.js";
import {
  resumeReview,
  resumeReviewStatus,
} from "../controllers/resumeReview.controller.js";

const router = Router();

router
  .post("/", upload.single("file"), resumeReview)
  .get("/status/:id", resumeReviewStatus);

export default router;
