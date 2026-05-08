import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import { EVENT_TYPES } from '../../../shared/events/eventContracts.js';
import { IEventProducer } from '../../../shared/events/producers/eventProducer.js';

export interface IngestServiceDependencies {
  eventProducer: IEventProducer;
}

export interface ApiHitData {
  clientId: string;
  endpoint: string;
  method: string;
  [key: string]: any;
}

/**
 * Service class responsible for handling API hit ingestion.
 */
export class IngestService {
  private eventProducer: IEventProducer;

  constructor({ eventProducer }: IngestServiceDependencies) {
    if (!eventProducer) throw new Error('IngestService requires eventProducer');
    this.eventProducer = eventProducer;
  }

  /**
   * Ingests an API hit by publishing it as an event to the message queue.
   */
  async ingestApiHit(hitData: ApiHitData) {
    try {
      logger.info('IngestService: Processing API hit', {
        clientId: hitData.clientId,
        endpoint: hitData.endpoint,
        method: hitData.method,
      });

      const eventData = {
        ...hitData,
        timestamp: new Date().toISOString(),
      };

      const result = await this.eventProducer.publish(EVENT_TYPES.API_HIT, eventData);

      logger.info('IngestService: API hit published successfully', {
        eventId: result.eventId,
        clientId: hitData.clientId,
      });

      return result;
    } catch (error) {
      logger.error('IngestService: Failed to ingest API hit', {
        error: (error as Error).message,
        clientId: hitData.clientId,
      });
      throw error;
    }
  }
}
