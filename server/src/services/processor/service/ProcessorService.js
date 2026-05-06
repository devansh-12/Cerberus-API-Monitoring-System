import logger from '../../../shared/config/logger.js';

export class ProcessorService {
    constructor({ apiHitRepository, metricsRepository }) {
        if (!apiHitRepository || !metricsRepository) throw new Error('ProcessorService requires apiHitRepository and metricsRepository');
        this.apiHitRepository = apiHitRepository;
        this.metricsRepository = metricsRepository;
    };

    getTimeBucket(timestamp, interval = 'hour') {
        const date = new Date(timestamp);

        switch (interval) {
            case 'hour':
                date.setMinutes(0, 0, 0);
                break;
            case 'day':
                date.setHours(0, 0, 0, 0);
                break;
            case 'minute':
                date.setSeconds(0, 0);
                break;
            default:
                date.setMinutes(0, 0, 0);
        }

        return date;
    };

    async processEvent(eventData) {
        let rawEventSaved = false;

        try {
            logger.info('Processing event data:', {
                eventId: eventData.eventId,
                clientId: eventData.clientId,
                serviceName: eventData.serviceName,
                endpoint: eventData.endpoint,
                method: eventData.method,
            });

            // STEP 1: save data to MongoDB
            // Yeh succeed hoga ya fir pura operation fail hoga
            await this.apiHitRepository.save(eventData)
            rawEventSaved = true;

            logger.info('Raw event saved to MongoD:', {
                eventId: eventData.eventId
            });

            // STEP 2: PG Main data upsert karege;
            // Agar ye fail ho gaya, to ham pure operation ko fail nhi karege!

            await this._updateMetricsWithFallback(eventData);

            logger.info('Event processed successfully:', {
                eventId: eventData.eventId
            });
        } catch (error) {
            if (!rawEventSaved) {
                logger.error('Critical: Failed to save raw event to MongoDB:', {
                    error: error.message,
                    eventId: eventData.eventId,
                });
                throw error;
            }

            logger.error('Non-critical: Raw event saved but metrics update failed:', {
                error: error.message,
                eventId: eventData.eventId,
            });
        }
    }

    async _updateMetricsWithFallback(eventData) {
        try {
            const timeBucket = this.getTimeBucket(eventData.timestamp, "hour");
            const statusCode = eventData.statusCode || 0;

            const metricsData = {
                clientId:      eventData.clientId.toString(),
                serviceName:   eventData.serviceName,
                endpoint:      eventData.endpoint,
                method:        eventData.method,
                timeBucket,

                // ── Existing latency metrics ──────────────────────────────────
                totalHits:     1,
                errorHits:     statusCode >= 400 ? 1 : 0,
                avgLatency:    eventData.latencyMs,
                minLatency:    eventData.latencyMs,
                maxLatency:    eventData.latencyMs,

                // ── Granular status code counters (new) ───────────────────────
                hits2xx:       statusCode >= 200 && statusCode < 300 ? 1 : 0,
                hits3xx:       statusCode >= 300 && statusCode < 400 ? 1 : 0,
                hits4xx:       statusCode >= 400 && statusCode < 500 ? 1 : 0,
                hits5xx:       statusCode >= 500                     ? 1 : 0,
                rateLimitHits: statusCode === 429                    ? 1 : 0,

                // ── Payload size metrics (new) ────────────────────────────────
                // Clients must include requestBytes / responseBytes in the hit payload.
                // Defaults to 0 if not provided so existing clients don't break.
                reqBytesTotal: eventData.requestBytes  || 0,
                resBytesTotal: eventData.responseBytes || 0,
            };

            await this.metricsRepository.upsertEndpointMetrics(metricsData);

            logger.info('Metrics updated successfully', { eventId: eventData.eventId });
        } catch (error) {
            throw error;
        }
    }

    async cleanupOldEvents(daysToKeeep = 30) {
        try {
            let cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeeep);

            const deletedCount = await this.apiHitRepository.deleteOldHits(cutoffDate)
            return deletedCount;
        } catch (error) {
            logger.error('Error during cleanup:', error);
            throw error;
        }
    }
}