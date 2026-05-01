export interface PasswordValidationResult {
  success: boolean;
  errors: string[];
}

interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

const WEAK_PASSWORDS = [
  'password', '123456', 'qwerty', 'admin', 'letmein',
  'password123', 'admin123', '12345678', 'welcome',
];

/**
 * Utility class — password validation and future security helpers.
 */
class SecurityUtils {
  static readonly PASSWORD_REQUIREMENTS: PasswordRequirements = {
    minLength: parseInt(process.env['PASSWORD_MIN_LENGTH'] ?? '8', 10),
    requireUppercase: (process.env['PASSWORD_REQUIRE_UPPERCASE'] ?? 'true') === 'true',
    requireLowercase: (process.env['PASSWORD_REQUIRE_LOWERCASE'] ?? 'true') === 'true',
    requireNumbers: (process.env['PASSWORD_REQUIRE_NUMBERS'] ?? 'true') === 'true',
    requireSymbols: (process.env['PASSWORD_REQUIRE_SYMBOLS'] ?? 'true') === 'true',
  };

  static validatePassword(password: string): PasswordValidationResult {
    if (!password) {
      return { success: false, errors: ['Password is required'] };
    }

    const errors: string[] = [];
    const r = this.PASSWORD_REQUIREMENTS;

    if (password.length < r.minLength) {
      errors.push(`Password must be at least ${r.minLength} chars long!`);
    }
    if (r.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (r.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (r.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (r.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    return { success: errors.length === 0, errors };
  }
}

export default SecurityUtils;
