import ApiError from "./ApiError.js";
import { ApiError as GoogleApiError } from "@google/genai";
import multer from "multer";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    let errorResponse = err;

    if (err instanceof multer.MulterError) {
      // Handle Multer-specific errors
      if (err.code === "LIMIT_FILE_SIZE") {
        errorResponse = new ApiError(400, "File size exceeds limit of 5MB!");
      } else if (err.code === "LIMIT_FILE_COUNT") {
        errorResponse = new ApiError(400, "Too many files uploaded!");
      } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
        errorResponse = new ApiError(400, "Unexpected field in file upload!");
      } else {
        errorResponse = new ApiError(400, err.message || "File upload error!");
      }
    } else if (err instanceof GoogleApiError) {
      const error = JSON.parse(err.message)?.error;

      if (error) {
        errorResponse = new ApiError(error.code, error.message);
      } else {
        errorResponse = new ApiError(500, "Unknown error from Google GenAI");
      }
    } else if (!(err instanceof ApiError)) {
      errorResponse = new ApiError(
        err.statusCode || err.status || 500,
        err.message || "Internal Server Error"
      );
    }

    res.status(errorResponse.status).json(errorResponse);
  });
};

export default asyncHandler;
