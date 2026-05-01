import amqp from 'amqplib';
import config from './index.js';
import logger from './logger.js';

class RabbitMQConnection {
  public connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnecting = false;

  async connect(): Promise<amqp.Channel> {
    if (this.channel) {
      logger.info('RabbitMQ already connected');
      return this.channel;
    }

    if (this.isConnecting) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!this.isConnecting) { clearInterval(check); resolve(); }
        }, 100);
      });
      return this.channel!;
    }

    this.isConnecting = true;
    try {
      logger.info(`Connecting to RabbitMQ: ${config.rabbitmq.url}`);
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      const dlqName = `${config.rabbitmq.queue}.dlq`;
      await this.channel.assertQueue(dlqName, { durable: true });
      await this.channel.assertQueue(config.rabbitmq.queue, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': dlqName },
      });

      this.connection.on('close', () => {
        logger.error('RabbitMQ connection closed');
        this.channel = null;
        this.connection = null;
      });
      this.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error', err);
        this.channel = null;
        this.connection = null;
      });

      logger.info(`RabbitMQ connected: ${config.rabbitmq.url}`);
      return this.channel;
    } finally {
      this.isConnecting = false;
    }
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }

  getStatus(): 'connected' | 'disconnected' | 'closing' {
    if (!this.connection || !this.channel) return 'disconnected';
    return 'connected';
  }

  async close(): Promise<void> {
    if (this.channel) { await this.channel.close(); this.channel = null; }
    if (this.connection) { await this.connection.close(); this.connection = null; }
    logger.info('RabbitMQ connection closed');
  }
}

export default new RabbitMQConnection();
