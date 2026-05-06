import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { CacheService } from '../../src/shared/utils/CacheService.js';
import config from '../../src/shared/config/index.js';

console.log('CONFIG:', config);

// ── Mock Redis client ──────────────────────────────────────────────────────────
// We build a plain object shaped like ioredis — no module mock needed.
// This keeps the test hermetic: no real Redis connection, no network calls.
// Type each mock with its full call signature (args + return type).
// jest v30 requires this — plain jest.fn() infers 'never' as the return type
// which breaks mockResolvedValue; zero-arg signatures break toHaveBeenCalledWith.
const mockRedis = {

  get:   jest.fn<(key: string) => Promise<string | null>>(),
  setex: jest.fn<(key: string, ttl: number, value: string) => Promise<string>>(),
  del:   jest.fn<(key: string) => Promise<number>>(),
};

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new CacheService(mockRedis as any);
  });

  // ── get() ──────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns a cache miss when Redis returns null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get('apikey:v1:missing');

      expect(result.hit).toBe(false);
    });

    it('returns a negative hit for the __INVALID__ sentinel value', async () => {
      mockRedis.get.mockResolvedValue('__INVALID__');

      const result = await cache.get('apikey:v1:bad');

      expect(result.hit).toBe(true);
      if (result.hit) {
        expect(result.isNegative).toBe(true);
      }
    });

    it('returns a positive hit with the parsed value for a valid cached entry', async () => {
      const payload = { client: { _id: 'client-1', isActive: true }, apiKey: { _id: 'key-1' } };
      mockRedis.get.mockResolvedValue(JSON.stringify(payload));

      const result = await cache.get<typeof payload>('apikey:v1:valid');

      expect(result.hit).toBe(true);
      if (result.hit && !result.isNegative) {
        expect(result.value).toEqual(payload);
      }
    });

    it('degrades gracefully to a cache miss when Redis throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));

      // Should not throw — always returns miss on Redis failure
      const result = await cache.get('apikey:v1:error');

      expect(result.hit).toBe(false);
    });

    it('does not call setex or del during a get()', async () => {
      mockRedis.get.mockResolvedValue(null);
      await cache.get('any-key');

      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ── setValid() ─────────────────────────────────────────────────────────────

  describe('setValid()', () => {
    it('calls setex with the correct key, TTL, and JSON-stringified value', async () => {
      mockRedis.setex.mockResolvedValue('OK' as any);
      const value = { client: { _id: 'abc' }, apiKey: { _id: 'xyz' } };

      await cache.setValid('apikey:v1:test', value, 300);

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith('apikey:v1:test', 300, JSON.stringify(value));
    });

    it('does not throw when Redis throws during setex', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

      // Should silently absorb the error — caching is non-critical
      await expect(cache.setValid('key', { foo: 'bar' }, 300)).resolves.not.toThrow();
    });
  });

  // ── setInvalid() ───────────────────────────────────────────────────────────

  describe('setInvalid()', () => {
    it('stores the __INVALID__ sentinel with the specified TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK' as any);

      await cache.setInvalid('apikey:v1:bad', 60);

      expect(mockRedis.setex).toHaveBeenCalledWith('apikey:v1:bad', 60, '__INVALID__');
    });

    it('does not throw when Redis throws during setex', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

      await expect(cache.setInvalid('key', 60)).resolves.not.toThrow();
    });
  });

  // ── invalidate() ───────────────────────────────────────────────────────────

  describe('invalidate()', () => {
    it('calls del with the correct key', async () => {
      mockRedis.del.mockResolvedValue(1 as any);

      await cache.invalidate('apikey:v1:revoked');

      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith('apikey:v1:revoked');
    });

    it('does not throw when Redis throws during del', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'));

      await expect(cache.invalidate('key')).resolves.not.toThrow();
    });
  });
});
