import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import config from './shared/config/index.js';
import logger from './shared/config/logger.js';
import mongodb from './shared/config/mongodb.js';
import postgres from './shared/config/postgres.js';
import rabbitmq from './shared/config/rabbitmq.js';
// @ts-ignore
import errorHandler from './shared/middlewares/errorHandler.js';
import ResponseFormatter from './shared/utils/responseFormatter.js';
import redis from './shared/config/redis.js';

// Routers
// @ts-ignore
import authRouter from './services/auth/routes/authRouter.js';
// @ts-ignore
import clientRouter from './services/client/routes/clientRoutes.js';
// @ts-ignore
import analyticsRouter from './services/analytics/routes/analyticsRoutes.js';
// @ts-ignore
import ingestRouter from './services/ingest/routes/ingestRoutes.js';

/**
 * Initialize Express app
 */
const app = express();

/**
 * Middlewares
 */
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

/**
 * API Routes
 */
app.use('/api/auth', authRouter);
app.use('/api/client', clientRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/hit', ingestRouter);

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(
    ResponseFormatter.success(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      'Service is healthy',
    ),
  );
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json(
    ResponseFormatter.success(
      {
        service: 'API Hit Monitoring System',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          client: '/api/client',
          ingest: '/api/hit',
        },
      },
      'API Hit Monitoring Service',
    ),
  );
});

/**
 * 404 Handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json(ResponseFormatter.error('Endpoint not found', 404));
});

app.use(errorHandler);

async function initializeConnection(): Promise<void> {
  try {
    logger.info('Initializing database connections...');

    await mongodb.connect();
    await postgres.testConnection();
    await rabbitmq.connect();
    redis.connect();  // Non-blocking: ioredis queues commands until ready

    logger.info('All connections established successfully');
  } catch (error) {
    logger.error('Failed to initialize connections:', error);
    throw error;
  }
}

async function startServer(): Promise<void> {
  try {
    await initializeConnection();

    const server = app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Environment: ${config.node_env}`);
      logger.info(`API available at: http://localhost:${config.port}`);
    });

    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await mongodb.disconnect();
          await postgres.close();
          await rabbitmq.close();
          await redis.close();
          logger.info('All connections closed, exiting process');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      void gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      void gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

export { app };

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}
