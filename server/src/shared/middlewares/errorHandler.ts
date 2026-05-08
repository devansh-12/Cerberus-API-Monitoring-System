import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';
import ResponseFormatter from '../utils/responseFormatter.js';

interface ErrorResponse {
  message: string;
  statusCode: number;
  errors?: string[];
}

// Global error handler middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  let statusCode = (res as any).statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors: string[] | null = (err as any).errors || null;

  logger.error('Error occurred:', {
    message: err.message,
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values((err as any).errors).map((e: any) => e.message);
  } else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate key error';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json(ResponseFormatter.error(message, statusCode, errors));
};

export default errorHandler;
