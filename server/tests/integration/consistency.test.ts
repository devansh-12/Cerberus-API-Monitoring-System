import { jest, describe, it, expect } from '@jest/globals';

// A mock to represent the raw MongoDB storage
class MockMongoDb {
  data: any[] = [];
  async insert(item: any) {
    this.data.push(item);
  }
  async count() {
    return this.data.length;
  }
}

// A mock to represent the aggregated Postgres storage
class MockPostgresDb {
  data: any[] = [];
  async aggregate(item: any) {
    this.data.push(item);
  }
  async getAggregatedCount() {
    return this.data.length;
  }
}

describe('Data Consistency Tests (MongoDB + PostgreSQL Eventual Consistency)', () => {
  it('should ensure API hits appear in both DBs with eventual consistency', async () => {
    const mongo = new MockMongoDb();
    const postgres = new MockPostgresDb();

    // The consumer function that takes data from Mongo (via queue) and writes to Postgres
    const processQueueItem = async (item: any) => {
      // Simulate delay in processing
      await new Promise(resolve => setTimeout(resolve, 5));
      await postgres.aggregate(item);
    };

    // Simulate 100 API hits
    const hits = Array.from({ length: 100 }, (_, i) => ({ id: i, hit: true }));

    for (const hit of hits) {
      await mongo.insert(hit);
      // Fire and forget queue processing
      processQueueItem(hit);
    }

    // Immediately check Mongo - should be 100
    expect(await mongo.count()).toBe(100);

    // Immediately check Postgres - likely not 100 yet (though in mock might be if sync)
    // Wait for the consumer to finish processing all 100
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify consistency
    const mongoCount = await mongo.count();
    const pgCount = await postgres.getAggregatedCount();

    expect(mongoCount).toBe(100);
    expect(pgCount).toBe(100);
    expect(mongoCount).toEqual(pgCount);
  });
});
