import { Request, Response, NextFunction } from 'express';
import ResponseFormatter from '../utils/responseFormatter.js';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  custom?: (value: any, body: Record<string, any>) => string | undefined;
}

type ValidationSchema = Record<string, ValidationRule>;

/**
 * Middleware to validate request bodies against a schema.
 * @param schema - The validation schema with field rules.
 */
const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!schema) {
      next();
      return;
    }

    const errors: string[] = [];
    const body = req.body || {};

    Object.entries(schema).forEach(([field, rules]) => {
      const value = body[field as keyof typeof body];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        return;
      }

      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.custom && typeof rules.custom === 'function') {
        const customErr = rules.custom(value, body);
        if (customErr) errors.push(customErr);
      }
    });

    if (errors.length) {
      res.status(400).json(ResponseFormatter.error('Validation failed', 400, errors));
      return;
    }

    next();
  };
};

export default validate;
