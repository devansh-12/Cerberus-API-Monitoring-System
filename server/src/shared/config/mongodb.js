import mongoose from "mongoose"
import config from "./index.js"
import logger from "./logger.js"


/**
 * MOngoDB database manager/connector 
 */

class MongoConnection {

    constructor() {
        this.connection = null;
    }
    /**
     * Connect to MongoDB
     * @returns {Promise<mongoose.Connection>}
     */

    async connect() {
        try {
            if (this.connection) {
                logger.info('Already connected to MongoDB');
                return this.connection;
            }

            await mongoose.connect(config.MONGO_URI, {
                dbName: config.MONGO_DB_NAME,
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            this.connection = mongoose.connection;
            logger.info(`MongoDB connected: ${config.MONGO_DB_NAME}`);

            // Add event listeners for connection status
            this.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
            });

            this.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
            });

            this.connection.on('reconnected', () => {
                logger.info('MongoDB reconnected');
            });

            return this.connection;

        } catch (error) {
            logger.error('Failed to Connect to MongoDB:', error);
            throw new Error('Failed to connect to MongoDB');
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        try {
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
                logger.info('MongoDB disconnected');
            }
        } catch (error) {
            logger.error('Failed to disconnect from MongoDB:', error);
            throw new Error('Failed to disconnect from MongoDB');
        }
    }

    /**
     * Get the Active MongoDB connection
        @return {mongoose.Connection}
     */
    getConnnection() {
        return this.connection
    }
}

export default new MongoConnection();