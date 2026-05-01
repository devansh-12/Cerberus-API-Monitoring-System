import pg from 'pg';
import config from './index.js';
import logger from './logger.js';

const { Pool } = pg;

class PostgresConnection {
  private pool: pg.Pool | null = null;

  getPool(): pg.Pool {
    if (!this.pool) {
      this.pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 2_000,
      });
      this.pool.on('error', (err: Error) => logger.error('Unexpected error on idle PG client', err));
      this.pool.on('connect', () => logger.info('PostgreSQL client connected'));
    }
    return this.pool;
  }

  async testConnection(): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{ now: string }>('SELECT NOW()');
      logger.info(`PostgreSQL connected at ${result.rows[0]?.now}`);
    } finally {
      client.release();
    }
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>> {
    const pool = this.getPool();
    const start = Date.now();
    const res = await pool.query<T>(text, params);
    logger.info(`Query executed in ${Date.now() - start}ms`);
    return res;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL pool closed');
    }
  }
}

export default new PostgresConnection();
