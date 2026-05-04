import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EventEmitter from 'events';

// Create a mock RabbitMQ channel and connection
class MockChannel extends EventEmitter {
  public queues: Map<string, any[]> = new Map();
  public consumers: Map<string, Function> = new Map();

  async assertQueue(queue: string) {
    if (!this.queues.has(queue)) {
      this.queues.set(queue, []);
    }
    return { queue };
  }

  async sendToQueue(queue: string, buffer: Buffer) {
    await this.assertQueue(queue);
    const messages = this.queues.get(queue);
    const msg = { content: buffer };
    messages?.push(msg);

    // If there is a consumer, process immediately
    const consumer = this.consumers.get(queue);
    if (consumer) {
      setTimeout(() => consumer(msg), 0);
    }
    return true;
  }

  async consume(queue: string, callback: Function) {
    this.consumers.set(queue, callback);
    return { consumerTag: 'mock-tag' };
  }

  ack(msg: any) {
    // Ack removes message in a real scenario
  }

  nack(msg: any, allUpTo?: boolean, requeue?: boolean) {
    // Nack logic
  }
}

describe('RabbitMQ Core Tests', () => {
  let mockChannel: MockChannel;

  beforeEach(() => {
    mockChannel = new MockChannel();
  });

  it('should successfully publish a message to the queue', async () => {
    const payload = JSON.stringify({ test: 'data' });
    const isSent = await mockChannel.sendToQueue('test-queue', Buffer.from(payload));
    
    expect(isSent).toBe(true);
    const queueData = mockChannel.queues.get('test-queue');
    expect(queueData).toBeDefined();
    expect(queueData?.length).toBe(1);
    expect(queueData?.[0].content.toString()).toBe(payload);
  });

  it('should process a message when consumer is listening', async () => {
    const payload = { test: 'data' };
    const processedMessages: any[] = [];

    await mockChannel.consume('test-queue', (msg: any) => {
      processedMessages.push(JSON.parse(msg.content.toString()));
      mockChannel.ack(msg);
    });

    await mockChannel.sendToQueue('test-queue', Buffer.from(JSON.stringify(payload)));

    // Wait a tiny bit for async emit
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(processedMessages.length).toBe(1);
    expect(processedMessages[0]).toEqual(payload);
  });

  it('should simulate failure and retry (mock nack)', async () => {
    let attempts = 0;

    await mockChannel.consume('retry-queue', (msg: any) => {
      attempts++;
      if (attempts < 2) {
        mockChannel.nack(msg, false, true); // requeue
        // simulate requeue manually since mock doesn't do it automatically
        mockChannel.sendToQueue('retry-queue', msg.content);
      } else {
        mockChannel.ack(msg);
      }
    });

    await mockChannel.sendToQueue('retry-queue', Buffer.from(JSON.stringify({ id: 1 })));

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(attempts).toBe(2);
  });
});
