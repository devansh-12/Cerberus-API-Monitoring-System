import crypto from 'crypto';
import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import { EVENT_TYPES } from '../../../shared/events/eventContracts.js';
import { EventProducer } from '../../../shared/events/producers/eventProducer.js';

export interface IngestServiceDependencies {
  eventProducer: EventProducer;
}

export interface ApiHitData {
  ClientId: string;
  ApiKeyId: string;
  endpoint: string;
  method: string;
  [key: string]: any;
}

/**
 * Service class responsible for handling API hit ingestion.
 */
export class IngestService {
  private eventProducer: EventProducer;

  constructor({ eventProducer }: IngestServiceDependencies) {
    if (!eventProducer) throw new Error('IngestService requires eventProducer');
    this.eventProducer = eventProducer;
  }

  /**
   * Ingests an API hit by publishing it as an event to the message queue.
   */
  async ingestApiHit(hitData: ApiHitData) {
    try {
      logger.debug('IngestService: Processing API hit', {
        clientId: hitData.ClientId,
        endpoint: hitData.endpoint,
        method: hitData.method,
      });

      const eventId = crypto.randomUUID();
      const eventData = {
        ...hitData,
        eventId,
        timestamp: new Date().toISOString(),
      };

      const published = await this.eventProducer.publishApiHit(eventData as any);

      if (!published) {
         return {
            status: 'rejected',
            eventId,
            reason: 'Circuit breaker open',
         };
      }

      logger.info('IngestService: API hit published successfully', {
        eventId,
        clientId: hitData.ClientId,
      });

      return {
        status: 'published',
        eventId,
      };
    } catch (error) {
      logger.error('IngestService: Failed to ingest API hit', {
        error: (error as Error).message,
        clientId: hitData.ClientId,
      });
      throw error;
    }
  }
}
