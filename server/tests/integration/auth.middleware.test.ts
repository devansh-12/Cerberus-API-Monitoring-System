import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import authenticate from '../../src/shared/middlewares/authenticate.js';
// @ts-ignore
import authorize from '../../src/shared/middlewares/authorize.js';
import jwt from 'jsonwebtoken';
import config from '../../src/shared/config/index.js';
import cookieParser from 'cookie-parser';

// Removed config overrides

const app = express();
app.use(express.json());
app.use(cookieParser());

// Protected route
app.get('/protected', authenticate, (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Authenticated' });
});

// Admin-only route
app.get('/admin', authenticate, authorize(['ADMIN']) as any, (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Admin Authorized' });
});

describe('Authentication & Authorization Tests', () => {
  const secret = config.jwt.secret;

  describe('Authentication Middleware', () => {
    it('should reject requests without a token', async () => {
      const response = await request(app).get('/protected');
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication token is required');
    });

    it('should reject requests with an invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Cookie', ['authToken=invalid.token.here']);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should reject requests with an expired token', async () => {
      const expiredToken = jwt.sign({ userId: '123' }, secret, { expiresIn: '-1h' });
      const response = await request(app)
        .get('/protected')
        .set('Cookie', [`authToken=${expiredToken}`]);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token expired');
    });

    it('should allow requests with a valid token', async () => {
      const validToken = jwt.sign({ userId: '123', role: 'USER' }, secret, { expiresIn: '1h' });
      const response = await request(app)
        .get('/protected')
        .set('Cookie', [`authToken=${validToken}`]);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authenticated');
    });
  });

  describe('Authorization Middleware', () => {
    it('should allow access to admin routes for ADMIN role', async () => {
      const adminToken = jwt.sign({ userId: '123', role: 'ADMIN' }, secret, { expiresIn: '1h' });
      const response = await request(app)
        .get('/admin')
        .set('Cookie', [`authToken=${adminToken}`]);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin Authorized');
    });

    it('should deny access to admin routes for USER role', async () => {
      const userToken = jwt.sign({ userId: '123', role: 'USER' }, secret, { expiresIn: '1h' });
      const response = await request(app)
        .get('/admin')
        .set('Cookie', [`authToken=${userToken}`]);
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions');
    });
  });
});
