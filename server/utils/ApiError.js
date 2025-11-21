class ApiError extends Error {
  constructor(status = 500, message = "Internal Server Error", stack = "") {
    super(message);
    this.status = status;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    this.data = null;
    this.success = false;
    this.message = message;
  }

  toJSON() {
    return {
      status: this.status,
      message: this.message,
      data: this.data,
      success: this.success,
    };
  }
}

export default ApiError;
