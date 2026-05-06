import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/server.js';

// Mock DB/Queue connections
jest.mock('../../src/shared/config/mongodb.js', () => ({
  default: { connect: jest.fn(), disconnect: jest.fn() }
}));
jest.mock('../../src/shared/config/postgres.js', () => ({
  default: { testConnection: jest.fn(), close: jest.fn() }
}));
jest.mock('../../src/shared/config/rabbitmq.js', () => ({
  default: { connect: jest.fn(), close: jest.fn() }
}));
jest.mock('../../src/shared/config/redis.js', () => ({
  default: { getClient: jest.fn().mockReturnValue({ on: jest.fn(), get: jest.fn(), set: jest.fn() }) }
}));

describe('API Contract Tests', () => {
  describe('Health Check endpoint', () => {
    it('should return a valid health check schema', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
    });
  });

  describe('Auth Login endpoint', () => {
    it('should enforce required fields (username, password)', async () => {
      const response = await request(app).post('/api/auth/login').send({});
      expect(response.status).toBe(400); // Bad request due to validation
      expect(response.body).toHaveProperty('success', false);
      // It should ideally have error details
      expect(response.body).toHaveProperty('errors');
    });

    it('should return proper content-type', async () => {
      const response = await request(app).post('/api/auth/login').send({});
      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Global 404 Handler', () => {
    it('should return a standard error format for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-route');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Endpoint not found');
      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });
});
