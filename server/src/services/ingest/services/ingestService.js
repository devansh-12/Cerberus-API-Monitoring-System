import logger from "../../../shared/config/logger.js"
import AppError from "../../../shared/utils/AppError.js"
import { EVENT_TYPES } from "../../../shared/events/eventContracts.js"

/**
 * Service class responsible for handling API hit ingestion.
 * Publishes API hit events to RabbitMQ for async processing.
 */
export class IngestService {
    constructor({ eventProducer }) {
        if (!eventProducer) throw new Error("IngestService requires eventProducer");
        this.eventProducer = eventProducer;
    }

    /**
     * Ingests an API hit by publishing it as an event to the message queue.
     * @param {Object} hitData - The API hit data to be ingested.
     * @returns {Object} - Result of the ingestion with status and event ID.
     */
    async ingestApiHit(hitData) {
        try {
            logger.info('IngestService: Processing API hit', {
                clientId: hitData.clientId,
                endpoint: hitData.endpoint,
                method: hitData.method
            });

            const eventData = {
                ...hitData,
                timestamp: new Date().toISOString()
            };

            const result = await this.eventProducer.publish(EVENT_TYPES.API_HIT, eventData);

            logger.info('IngestService: API hit published successfully', {
                eventId: result.eventId,
                clientId: hitData.clientId
            });

            return result;
        } catch (error) {
            logger.error('IngestService: Failed to ingest API hit', {
                error: error.message,
                clientId: hitData.clientId
            });
            throw error;
        }
    }
}