import { describe, it, expect } from 'vitest';
import { login, getProfile, logout } from './authService';

describe('authService Integration Tests', () => {
  it('should successfully login with valid credentials', async () => {
    const user = await login({ email: 'admin@cerberus.test', password: 'admin123' });
    expect(user).toBeDefined();
    expect(user.role).toBe('super_admin');
    expect(user.email).toBe('admin@cerberus.test');
  });

  it('should fetch user profile', async () => {
    const user = await getProfile();
    expect(user).toBeDefined();
    expect(user.username).toBe('admin');
  });

  it('should handle logout successfully', async () => {
    await expect(logout()).resolves.toBeUndefined();
  });
});
