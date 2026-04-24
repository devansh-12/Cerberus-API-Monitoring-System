import pf from "pg"
import config from "./index"
import logger from "./logger"



const { Pool } = pg;

class PostgresConnection {

    constructor() {
        this.pool = null;
    }

    getPool() {
        if (!this.pool) {
            this.pool = new Pool({
                host: config.postgres.host,
                port: config.postgres.port,
                database: config.postgres.database,
                user: config.postgres.user,
                password: config.postgres.password,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            })
        }

        this.pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', err);
        })

        this.pool.on('connect', () => {
            logger.info('PostgreSQL connected');
        })

        return this.pool;
    }

    async testConnection() {
        try {
            const pool = this.getPool();
            const client = await pool.connect();
            const result = await client.query('SELECT NOW()');

            logger.info('PostgreSQL connection test successful');
            client.release();
            logger.info(`PG connected successfully at ${result.rows[0].now}`)
        } catch (error) {
            logger.error('PostgreSQL connection test failed:', error);
            throw error;
        }
    }

    async query(text, params) {
        const pool = this.getPool();
        const start = Date.now();
        try {
            const res = await pool.query(text, params);
            const duration = Date.now() - start;
            logger.info('Query executed in', duration, 'ms');
            return res;
        } catch (error) {
            logger.error('Error executing query:', { text, params, error: error.message });
            throw error;
        }
    }

    async disconnect() {
        const pool = this.getPool();
        await pool.end();
        this.pool = null;
        logger.info('PostgreSQL disconnected');
    }
}

export default new PostgresConnection();