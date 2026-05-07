import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response } from 'express';

// ── Module-level mocks ─────────────────────────────────────────────────────────
// Both mocks must be set up BEFORE the middleware is imported so the middleware
// picks up the mocked versions at module-load time.

// Mock CacheService so no real Redis client is needed
const mockCacheGet    = jest.fn<() => Promise<any>>();
const mockCacheSetV   = jest.fn<() => Promise<void>>();
const mockCacheSetI   = jest.fn<() => Promise<void>>();

jest.mock('../../src/shared/utils/CacheService.js', () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get:         mockCacheGet,
    setValid:    mockCacheSetV,
    setInvalid:  mockCacheSetI,
    invalidate:  jest.fn(),
  })),
}));

// Mock the Redis singleton so the CacheService constructor never tries to connect
jest.mock('../../src/shared/config/redis.js', () => ({
  default: { getClient: jest.fn().mockReturnValue({}), connect: jest.fn(), close: jest.fn() },
}));

// Mock clientContainer — the source of DB lookups
const mockGetClientByApiKey = jest.fn<() => Promise<any>>();
jest.mock('../../src/services/client/client.container.js', () => ({
  default: {
    services: {
      clientServices: { getClientByApiKey: mockGetClientByApiKey },
    },
  },
}));

// ── Import middleware AFTER mocks are registered ───────────────────────────────
import validateApiKey from '../../src/shared/middlewares/validateApiKey.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_CLIENT  = { _id: 'client-1', isActive: true, name: 'Test Client' };
const VALID_API_KEY = { _id: 'key-1', permissions: { canIngest: true } };
const VALID_PAYLOAD = { client: VALID_CLIENT, apiKey: VALID_API_KEY };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/hit', validateApiKey, (_req: Request, res: Response) => {
    res.status(202).json({ success: true });
  });
  return app;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('validateApiKey middleware', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  // ── Layer 0: header present check ────────────────────────────────────────────

  it('returns 401 when x-api-key header is missing', async () => {
    const res = await request(app).post('/api/hit');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/api key is required/i);
    expect(mockGetClientByApiKey).not.toHaveBeenCalled();
  });

  // ── Layer 1: Redis positive cache hit ────────────────────────────────────────

  it('calls next() immediately on a Redis positive cache hit without touching DB', async () => {
    mockCacheGet.mockResolvedValue({ hit: true, isNegative: false, value: VALID_PAYLOAD });

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_cached');

    expect(res.status).toBe(202);
    expect(mockGetClientByApiKey).not.toHaveBeenCalled();  // Zero DB calls
  });

  // ── Layer 1: Redis negative cache hit ────────────────────────────────────────

  it('returns 403 immediately on a Redis negative cache hit without touching DB', async () => {
    mockCacheGet.mockResolvedValue({ hit: true, isNegative: true });

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_invalid');

    expect(res.status).toBe(403);
    expect(mockGetClientByApiKey).not.toHaveBeenCalled();  // Zero DB calls
    expect(mockCacheSetI).not.toHaveBeenCalled();          // Already cached
  });

  // ── Layer 3: Cache miss → valid DB result ────────────────────────────────────

  it('queries DB on cache miss, caches result, and calls next()', async () => {
    mockCacheGet.mockResolvedValue({ hit: false });
    mockGetClientByApiKey.mockResolvedValue({ client: VALID_CLIENT, apiKey: VALID_API_KEY });

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_new_valid');

    expect(res.status).toBe(202);
    expect(mockGetClientByApiKey).toHaveBeenCalledTimes(1);
    expect(mockCacheSetV).toHaveBeenCalledTimes(1);        // Positive result cached
    expect(mockCacheSetI).not.toHaveBeenCalled();
  });

  // ── Layer 3: Cache miss → invalid DB result ──────────────────────────────────

  it('negative-caches the key and returns 403 when DB returns null', async () => {
    mockCacheGet.mockResolvedValue({ hit: false });
    mockGetClientByApiKey.mockResolvedValue(null);

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_bogus');

    expect(res.status).toBe(403);
    expect(mockGetClientByApiKey).toHaveBeenCalledTimes(1);
    expect(mockCacheSetI).toHaveBeenCalledTimes(1);        // Negative cache written
    expect(mockCacheSetV).not.toHaveBeenCalled();
  });

  // ── Layer 3: Inactive client ─────────────────────────────────────────────────

  it('negative-caches and returns 403 for an inactive client', async () => {
    mockCacheGet.mockResolvedValue({ hit: false });
    mockGetClientByApiKey.mockResolvedValue({
      client:  { ...VALID_CLIENT, isActive: false },
      apiKey:  VALID_API_KEY,
    });

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_inactive');

    expect(res.status).toBe(403);
    expect(mockCacheSetI).toHaveBeenCalledTimes(1);
  });

  // ── Layer 3: Missing canIngest permission ────────────────────────────────────

  it('negative-caches and returns 403 when canIngest permission is missing', async () => {
    mockCacheGet.mockResolvedValue({ hit: false });
    mockGetClientByApiKey.mockResolvedValue({
      client:  VALID_CLIENT,
      apiKey:  { _id: 'key-noperm', permissions: { canIngest: false } },
    });

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_noperm');

    expect(res.status).toBe(403);
    expect(mockCacheSetI).toHaveBeenCalledTimes(1);
  });

  // ── Layer 2: Stampede prevention ─────────────────────────────────────────────

  it('makes only ONE DB query when the same key is requested concurrently (stampede prevention)', async () => {
    // cache always misses — forces DB path
    mockCacheGet.mockResolvedValue({ hit: false });

    // DB query takes 20ms to simulate a slow round-trip
    mockGetClientByApiKey.mockImplementation(
      () => new Promise(resolve =>
        setTimeout(() => resolve({ client: VALID_CLIENT, apiKey: VALID_API_KEY }), 20)
      )
    );

    // Fire 5 simultaneous requests with the same API key
    const results = await Promise.all(
      Array(5).fill(null).map(() =>
        request(app).post('/api/hit').set('x-api-key', 'apim_concurrent')
      )
    );

    // All 5 should succeed
    results.forEach(r => expect(r.status).toBe(202));

    // CRITICAL: stampede prevention means only 1 DB query was made
    expect(mockGetClientByApiKey).toHaveBeenCalledTimes(1);
  });

  // ── Redis error degradation ───────────────────────────────────────────────────

  it('falls through to DB when Redis.get() throws (graceful degradation)', async () => {
    // Simulate Redis being down
    mockCacheGet.mockRejectedValue(new Error('Redis unavailable'));
    mockGetClientByApiKey.mockResolvedValue({ client: VALID_CLIENT, apiKey: VALID_API_KEY });

    const res = await request(app).post('/api/hit').set('x-api-key', 'apim_redis_down');

    // Should still succeed — Redis failure is non-fatal
    expect(res.status).toBe(202);
    expect(mockGetClientByApiKey).toHaveBeenCalledTimes(1);
  });
});
