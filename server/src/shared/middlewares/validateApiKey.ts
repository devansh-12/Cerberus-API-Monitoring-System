import type { Request, Response, NextFunction } from 'express';
import ResponseFormatter from '../utils/responseFormatter.js';
import logger from '../config/logger.js';
import clientContainer from '../../services/client/client.container.js';
import { CacheService } from '../utils/CacheService.js';
import redisConnection from '../config/redis.js';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiKeyValidationPayload {
  client: Record<string, unknown>;
  apiKey: Record<string, unknown>;
}

// ── Module-level singletons ────────────────────────────────────────────────────

/**
 * Version prefix on cache keys.
 * Increment (e.g. 'apikey:v2:') to perform a zero-downtime cache flush
 * without touching Redis directly.
 */
const CACHE_KEY_PREFIX = 'apikey:v1:';

/**
 * CacheService instance wired to the application-wide Redis singleton.
 * Constructed once at module load — not per-request.
 */
const cacheService = new CacheService(redisConnection.getClient());

/**
 * Stampede Prevention Map (Cache Thundering-Herd protection).
 *
 * Problem: When a cached key expires, hundreds of concurrent requests can
 * all experience a cache miss simultaneously and flood MongoDB.
 *
 * Solution: Store the in-flight Promise for each MongoDB lookup keyed by
 * the raw API key string. Any subsequent request for the same key within
 * the same event-loop window attaches to the existing Promise rather than
 * spawning a new DB query.
 *
 * This map lives at the module level so it is shared across all calls to
 * the middleware within the same Node.js process.
 */
const inFlightLookups = new Map<string, Promise<ApiKeyValidationPayload | null>>();

// ── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Performs a MongoDB lookup for the given API key, applies all business-rule
 * checks (active client, ingest permission), writes the result to Redis
 * (positive or negative), and always removes itself from `inFlightLookups`.
 *
 * Extracted from the middleware body so the Promise reference can be stored
 * in `inFlightLookups` BEFORE it is awaited — which is the critical ordering
 * that makes stampede prevention work.
 */
function buildDbLookupPromise(
  apiKey: string,
  cacheKey: string,
): Promise<ApiKeyValidationPayload | null> {
  return clientContainer.services.clientServices
    .getClientByApiKey(apiKey)
    .then(async (result: { client: any; apiKey: any } | null) => {
      // ── Negative Caching ────────────────────────────────────────────────────
      if (!result) {
        await cacheService.setInvalid(cacheKey);
        logger.warn('API key not found — negative cached', { prefix: apiKey.substring(0, 8) });
        return null;
      }

      const { client, apiKey: apiKeyObj } = result;

      // Business rules (mirrors the pre-existing checks in the old middleware)
      if (!client.isActive) {
        await cacheService.setInvalid(cacheKey);
        logger.warn('Inactive client API key — negative cached', { clientId: client._id });
        return null;
      }

      if (!apiKeyObj.permissions?.canIngest) {
        await cacheService.setInvalid(cacheKey);
        logger.warn('API key lacks ingest permission — negative cached', { apiKeyId: apiKeyObj._id });
        return null;
      }

      // ── Positive Caching ────────────────────────────────────────────────────
      const payload: ApiKeyValidationPayload = { client, apiKey: apiKeyObj };
      await cacheService.setValid(cacheKey, payload);

      logger.debug('API key validated and cached', { clientId: client._id });
      return payload;
    })
    .finally(() => {
      // Always clean up the in-flight map so memory does not leak
      inFlightLookups.delete(apiKey);
    });
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Middleware: Validates the `x-api-key` request header.
 *
 * Three-layer lookup strategy:
 *
 *   Layer 1 — Redis cache hit       (~1 ms)
 *     → Valid key: attach client/apiKey to req, call next()
 *     → Negative sentinel: reject with 403 immediately
 *
 *   Layer 2 — Stampede prevention   (~1 ms overhead)
 *     → An identical key is already being looked up by another concurrent
 *       request. Await that Promise's result instead of spawning a new query.
 *
 *   Layer 3 — MongoDB lookup        (~30–50 ms, only 1 concurrent per key)
 *     → Stores the Promise in `inFlightLookups` BEFORE awaiting it.
 *     → Writes result (positive or negative sentinel) to Redis.
 *     → Cleans up the in-flight map in `.finally()`.
 */
const validateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    logger.warn('API request without API key', { path: req.path, ip: req.ip });
    res.status(401).json(ResponseFormatter.error('API key is required', 401));
    return;
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${apiKey}`;

  // ── Layer 1: Redis cache ───────────────────────────────────────────────────
  const cached = await cacheService.get<ApiKeyValidationPayload>(cacheKey);

  if (cached.hit) {
    if (cached.isNegative) {
      logger.warn('Negative cache hit — invalid API key rejected at cache layer', { ip: req.ip });
      res.status(403).json(ResponseFormatter.error('Invalid or inactive API key', 403));
      return;
    }
    req.client = cached.value.client;
    req.apiKey = cached.value.apiKey;
    return next();
  }

  // ── Layer 2: Stampede prevention ──────────────────────────────────────────
  if (inFlightLookups.has(apiKey)) {
    logger.debug('Stampede prevention: awaiting in-flight DB lookup', {
      prefix: `${apiKey.substring(0, 8)}...`,
    });

    const result = await inFlightLookups.get(apiKey)!;

    if (!result) {
      res.status(403).json(ResponseFormatter.error('Invalid or inactive API key', 403));
      return;
    }

    req.client = result.client;
    req.apiKey = result.apiKey;
    return next();
  }

  // ── Layer 3: MongoDB lookup (register promise BEFORE awaiting) ────────────
  const dbLookup = buildDbLookupPromise(apiKey, cacheKey);

  // CRITICAL: store in map before awaiting so parallel requests in Layer 2
  // can attach to this same promise
  inFlightLookups.set(apiKey, dbLookup);

  try {
    const result = await dbLookup;

    if (!result) {
      res.status(403).json(ResponseFormatter.error('Invalid or inactive API key', 403));
      return;
    }

    req.client = result.client;
    req.apiKey = result.apiKey;
    next();
  } catch (error) {
    // Defensive cleanup — .finally() in buildDbLookupPromise handles the normal path
    inFlightLookups.delete(apiKey);
    logger.error('Unexpected error during API key validation:', error);
    res.status(500).json(ResponseFormatter.error('Internal server error', 500));
  }
};

export default validateApiKey;
