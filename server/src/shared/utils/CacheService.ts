import type { Redis } from 'ioredis';
import logger from '../config/logger.js';
import config from '../config/index.js';

/**
 * Sentinel value stored in Redis to represent a confirmed-invalid API key.
 * Using a string constant rather than null/undefined makes it unambiguous
 * when reading back from Redis (which always returns strings or null).
 */
const INVALID_SENTINEL = '__INVALID__';

export interface CacheHitValid<T> {
  hit: true;
  isNegative: false;
  value: T;
}

export interface CacheHitNegative {
  hit: true;
  isNegative: true;
}

export interface CacheMiss {
  hit: false;
}

export type CacheResult<T> = CacheHitValid<T> | CacheHitNegative | CacheMiss;

/**
 * CacheService encapsulates all caching strategy logic for the application.
 *
 * Responsibilities:
 *   - Positive caching (valid results)
 *   - Negative caching (confirmed-invalid keys → INVALID_SENTINEL)
 *   - Cache invalidation on key revocation
 *
 * Principle: Single Responsibility — owns cache reads/writes, nothing else.
 * Principle: Dependency Inversion — depends on the ioredis Redis interface,
 *   not on a concrete connection class, making it trivially unit-testable.
 *
 * Error handling: All Redis errors are caught and logged. On error the method
 * returns a cache miss so the main request path is never blocked by a Redis fault.
 */
export class CacheService {
  constructor(private readonly redis: Redis) {}

  /**
   * Fetch a value from the cache.
   *
   * Returns a discriminated union so callers can use exhaustive type-narrowing:
   *
   *   const result = await cache.get<MyType>(key);
   *   if (!result.hit)           → cache miss, go to DB
   *   if (result.isNegative)     → confirmed invalid, reject immediately
   *   result.value               → cached valid result
   */
  async get<T>(key: string): Promise<CacheResult<T>> {
    try {
      const raw = await this.redis.get(key);

      if (raw === null) return { hit: false };

      if (raw === INVALID_SENTINEL) return { hit: true, isNegative: true };

      return { hit: true, isNegative: false, value: JSON.parse(raw) as T };
    } catch (err) {
      // On Redis failure, degrade gracefully — treat as a cache miss
      logger.error('CacheService.get error (treating as cache miss):', err);
      return { hit: false };
    }
  }

  /**
   * Cache a valid (positive) lookup result.
   * @param ttl Seconds until expiry. Defaults to REDIS_CACHE_TTL_VALID (5 min).
   */
  async setValid<T>(key: string, value: T, ttl = config.redis.ttlValid): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      logger.error('CacheService.setValid error:', err);
    }
  }

  /**
   * Negative Caching: Store the INVALID sentinel so repeat lookups for a
   * bad API key are answered from Redis in ~1ms rather than hitting MongoDB.
   *
   * Uses a shorter TTL than valid keys so a newly-created key isn't locked
   * out for long after a previous miss was cached.
   *
   * @param ttl Seconds until expiry. Defaults to REDIS_CACHE_TTL_INVALID (60 s).
   */
  async setInvalid(key: string, ttl = config.redis.ttlInvalid): Promise<void> {
    try {
      await this.redis.setex(key, ttl, INVALID_SENTINEL);
    } catch (err) {
      logger.error('CacheService.setInvalid error:', err);
    }
  }

  /**
   * Invalidate a specific key (e.g. on API key revocation or rotation).
   * Must be called from ClientService whenever a key is deleted or deactivated.
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug('CacheService: key invalidated', { key });
    } catch (err) {
      logger.error('CacheService.invalidate error:', err);
    }
  }
}
