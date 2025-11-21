import ApiError from "./ApiError.js";
import { ApiError as GoogleApiError } from "@google/genai";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    let errorResponse = err;
    if (!(err instanceof ApiError)) {
      errorResponse = new ApiError(
        err.message || "Internal Server Error",
        err.statusCode || err.status || 500
      );
    } else if (err instanceof GoogleApiError) {
      const error = JSON.parse(err.message)?.error;

      if (error) {
        errorResponse = new ApiError(error.code, error.message);
      } else
        errorResponse = new ApiError(500, "Unknown error from Google GenAI");
    }

    res.status(errorResponse.status).json(errorResponse);
  });
};

export default asyncHandler;
