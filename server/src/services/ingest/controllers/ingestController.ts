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

      const rawBody = req.body;
      const hits = Array.isArray(rawBody) ? rawBody : [rawBody];

      const results = [];
      for (const hit of hits) {
        const hitData = {
          ...hit,
          ClientId: (req as any).client._id,
          ApiKeyId: (req as any).apiKey._id,
          ip: req.ip || (req as any).connection?.remoteAddress,
          userAgent: req.headers['user-agent'] || '',
        };

        logger.debug('Ingest: Hit data prepared', {
          clientId: hitData.ClientId,
          endpoint: hitData.endpoint,
          method: hitData.method,
        });

        const result = await this.ingestService.ingestApiHit(hitData);
        results.push(result);
      }

      const anyRejected = results.some(r => r.status === 'rejected');

      if (anyRejected) {
        res.status(503).json(
          ResponseFormatter.error('Service temporarily unavailable, some hits rejected', 503, [
            'Retry after 30 seconds',
            ...results.filter(r => r.status === 'rejected').map(r => JSON.stringify(r))
          ])
        );
        return;
      }

      res.status(202).json(ResponseFormatter.success({ processed: results.length, results }, 'API hit(s) queued for processing', 202));

    } catch (error) {
      next(error);
    }
  }
}
