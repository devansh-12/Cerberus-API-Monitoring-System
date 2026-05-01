import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME is required'),

  PG_HOST: z.string().default('postgres'),
  PG_PORT: z.string().transform(Number).default('5432'),
  PG_DATABASE: z.string().min(1, 'PG_DATABASE is required'),
  PG_USER: z.string().min(1, 'PG_USER is required'),
  PG_PASSWORD: z.string().min(1, 'PG_PASSWORD is required'),

  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  RABBITMQ_QUEUE: z.string().default('api_hits'),
  RABBITMQ_RETRY_ATTEMPTS: z.string().transform(Number).default('3'),
  RABBITMQ_RETRY_DELAY: z.string().transform(Number).default('200'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  COOKIE_HTTP_ONLY: z.string().transform((v) => v === 'true').default('true'),
  COOKIE_SECURE: z.string().transform((v) => v === 'true').default('false'),
  COOKIE_EXPIRES_IN: z.string().transform(Number).default('86400000'),
});

export type AppConfig = z.infer<typeof envSchema>;

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_env.error.format());
  process.exit(1);
}

const raw = _env.data;

export const config = {
  node_env: raw.NODE_ENV,
  port: raw.PORT,
  mongo: { uri: raw.MONGO_URI, dbName: raw.MONGO_DB_NAME },
  postgres: { host: raw.PG_HOST, port: raw.PG_PORT, database: raw.PG_DATABASE, user: raw.PG_USER, password: raw.PG_PASSWORD },
  rabbitmq: { url: raw.RABBITMQ_URL, queue: raw.RABBITMQ_QUEUE, retryAttempts: raw.RABBITMQ_RETRY_ATTEMPTS, retryDelay: raw.RABBITMQ_RETRY_DELAY },
  jwt: { secret: raw.JWT_SECRET, expiresIn: raw.JWT_EXPIRES_IN },
  rateLimit: { windowMs: raw.RATE_LIMIT_WINDOW_MS, maxRequests: raw.RATE_LIMIT_MAX_REQUESTS },
  cookie: { httpOnly: raw.COOKIE_HTTP_ONLY, secure: raw.COOKIE_SECURE, expiresIn: raw.COOKIE_EXPIRES_IN },
  // kept for backward-compat
  PORT: raw.PORT,
  MONGO_URI: raw.MONGO_URI,
  MONGO_DB_NAME: raw.MONGO_DB_NAME,
  RABBITMQ_URL: raw.RABBITMQ_URL,
  RABBITMQ_QUEUE: raw.RABBITMQ_QUEUE,
  NODE_ENV: raw.NODE_ENV,
} as const;

export default config;
