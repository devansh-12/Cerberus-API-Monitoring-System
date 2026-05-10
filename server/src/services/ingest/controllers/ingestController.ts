import { Request, Response, NextFunction } from 'express';
import logger from '../../../shared/config/logger.js';
import ResponseFormatter from '../../../shared/utils/responseFormatter.js';
import { IngestService } from '../services/ingestService.js';

export interface IngestControllerDependencies {
  ingestService: IngestService;
}

/**
 * Controller class responsible for handling incoming requests to the ingest endpoint.
 */
export class IngestController {
  private ingestService: IngestService;

  constructor({ ingestService }: IngestControllerDependencies) {
    if (!ingestService) throw new Error('IngestController requires ingest service');
    this.ingestService = ingestService;
  }

  /**
   * Handles the incoming request to ingest an API hit.
   */
  async ingestHit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Ingest: Client data received', {
        clientId: (req as any).client._id,
        clientName: (req as any).client.name,
        clientKeys: Object.keys((req as any).client),
      });

      const hitData = {
        ...req.body,
        clientId: (req as any).client._id,
        apiKeyId: (req as any).apiKey._id,
        ip: req.ip || (req as any).connection?.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
      };

      logger.info('Ingest: Hit data prepared', {
        clientId: (req as any).client._id,
        endpoint: hitData.endpoint,
        method: hitData.method,
      });

      const result = await this.ingestService.ingestApiHit(hitData);

      if (result.status === 'rejected') {
        res.status(503).json(
          ResponseFormatter.error('Service temporarily unavailable', 503, {
            eventId: result.eventId,
            reason: result.reason,
            retryAfter: '30 seconds',
          })
        );
        return;
      }

      res.status(202).json(ResponseFormatter.success(result, 'API hit queued for processing', 202));
    } catch (error) {
      next(error);
    }
  }
}
