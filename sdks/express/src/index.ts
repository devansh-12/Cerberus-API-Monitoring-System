import { Request, Response, NextFunction } from 'express';
import { discoverServiceName } from './utils';
import { HitBatcher, ApiHit } from './batcher';

export interface CerberusOptions {
  /**
   * Your Cerberus API key.
   * If not provided, it will attempt to use the CERBERUS_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * The URL of your Cerberus host (e.g. https://your-cerberus.com/api/hit).
   * If not provided, it will attempt to use the CERBERUS_URL environment variable.
   */
  url?: string;

  /**
   * Logical name of your service (e.g. user-service).
   * If not provided, it will try to discover it from CERBERUS_SERVICE_NAME, npm_package_name, or package.json.
   */
  serviceName?: string;

  /**
   * Batching options. Set to false to disable batching.
   */
  batching?: {
    batchSize?: number;
    flushIntervalMs?: number;
  } | false;
}

export default function cerberus(options: CerberusOptions = {}) {
  const apiKey = options.apiKey || process.env.CERBERUS_API_KEY;
  const url = options.url || process.env.CERBERUS_URL;
  const serviceName = discoverServiceName(options.serviceName);

  if (!apiKey) {
    console.warn('[Cerberus] Middleware initialized without an API Key. API hits will not be recorded.');
  }

  if (!url) {
     console.warn('[Cerberus] Middleware initialized without a URL. API hits will not be recorded.');
  }

  const useBatching = options.batching !== false;
  let batcher: HitBatcher | null = null;

  if (url && apiKey) {
    // We always use the batcher to manage queue/flush, even if batchSize is 1
    let batchSize = 1;
    let flushIntervalMs = 0;

    if (useBatching) {
      batchSize = (options.batching && options.batching.batchSize) ? options.batching.batchSize : 100;
      flushIntervalMs = (options.batching && options.batching.flushIntervalMs) ? options.batching.flushIntervalMs : 1000;
    }

    batcher = new HitBatcher({
      url,
      apiKey,
      batchSize: batchSize,
      flushIntervalMs: flushIntervalMs
    });
  }

  return function cerberusMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      if (!batcher) return;

      const latencyMs = Date.now() - start;

      // Extract endpoint, prefer the route path if available (e.g. /users/:id) instead of actual path (/users/123)
      // to avoid high cardinality in metrics. If not available, fallback to req.path or req.baseUrl + req.path
      const endpoint = (req.route && req.route.path)
        ? (req.baseUrl || '') + req.route.path
        : (req.baseUrl ? req.baseUrl + req.path : req.path);

      const requestBytes = Number(req.headers['content-length'] ?? 0);
      const responseBytes = Number(res.getHeader('content-length') ?? 0);

      const payload: ApiHit = {
        endpoint,
        method: req.method,
        statusCode: res.statusCode,
        latencyMs,
        serviceName,
        requestBytes,
        responseBytes,
      };

      // Enqueue the hit (which will flush immediately if batchSize is 1, or queue it)
      batcher.enqueue(payload);
    });

    next();
  };
}
