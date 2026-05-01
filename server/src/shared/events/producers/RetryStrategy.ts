/**
 * List of error message patterns and codes that are considered retryable.
 */
const RETRYABLE_PATTERNS: readonly string[] = [
  'channel closed',
  'connection closed',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'buffer full',
  'heartbeat timeout',
  'not available',
  'server connection closed',
];

/**
 * Determines if an error is retryable based on its message or code.
 */
export function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const error = err as { message?: string; code?: string };
  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toUpperCase();

  if (code === 'ENOTFOUND') return true;

  return RETRYABLE_PATTERNS.some(
    (p) => msg.includes(p.toLowerCase()) || code.includes(p.toUpperCase()),
  );
}

export interface RetryStrategyOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
}

/**
 * Implements a retry strategy with exponential backoff and jitter for handling
 * transient errors when publishing messages to RabbitMQ.
 */
export class RetryStrategy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterFactor: number;

  constructor(opts: RetryStrategyOptions = {}) {
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 200;
    this.maxDelayMs = opts.maxDelayMs ?? 5000;
    this.jitterFactor = opts.jitterFactor ?? 0.3;
  }

  shouldRetry(attempt: number): boolean {
    return attempt < this.maxRetries;
  }

  delay(attempt: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelayMs);
    const jitterRange = capped * this.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(0, Math.round(capped + jitter));
  }

  wait(attempt: number): Promise<void> {
    const ms = this.delay(attempt);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
