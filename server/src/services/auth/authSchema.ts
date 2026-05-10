import { isValidRole } from '../../shared/constants/roles.js';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  custom?: (value: any) => string | null;
}

export type ValidationSchema = Record<string, ValidationRule>;

/**
 * Validation schemas for the Auth module.
 */
export const onboardSuperAdminSchema: ValidationSchema = {
  username: { required: true },
  email: { required: true },
  password: { required: true, minLength: 6 },
};

/**
 * Validation schema for user registration.
 */
export const registrationSchema: ValidationSchema = {
  username: { required: true },
  email: { required: true },
  password: { required: true, minLength: 6 },
  role: {
    required: false,
    custom: (value) => {
      if (!value) return null;
      return isValidRole(value) ? null : 'Invalid role';
    },
  },
};

/**
 * Validation schema for user login.
 */
export const loginSchema: ValidationSchema = {
  username: { required: true },
  password: { required: true },
};
