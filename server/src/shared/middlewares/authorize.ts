import { Request, Response, NextFunction } from 'express';
import ResponseFormatter from '../utils/responseFormatter.js';

/**
 * Middleware to authorize requests based on user roles.
 * @param allowedRoles - The roles allowed to access the route.
 * @returns Middleware function that checks user role against allowed roles.
 */
const authorize = (allowedRoles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user || !(req.user as any).role) {
        res.status(403).json(ResponseFormatter.error('Forbidden', 403));
        return;
      }

      // Skip if no roles specified
      if (allowedRoles.length === 0) {
        next();
        return;
      }

      if (!allowedRoles.includes((req.user as any).role)) {
        res.status(403).json(ResponseFormatter.error('Insufficient permissions', 403));
        return;
      }

      next();
    } catch (error) {
      res.status(403).json(ResponseFormatter.error('Forbidden', 403));
    }
  };
};

export default authorize;
