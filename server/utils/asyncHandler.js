import ApiError from "./ApiError.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    let errorResponse = err;
    if (!(err instanceof ApiError)) {
      errorResponse = new ApiError(
        err.message || "Internal Server Error",
        err.statusCode || err.status || 500
      );
    }

    res.status(errorResponse.status).json(errorResponse);
  });
};

export default asyncHandler;
