import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

/**
 * Request logger middleware - centralizes request logging.
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `HTTP ${req.method} ${req.originalUrl || req.url} ${req.ip || req.socket.remoteAddress} ${duration}ms`,
      {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        duration,
      }
    );
  });

  next();
};

export default requestLogger;
