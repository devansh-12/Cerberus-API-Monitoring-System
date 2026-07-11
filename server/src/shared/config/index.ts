import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME is required'),

  PG_HOST: z.string().default('postgres'),
  PG_PORT: z.string().default('5432').transform(Number),
  PG_DATABASE: z.string().min(1, 'PG_DATABASE is required'),
  PG_USER: z.string().min(1, 'PG_USER is required'),
  PG_PASSWORD: z.string().min(1, 'PG_PASSWORD is required'),
  PG_POOL_MAX: z.string().default('20').transform(Number),

  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  RABBITMQ_QUEUE: z.string().default('api_hits'),
  RABBITMQ_RETRY_ATTEMPTS: z.string().default('3').transform(Number),
  RABBITMQ_RETRY_DELAY: z.string().default('200').transform(Number),

  CONSUMER_PREFETCH: z.string().default('50').transform(Number),

  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').default('redis://localhost:6379'),
  REDIS_CACHE_TTL_VALID: z.string().default('300').transform(Number),
  REDIS_CACHE_TTL_INVALID: z.string().default('60').transform(Number),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  COOKIE_HTTP_ONLY: z.string().default('true').transform((v) => v === 'true'),
  COOKIE_SECURE: z.string().default('false').transform((v) => v === 'true'),
  COOKIE_EXPIRES_IN: z.string().default('86400000').transform(Number),
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
  postgres: { host: raw.PG_HOST, port: raw.PG_PORT, database: raw.PG_DATABASE, user: raw.PG_USER, password: raw.PG_PASSWORD, poolMax: raw.PG_POOL_MAX },
  rabbitmq: { url: raw.RABBITMQ_URL, queue: raw.RABBITMQ_QUEUE, retryAttempts: raw.RABBITMQ_RETRY_ATTEMPTS, retryDelay: raw.RABBITMQ_RETRY_DELAY },
  consumer: { prefetch: raw.CONSUMER_PREFETCH },
  redis: { url: raw.REDIS_URL, ttlValid: raw.REDIS_CACHE_TTL_VALID, ttlInvalid: raw.REDIS_CACHE_TTL_INVALID },
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
};

export default config;
