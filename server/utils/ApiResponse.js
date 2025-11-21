class ApiResponse {
  constructor(status, message, data = {}) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.success = true;
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

export default ApiResponse;
