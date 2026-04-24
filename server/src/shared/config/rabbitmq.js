import amqp from 'amqplib';
import config from "./index.js";
import logger from "./logger.js";

class RabbitMQConnection {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
    }

    async connect() {
        if (this.channel) {
            logger.info('RabbitMQ already connected');
            return this.channel;
        }

        if (this.isConnecting) {
            await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (!this.isConnecting) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100)
            })
            return this.channel;
        }
        try {
            this.isConnecting = true;
            logger.info('Connecting to RabbitMQ...', config.RABBITMQ_URL);
            this.connection = await amqp.connect(config.RABBITMQ_URL);
            this.channel = await this.connection.createChannel();

            //Creating key | Queue Name
            const dlqName = '${config.rabbitmq.queue}.dlq' // api hits | api_hits.dlq

            //DL Queue
            await this.channel.assertQueue(dlqName, {
                durable: true
            });

            //Main Queue 
            await this.channel.assertQueue(config.rabbotmq.queue, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': "",
                    'x-dead-letter-routing-key': dlqName,
                }
            });

            this.connection.on("close", () => {
                logger.error("RabbitMQ connection closed ");
                this.channel = null;
                this.connection = null;
            })

            this.connection.on("error", (err) => {
                logger.error("RabbitMQ connection error", err);
                this.channel = null;
                this.connection = null;
            });

            logger.info(`RabbitMQ connected successfully ${config.RABBITMQ_URL}`);
            this.isConnecting = false;
            return this.channel;

        } catch (error) {
            logger.error('Failed to connect to RabbitMQ:', error);
            throw new Error('Failed to connect to RabbitMQ');
        }
    }

    getChannel() {
        return this.channel;
    }

    /**
     * Get the status of the RabbitMQ connection
     * @returns {string} - 'connected', 'disconnected', or 'closing'
     */
    getStatus() {
        if (!this.connect || !this.channel) return 'disconnected';

        if (this.connection.closing || this.channel.closing) return 'closing';

        return 'connected';
    }

    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            logger.info('RabbitMQ connection closed');
        } catch (error) {
            logger.error('Failed to close RabbitMQ connection:', error);
            throw new Error('Failed to close RabbitMQ connection');
        }
    }
}

export default new RabbitMQConnection();