import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import EventEmitter from 'node:events';
import { IngestService } from '../../src/services/ingest/services/ingestService.js';
import { EventProducer } from '../../src/shared/events/producers/eventProducer.js';
import { ConfirmChannelManager } from '../../src/shared/events/producers/ConfirmChannelManager.js';
import { CircuitBreaker } from '../../src/shared/events/producers/CircuitBreaker.js';
import { RetryStrategy } from '../../src/shared/events/producers/RetryStrategy.js';

// Setup mock amqplib channel/connection
class MockConfirmChannel extends EventEmitter {
  public publish = jest.fn<
    (
      exchange: string,
      routingKey: string,
      buffer: Buffer,
      options: any,
      callback?: (err?: any) => void
    ) => boolean
  >();
  public close = jest.fn<() => Promise<void>>();
}

class MockRabbitMQConnection {
  public connection: {
    createConfirmChannel(): Promise<any>;
  } | null = null;

  public connect = jest.fn(async () => {
    this.connection = {
      createConfirmChannel: jest.fn(async () => new MockConfirmChannel()),
    };
  });
}

describe('RabbitMQ Integration (Ingest & EventProducer)', () => {
  let mockRmq: MockRabbitMQConnection;
  let mockChannel: MockConfirmChannel;
  let channelManager: ConfirmChannelManager;
  let circuitBreaker: CircuitBreaker;
  let retryStrategy: RetryStrategy;
  let eventProducer: EventProducer;
  let ingestService: IngestService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRmq = new MockRabbitMQConnection();
    
    // Silence logger inside components to keep test output clean
    const silentLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    channelManager = new ConfirmChannelManager({
      rabbitmq: mockRmq as any,
      logger: silentLogger as any,
    });

    circuitBreaker = new CircuitBreaker({
      failureThreshold: 1, // Set to 1 so a single failed ingestion trips it
      cooldownMs: 30000,
      logger: silentLogger as any,
    });

    retryStrategy = new RetryStrategy({
      maxRetries: 2,
      baseDelayMs: 1,
      maxDelayMs: 5,
    });

    eventProducer = new EventProducer({
      channelManager,
      circuitBreaker,
      retryStrategy,
      logger: silentLogger as any,
      queueName: 'test-queue',
    });

    ingestService = new IngestService({ eventProducer });
  });

  it('should successfully publish an API hit to the queue using IngestService and EventProducer', async () => {
    // 1. Arrange
    mockChannel = new MockConfirmChannel();
    mockChannel.publish.mockImplementation((exchange, routingKey, buffer, options, callback) => {
      if (callback) {
        callback(); // Call callback with no error to indicate successful confirm
      }
      return true;
    });

    mockRmq.connection = {
      createConfirmChannel: jest.fn(async () => mockChannel),
    };

    const hitData = {
      ClientId: 'client-1',
      ApiKeyId: 'key-1',
      endpoint: '/users',
      method: 'POST',
    };

    // 2. Act
    const result = await ingestService.ingestApiHit(hitData);

    // 3. Assert
    expect(result.status).toBe('published');
    expect(result.eventId).toBeDefined();
    
    expect(mockChannel.publish).toHaveBeenCalledTimes(1);
    const call = mockChannel.publish.mock.calls[0];
    expect(call).toBeDefined();
    const [exchange, routingKey, buffer, options] = call!;
    
    expect(exchange).toBe('');
    expect(routingKey).toBe('test-queue');
    
    const parsedMessage = JSON.parse(buffer.toString());
    expect(parsedMessage.type).toBe('API_HIT');
    expect(parsedMessage.data.ClientId).toBe('client-1');
    expect(parsedMessage.data.eventId).toBe(result.eventId);
    
    expect(options.messageId).toBe(result.eventId);
    expect(options.persistent).toBe(true);
  });

  it('should retry publishing when the first attempt fails and then succeeds', async () => {
    // 1. Arrange
    mockChannel = new MockConfirmChannel();
    let attemptCount = 0;
    mockChannel.publish.mockImplementation((exchange, routingKey, buffer, options, callback) => {
      attemptCount++;
      if (attemptCount === 1) {
        // First attempt fails with a retryable error
        if (callback) {
          callback(new Error('Connection closed'));
        }
      } else {
        // Second attempt succeeds
        if (callback) {
          callback();
        }
      }
      return true;
    });

    mockRmq.connection = {
      createConfirmChannel: jest.fn(async () => mockChannel),
    };

    const hitData = {
      ClientId: 'client-2',
      ApiKeyId: 'key-2',
      endpoint: '/products',
      method: 'GET',
    };

    // 2. Act
    const result = await ingestService.ingestApiHit(hitData);

    // 3. Assert
    expect(result.status).toBe('published');
    expect(attemptCount).toBe(2);
    expect(mockChannel.publish).toHaveBeenCalledTimes(2);
  });

  it('should trip the circuit breaker after consecutive failures and fast-reject subsequent calls', async () => {
    // 1. Arrange
    mockChannel = new MockConfirmChannel();
    mockChannel.publish.mockImplementation((exchange, routingKey, buffer, options, callback) => {
      if (callback) {
        callback(new Error('Connection closed')); // always fails with retryable error
      }
      return true;
    });

    mockRmq.connection = {
      createConfirmChannel: jest.fn(async () => mockChannel),
    };

    const hitData = {
      ClientId: 'client-3',
      ApiKeyId: 'key-3',
      endpoint: '/orders',
      method: 'DELETE',
    };

    // 2. Act & Assert: Call once. It should retry up to 2 times (3 attempts total) and throw the error.
    await expect(ingestService.ingestApiHit(hitData)).rejects.toThrow('Connection closed');
    expect(mockChannel.publish).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    
    // Now circuit breaker should be tripped (failureThreshold is 1, we had 1 overall call fail).
    expect(circuitBreaker.state).toBe('OPEN');

    // 3. Call again. It should be rejected immediately due to open circuit breaker.
    const result = await ingestService.ingestApiHit(hitData);
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('Circuit breaker open');
    
    // Verify that we didn't call publish this time because circuit breaker fast-rejected.
    expect(mockChannel.publish).toHaveBeenCalledTimes(3); // Still 3, no new calls
  });
});
