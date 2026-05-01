import { EventEmitter } from 'node:events';
import type { ConfirmChannel } from 'amqplib';

interface Waiter {
  resolve: (ch: ConfirmChannel) => void;
  reject: (err: unknown) => void;
}

interface RabbitMQConnection {
  connection?: {
    createConfirmChannel(): Promise<ConfirmChannel>;
  };
  connect(): Promise<void>;
}

export interface ConfirmChannelManagerOptions {
  rabbitmq: RabbitMQConnection;
  logger?: Pick<Console, 'info' | 'warn' | 'error' | 'debug'>;
}

/**
 * Manages a single RabbitMQ confirm channel, ensuring it is recreated if it
 * closes or encounters an error. Emits 'drain' and 'error' events.
 */
export class ConfirmChannelManager extends EventEmitter {
  private readonly _rabbitmq: RabbitMQConnection;
  private readonly _logger: Pick<Console, 'info' | 'warn' | 'error' | 'debug'>;
  private _channel: ConfirmChannel | null;
  private _connecting: boolean;
  private _connectWaiters: Waiter[];

  constructor({ rabbitmq, logger }: ConfirmChannelManagerOptions) {
    super();

    if (!rabbitmq) throw new Error('Confirm Channel Manager requires rabbitmq connection manager');

    this._rabbitmq = rabbitmq;
    this._logger = logger ?? console;
    this._channel = null;
    this._connecting = false;
    this._connectWaiters = [];
  }

  async getChannel(): Promise<ConfirmChannel> {
    if (this._channel) return this._channel;

    if (this._connecting) {
      return new Promise<ConfirmChannel>((resolve, reject) => {
        this._connectWaiters.push({ resolve, reject });
      });
    }

    return this._connect();
  }

  private async _connect(): Promise<ConfirmChannel> {
    this._connecting = true;
    try {
      let connection: RabbitMQConnection['connection'];

      if (this._rabbitmq.connection) {
        connection = this._rabbitmq.connection;
      } else {
        await this._rabbitmq.connect();

        if (!this._rabbitmq.connection) {
          throw new Error('Failed to obtain RabbitMQ connection');
        }

        connection = this._rabbitmq.connection;
      }

      const confirmChannel = await connection.createConfirmChannel();

      confirmChannel.on('drain', () => this.emit('drain'));

      confirmChannel.on('close', () => {
        this._logger.warn('[ChannelManager] confirm channel closed unexpectedly');
        this._channel = null;
      });

      confirmChannel.on('error', (err: Error) => {
        this._logger.error('[ChannelManager] confirm channel error', {
          error: err.message,
          stack: err.stack,
          code: (err as NodeJS.ErrnoException).code,
        });
        this._channel = null;
        this.emit('error', err);
      });

      this._channel = confirmChannel;
      this._logger.info('[ChannelManager] confirm channel ready');

      for (const w of this._connectWaiters) w.resolve(confirmChannel);
      this._connectWaiters = [];

      return confirmChannel;
    } catch (error) {
      for (const w of this._connectWaiters) w.reject(error);
      this._connectWaiters = [];
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async close(): Promise<void> {
    if (this._channel) {
      await this._channel.close();
      this._channel = null;
    }
  }
}
