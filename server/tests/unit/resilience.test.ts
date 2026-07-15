import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import EventEmitter from 'node:events';
import { IngestService } from '../../src/services/ingest/services/ingestService.js';
import { EventProducer } from '../../src/shared/events/producers/eventProducer.js';
import { ConfirmChannelManager } from '../../src/shared/events/producers/ConfirmChannelManager.js';
import { CircuitBreaker } from '../../src/shared/events/producers/CircuitBreaker.js';
import { RetryStrategy } from '../../src/shared/events/producers/RetryStrategy.js';
// @ts-ignore
import { ProcessorService } from '../../src/services/processor/service/ProcessorService.js';

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

describe('System Resilience Tests', () => {
  // Ingest Service Dependencies
  let mockRmq: MockRabbitMQConnection;
  let mockChannel: MockConfirmChannel;
  let channelManager: ConfirmChannelManager;
  let circuitBreaker: CircuitBreaker;
  let retryStrategy: RetryStrategy;
  let eventProducer: EventProducer;
  let ingestService: IngestService;

  // Processor Service Dependencies
  let mockApiHitRepository: {
    save: any;
    deleteOldHits: any;
  };
  let mockMetricsRepository: {
    upsertEndpointMetrics: any;
  };
  let processorService: ProcessorService;

  beforeEach(() => {
    jest.clearAllMocks();

    const silentLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // ── Setup Ingestion components ──
    mockRmq = new MockRabbitMQConnection();
    
    channelManager = new ConfirmChannelManager({
      rabbitmq: mockRmq as any,
      logger: silentLogger as any,
    });

    circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30000,
      logger: silentLogger as any,
    });

    retryStrategy = new RetryStrategy({
      maxRetries: 1,
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

    // ── Setup Processor components ──
    mockApiHitRepository = {
      save: jest.fn(),
      deleteOldHits: jest.fn(),
    };

    mockMetricsRepository = {
      upsertEndpointMetrics: jest.fn(),
    };

    processorService = new ProcessorService({
      apiHitRepository: mockApiHitRepository,
      metricsRepository: mockMetricsRepository,
    });
  });

  describe('Ingestion Resilience (RabbitMQ Unavailability)', () => {
    it('should propagate connection errors gracefully when RabbitMQ is completely unavailable', async () => {
      // Configure RabbitMQ connect method to fail (throw)
      mockRmq.connect.mockRejectedValue(new Error('RabbitMQ connection refused'));

      const hitData = {
        ClientId: 'client-1',
        ApiKeyId: 'key-1',
        endpoint: '/users',
        method: 'POST',
      };

      // IngestService should bubble up the connection error after retries fail
      await expect(ingestService.ingestApiHit(hitData)).rejects.toThrow('RabbitMQ connection refused');
    });

    it('should propagate publish nack errors when channel refuses to write messages', async () => {
      mockChannel = new MockConfirmChannel();
      mockChannel.publish.mockImplementation((exchange, routingKey, buffer, options, callback) => {
        if (callback) {
          callback(new Error('Publish nacked: queue limit reached'));
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

      await expect(ingestService.ingestApiHit(hitData)).rejects.toThrow('Publish nacked: queue limit reached');
    });
  });

  describe('Processing Resilience (Database Failures)', () => {
    const sampleEvent = {
      eventId: 'evt-123',
      ClientId: 'client-1',
      serviceName: 'test-service',
      endpoint: '/users',
      method: 'POST',
      timestamp: new Date().toISOString(),
      statusCode: 200,
      latencyMs: 15,
    };

    it('should fail critically and propagate the error if saving raw event to MongoDB fails', async () => {
      // Mock MongoDB save to fail
      mockApiHitRepository.save.mockRejectedValue(new Error('MongoDB connection timed out'));

      // ProcessorService should throw the critical error so it can be nacked/requeued
      await expect(processorService.processEvent(sampleEvent)).rejects.toThrow('MongoDB connection timed out');
      
      expect(mockApiHitRepository.save).toHaveBeenCalledTimes(1);
      expect(mockMetricsRepository.upsertEndpointMetrics).not.toHaveBeenCalled();
    });

    it('should successfully complete processing (without throwing) even if Postgres metrics upsert fails', async () => {
      // Mock MongoDB save to succeed
      mockApiHitRepository.save.mockResolvedValue({ id: 'doc-123' });

      // Mock Postgres metrics upsert to fail
      mockMetricsRepository.upsertEndpointMetrics.mockRejectedValue(new Error('Postgres connection pool exhausted'));

      // ProcessorService should catch the Postgres error internally and NOT propagate it
      // (ensuring raw event remains saved in MongoDB, and the event is acknowledged/acked)
      await expect(processorService.processEvent(sampleEvent)).resolves.not.toThrow();

      expect(mockApiHitRepository.save).toHaveBeenCalledTimes(1);
      expect(mockMetricsRepository.upsertEndpointMetrics).toHaveBeenCalledTimes(1);
    });
  });
});
