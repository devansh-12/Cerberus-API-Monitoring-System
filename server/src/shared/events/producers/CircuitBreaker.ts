export const CircuitState = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
} as const);

export type CircuitStateType = (typeof CircuitState)[keyof typeof CircuitState];

export interface CircuitBreakerSnapshot {
  state: CircuitStateType;
  failures: number;
  lastFailureTime: number;
  halfOpenAttempts: number;
  halfOpenSuccesses: number;
  cooldownMs: number;
  failureThreshold: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenMaxAttempts?: number;
  logger?: Pick<Console, 'info' | 'warn' | 'error' | 'debug'>;
}

/**
 * A simple implementation of the Circuit Breaker pattern.
 * Transitions between CLOSED → OPEN → HALF_OPEN → CLOSED states
 * based on success/failure counts.
 */
export class CircuitBreaker {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
  readonly halfOpenMaxAttempts: number;
  private readonly _logger: Pick<Console, 'info' | 'warn' | 'error' | 'debug'>;

  private _state: CircuitStateType;
  private _failures: number;
  private _lastFailureTime: number;
  private _halfOpenAttempts: number;
  private _halfOpenSuccesses: number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
    this.halfOpenMaxAttempts = opts.halfOpenMaxAttempts ?? 3;
    this._logger = opts.logger ?? console;

    this._state = CircuitState.CLOSED;
    this._failures = 0;
    this._lastFailureTime = 0;
    this._halfOpenAttempts = 0;
    this._halfOpenSuccesses = 0;
  }

  private _cooldownElapsed(): boolean {
    return Date.now() - this._lastFailureTime >= this.cooldownMs;
  }

  private _transitionTo(newState: CircuitStateType): void {
    const prev = this._state;
    this._state = newState;
    this._logger.info(`[CircuitBreaker] ${prev} => ${newState}`);

    if (newState === CircuitState.HALF_OPEN) {
      this._halfOpenAttempts = 0;
      this._halfOpenSuccesses = 0;
      this._logger.info(`[CircuitBreaker] ${prev} => HALF_OPEN`);
    }
  }

  private _openCircuit(): void {
    this._lastFailureTime = Date.now();
    this._transitionTo(CircuitState.OPEN);
    this._logger.error('[CircuitBreaker] OPEN', {
      failures: this._failures,
      cooldownMs: this.cooldownMs,
    });
  }

  private _reset(): void {
    this._state = CircuitState.CLOSED;
    this._failures = 0;
    this._halfOpenAttempts = 0;
    this._halfOpenSuccesses = 0;
    this._logger.info('[CircuitBreaker] HALF_OPEN => CLOSED');
  }

  get state(): CircuitStateType {
    if (this._state === CircuitState.OPEN && this._cooldownElapsed()) {
      this._transitionTo(CircuitState.HALF_OPEN);
    }
    return this._state;
  }

  allowRequest(): boolean {
    const current = this.state;

    this._logger.debug('[CircuitBreaker] allowRequest check', {
      state: current,
      halfOpenAttempts: this._halfOpenAttempts,
      halfOpenMaxAttempts: this.halfOpenMaxAttempts,
      halfOpenSuccesses: this._halfOpenSuccesses,
      failures: this._failures,
    });

    if (current === CircuitState.CLOSED) return true;

    if (current === CircuitState.HALF_OPEN) {
      if (this._halfOpenAttempts < this.halfOpenMaxAttempts) {
        this._halfOpenAttempts++;
        this._logger.info(
          `[CircuitBreaker] allowing HALF_OPEN attempt ${this._halfOpenAttempts}/${this.halfOpenMaxAttempts}`,
        );
        return true;
      }
      this._logger.warn(
        `[CircuitBreaker] HALF_OPEN attempts exhausted (${this._halfOpenAttempts}/${this.halfOpenMaxAttempts})`,
      );
      return false;
    }

    this._logger.info(`[CircuitBreaker] rejecting request, state: ${current}`);
    return false;
  }

  onSuccess(): void {
    this._logger.info('[CircuitBreaker] success recorded', {
      state: this._state,
      halfOpenSuccesses: this._halfOpenSuccesses,
      halfOpenMaxAttempts: this.halfOpenMaxAttempts,
      failures: this._failures,
    });

    if (this._state === CircuitState.HALF_OPEN) {
      this._halfOpenSuccesses++;
      this._logger.info(
        `[CircuitBreaker] HALF_OPEN success ${this._halfOpenSuccesses}/${this.halfOpenMaxAttempts}`,
      );
      if (this._halfOpenSuccesses >= this.halfOpenMaxAttempts) {
        this._reset();
        this._logger.info('[CircuitBreaker] reset to CLOSED after successful half-open probes');
      }
      return;
    }

    if (this._failures > 0) {
      this._failures = 0;
      this._logger.info('[CircuitBreaker] failure counter reset after success');
    }
  }

  onFailure(): void {
    this._logger.error('[CircuitBreaker] failure recorded', {
      state: this._state,
      failures: this._failures,
      failureThreshold: this.failureThreshold,
    });

    if (this._state === CircuitState.HALF_OPEN) {
      this._logger.warn('[CircuitBreaker] half-open failed, reopening circuit');
      this._openCircuit();
      return;
    }

    this._failures++;
    this._lastFailureTime = Date.now();
    this._logger.info(`[CircuitBreaker] failure count: ${this._failures}/${this.failureThreshold}`);

    if (this._failures >= this.failureThreshold) {
      this._openCircuit();
    }
  }

  snapshot(): CircuitBreakerSnapshot {
    return {
      state: this.state,
      failures: this._failures,
      lastFailureTime: this._lastFailureTime,
      halfOpenAttempts: this._halfOpenAttempts,
      halfOpenSuccesses: this._halfOpenSuccesses,
      cooldownMs: this.cooldownMs,
      failureThreshold: this.failureThreshold,
    };
  }
}
