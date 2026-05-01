import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import ResponseFormatter from '../utils/responseFormatter.js';
import logger from '../config/logger.js';
import { Role } from '../constants/roles.js';

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: Role;
  clientId?: string;
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.authToken as string | undefined;

    if (!token) {
      res.status(401).json(ResponseFormatter.error('Authentication token is required', 401));
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    const err = error as Error;
    logger.error('Authentication failed', { error: err.message, path: req.path });

    if (err.name === 'TokenExpiredError') {
      res.status(401).json(ResponseFormatter.error('Token expired', 401));
      return;
    }
    res.status(401).json(ResponseFormatter.error('Invalid token', 401));
  }
};

export default authenticate;
