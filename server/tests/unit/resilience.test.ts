import { jest, describe, it, expect } from '@jest/globals';

class MockSystem {
  isRabbitMqUp = true;
  isDbUp = true;

  async publish(message: any) {
    if (!this.isRabbitMqUp) {
      throw new Error('RabbitMQ connection failed');
    }
    return true;
  }

  async saveToDb(message: any) {
    if (!this.isDbUp) {
      throw new Error('Database connection failed');
    }
    return true;
  }

  async ingestApiHit(hitData: any) {
    try {
      // 1. Try to publish to queue
      await this.publish(hitData);
      return { success: true, status: 'queued' };
    } catch (error) {
      // Fallback or graceful degradation
      return { success: false, status: 'failed_to_queue', error: (error as Error).message };
    }
  }

  async processQueueMessage(message: any) {
    let retries = 3;
    while (retries > 0) {
      try {
        await this.saveToDb(message);
        return { success: true };
      } catch (error) {
        retries--;
        if (retries === 0) {
          // Send to Dead Letter Queue (DLQ)
          return { success: false, status: 'sent_to_dlq' };
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    return { success: false }; // Fallback return
  }
}

describe('System Resilience Tests', () => {
  it('should handle RabbitMQ unavailability gracefully', async () => {
    const system = new MockSystem();
    system.isRabbitMqUp = false; // Simulate queue down

    const result = await system.ingestApiHit({ data: 'test' });
    
    // The system shouldn't crash
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed_to_queue');
    expect(result.error).toBe('RabbitMQ connection failed');
  });

  it('should retry saving to DB when DB is temporarily down and eventually succeed', async () => {
    const system = new MockSystem();
    system.isDbUp = false; // Simulate DB down

    // Setup an event to bring DB back up after a short time
    setTimeout(() => {
      system.isDbUp = true;
    }, 10);

    const result = await system.processQueueMessage({ data: 'test' });
    
    // Should succeed because it retries
    expect(result?.success).toBe(true);
  });

  it('should send to Dead Letter Queue if DB is permanently down', async () => {
    const system = new MockSystem();
    system.isDbUp = false; // Permanently down

    const result = await system.processQueueMessage({ data: 'test' });
    
    expect(result?.success).toBe(false);
    expect(result?.status).toBe('sent_to_dlq');
  });
});
