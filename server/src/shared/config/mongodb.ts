import mongoose from 'mongoose';
import config from './index.js';
import logger from './logger.js';

class MongoConnection {
  public connection: mongoose.Connection | null = null;

  async connect(): Promise<mongoose.Connection> {
    if (this.connection) {
      logger.info('Already connected to MongoDB');
      return this.connection;
    }

    await mongoose.connect(config.mongo.uri, { dbName: config.mongo.dbName });

    this.connection = mongoose.connection;
    logger.info(`MongoDB connected: ${config.mongo.dbName}`);

    this.connection.on('error', (error: Error) => logger.error('MongoDB connection error:', error));
    this.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    this.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      logger.info('MongoDB disconnected');
    }
  }

  getConnection(): mongoose.Connection | null {
    return this.connection;
  }
}

export default new MongoConnection();
