import { sendPostRequest } from './client';

export interface ApiHit {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  serviceName: string;
  requestBytes?: number;
  responseBytes?: number;
}

export interface BatcherOptions {
  url: string;
  apiKey: string;
  batchSize?: number; // Defaults to 100
  flushIntervalMs?: number; // Defaults to 1000
}

export class HitBatcher {
  private queue: ApiHit[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly apiKey: string;

  constructor(options: BatcherOptions) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.batchSize = options.batchSize ?? 100;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
  }

  public enqueue(hit: ApiHit): void {
    this.queue.push(hit);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.flushIntervalMs);
    }
  }

  public async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    // Take up to batchSize items from the queue
    const hitsToProcess = this.queue.splice(0, this.batchSize);

    try {
      // Fire all concurrently to the single-hit endpoint
      const results = await Promise.allSettled(
        hitsToProcess.map(hit =>
          sendPostRequest(
            this.url,
            { 'x-api-key': this.apiKey },
            JSON.stringify(hit)
          )
        )
      );

      // Handle partial failures (silently or maybe requeue - but for now silently discard to avoid memory bloat)
      // Cerberus is non-critical — never surface this error
      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
          // You could optionally requeue hits here, but usually it's best to drop monitoring metrics
          // during an outage rather than exhausting memory or creating a retry storm.
      }
    } catch (err) {
      // Catch any unexpected errors (e.g. issues with Promise.allSettled itself, though unlikely)
    }

    // If there are still items in the queue (e.g. queue was larger than batchSize), schedule another flush
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }
}
