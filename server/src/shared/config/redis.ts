import { Redis } from 'ioredis';
import config from './index.js';
import logger from './logger.js';

/**
 * Singleton Redis connection.
 *
 * Mirrors the pattern of RabbitMQConnection, PostgresConnection, and MongoConnection —
 * a class that owns a single connection instance, exposes connect/close/getStatus,
 * and is exported as a pre-constructed singleton.
 *
 * Principle: Single Responsibility — this class only manages the Redis connection lifecycle.
 * Principle: Open/Closed — consumers depend on the singleton, not on ioredis directly.
 */
class RedisConnection {
  private client: Redis | null = null;

  /**
   * Initialise the ioredis client. Safe to call multiple times — returns
   * the existing client if one is already connected.
   */
  connect(): Redis {
    if (this.client) {
      logger.info('Redis already connected');
      return this.client;
    }

    logger.info(`Connecting to Redis: ${config.redis.url}`);

    this.client = new Redis(config.redis.url, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      /**
       * Exponential back-off with a 5-second ceiling.
       * Returning null stops retrying (used when times > threshold).
       */
      retryStrategy: (times: number): number | null => {
        if (times > 10) {
          logger.error('Redis max reconnect attempts reached — giving up');
          return null;
        }
        const delay = Math.min(times * 200, 5_000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('ready', () => logger.info('Redis ready'));
    this.client.on('error', (err: Error) => logger.error('Redis connection error:', err));
    this.client.on('close', () => logger.warn('Redis connection closed'));
    this.client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    return this.client;
  }

  /**
   * Returns the active Redis client.
   * Lazily calls connect() if not yet initialised so callers
   * (e.g. CacheService) never receive a null reference.
   */
  getClient(): Redis {
    if (!this.client) return this.connect();
    return this.client;
  }

  getStatus(): 'connected' | 'disconnected' {
    if (!this.client) return 'disconnected';
    return this.client.status === 'ready' ? 'connected' : 'disconnected';
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }
}

export default new RedisConnection();
