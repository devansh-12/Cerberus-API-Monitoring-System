/**
 * AppError — Custom operational error class with HTTP status code and optional
 * structured error list. Use this instead of raw `Error` for all domain errors.
 */
class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: string[] | null;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, errors: string[] | null = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
