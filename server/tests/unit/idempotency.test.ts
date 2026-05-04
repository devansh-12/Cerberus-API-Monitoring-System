import { describe, it, expect, beforeEach } from '@jest/globals';

class MockProcessor {
  private processedMessageIds: Set<string> = new Set();
  public records: any[] = [];

  async processMessage(message: { id: string; data: any }) {
    // Idempotency check: if already processed, return success without duplicating
    if (this.processedMessageIds.has(message.id)) {
      return { success: true, status: 'already_processed' };
    }

    // Process and store
    this.records.push({ messageId: message.id, ...message.data });
    
    // Mark as processed
    this.processedMessageIds.add(message.id);
    
    return { success: true, status: 'processed' };
  }
}

describe('Idempotency Tests', () => {
  let processor: MockProcessor;

  beforeEach(() => {
    processor = new MockProcessor();
  });

  it('should process a new message correctly', async () => {
    const msg = { id: 'msg-1', data: { value: 100 } };
    
    const result = await processor.processMessage(msg);
    
    expect(result.status).toBe('processed');
    expect(processor.records.length).toBe(1);
    expect(processor.records[0].value).toBe(100);
  });

  it('should not process the exact same message twice (duplicate delivery)', async () => {
    const msg = { id: 'msg-1', data: { value: 100 } };
    
    // First delivery
    const result1 = await processor.processMessage(msg);
    expect(result1.status).toBe('processed');
    expect(processor.records.length).toBe(1);

    // Duplicate delivery
    const result2 = await processor.processMessage(msg);
    
    // The processor should acknowledge but NOT duplicate data
    expect(result2.status).toBe('already_processed');
    expect(processor.records.length).toBe(1); // Still 1
  });

  it('should process different messages with same data but different IDs', async () => {
    const msg1 = { id: 'msg-1', data: { value: 100 } };
    const msg2 = { id: 'msg-2', data: { value: 100 } }; // Same data, different ID
    
    await processor.processMessage(msg1);
    await processor.processMessage(msg2);
    
    expect(processor.records.length).toBe(2);
  });
});
