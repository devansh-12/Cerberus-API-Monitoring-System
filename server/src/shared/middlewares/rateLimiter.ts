import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import config from '../config/index.js';
import redisConnection from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Redis-backed rate limiter for the ingest endpoint.
 *
 * Replaces the previous in-memory fixed-window limiter with a distributed
 * sliding-window counter stored in Redis. This ensures that rate limits are
 * enforced globally across all Kubernetes pods — not just per-pod.
 *
 * Key-by strategy: API key header (`x-api-key`) rather than IP address so
 * the limit is per-client, not per-network-address. Falls back to IP if
 * the header is absent (i.e., a request that failed validateApiKey before
 * reaching this middleware).
 *
 * Principle: Single Responsibility — all rate-limit configuration lives here,
 * not inline in route files.
 * Principle: Open/Closed — uses the RedisStore adapter so the underlying
 * algorithm can be swapped (e.g., to a Lua-based token bucket) without
 * changing ingestRoutes.js.
 */
export const ingestRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.maxRequests,

  // Identify clients by their API key, not their IP
  keyGenerator: (req: Request): string => {
    const key = req.headers['x-api-key'] as string | undefined;
    return key ?? req.ip ?? 'unknown';
  },

  // Global Redis store — shared across all pods
  store: new RedisStore({
    // rate-limit-redis requires a raw RESP command sender
    sendCommand: async (...args: string[]): Promise<any> => {
      const client = redisConnection.getClient();
      return (client as any).call(...args);
    },
  }),

  standardHeaders: true,   // Return RateLimit-* headers (RFC 6585)
  legacyHeaders:   false,  // Disable X-RateLimit-* headers

  // Called when the limit is exceeded — log for observability
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', {
      key:    req.headers['x-api-key'] ?? req.ip,
      path:   req.path,
      limit:  options.max,
      window: options.windowMs,
    });
    res.status(429).json({
      success:    false,
      message:    'Rate limit exceeded. Please reduce your request frequency.',
      statusCode: 429,
      retryAfter: `${Math.ceil(options.windowMs / 1000)} seconds`,
    });
  },
});
