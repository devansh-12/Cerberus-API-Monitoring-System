import express from 'express';
import ingestContainer from '../Dependencies/dependencies.js';
import validateApiKey from '../../../shared/middlewares/validateApiKey.js';
import { ingestRateLimiter } from '../../../shared/middlewares/rateLimiter.js';

const router = express.Router();
const { ingestController } = ingestContainer;

// Two-stage middleware chain:
//   1. validateApiKey  — authenticates the request (Redis cache → DB)
//   2. ingestRateLimiter — enforces per-client rate limits (Redis, global across pods)
router.post('/', validateApiKey, ingestRateLimiter, (req, res, next) =>
  ingestController.ingestHit(req, res, next)
);

export default router;
