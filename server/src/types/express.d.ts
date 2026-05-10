// Type declarations for Express Request augmentation

declare global {
  namespace Express {
    interface Request {
      client?: Record<string, unknown>;
      apiKey?: Record<string, unknown>;
      user?: {
        userId: string;
        role: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};
