import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/server.js';

// Mock all external connections to ensure no real DB is hit
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


// Mock authentication to bypass JWT check
jest.mock('../../src/shared/middlewares/authenticate.js', () => {
  return jest.fn((req: any, res: any, next: any) => {
    req.user = { userId: 'admin-123', role: 'super_admin' };
    next();
  });
});

// Mock the ClientService
import { ClientService } from '../../src/services/client/services/clientService.js';
jest.mock('../../src/services/client/services/clientService.js');

describe('Client Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/client/admin/clients', () => {
    it('should return a list of clients', async () => {
      const mockClients = [{ _id: 'client1', name: 'Test Client' }];
      // clientController calls clientService.clientRepository.find
      ClientService.prototype.clientRepository = { find: jest.fn().mockResolvedValue(mockClients as never) } as any;

      const response = await request(app).get('/api/client/admin/clients');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Client');
    });
  });

  describe('POST /api/client/admin/clients/onboard', () => {
    it('should onboard a new client', async () => {
      const mockNewClient = { _id: 'client2', name: 'New Client', status: 'pending' };
      ClientService.prototype.createClient = jest.fn().mockResolvedValue(mockNewClient as never) as any;

      const response = await request(app)
        .post('/api/client/admin/clients/onboard')
        .send({ name: 'New Client' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Client');
      expect(ClientService.prototype.createClient).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Client' }),
        expect.objectContaining({ userId: 'admin-123' })
      );
    });
  });

  describe('POST /api/client/admin/clients/:clientId/api/keys', () => {
    it('should create an API key for a client', async () => {
      const mockKey = { keyId: 'key-123', keyValue: 'secret-key-value', environment: 'production' };
      ClientService.prototype.createApiKey = jest.fn().mockResolvedValue(mockKey as never) as any;

      const response = await request(app)
        .post('/api/client/admin/clients/client1/api/keys')
        .send({ environment: 'production', name: 'Prod Key' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.keyId).toBe('key-123');
      expect(response.body.data.keyValue).toBe('secret-key-value');
      expect(ClientService.prototype.createApiKey).toHaveBeenCalledWith(
        'client1',
        expect.objectContaining({ environment: 'production' }),
        expect.objectContaining({ userId: 'admin-123' })
      );
    });
  });
});
