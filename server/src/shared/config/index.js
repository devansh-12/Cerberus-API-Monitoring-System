import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define the schema for environment variables using zod for security & validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),

  // MongoDB
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME is required'),

  // PostgreSQL
  PG_HOST: z.string().default('postgres'),
  PG_PORT: z.string().transform(Number).default('5432'),
  PG_DATABASE: z.string().min(1, 'PG_DATABASE is required'),
  PG_USER: z.string().min(1, 'PG_USER is required'),
  PG_PASSWORD: z.string().min(1, 'PG_PASSWORD is required'),

  // RabbitMQ
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  RABBITMQ_QUEUE: z.string().default('api_hits'),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100')
});

// Validate the process.env object against the schema
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:");
  console.error(_env.error.format());
  process.exit(1);
}

// Export the validated and casted environment variables securely
export const config = _env.data;

export default config;