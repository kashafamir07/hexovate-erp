export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status
   * @param {string} message human readable message
   * @param {Array<{field?:string,msg:string}>} [errors] validation details
   */
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors || [];
    this.isOperational = true;
  }
}
