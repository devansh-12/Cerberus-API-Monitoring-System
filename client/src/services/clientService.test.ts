import { describe, it, expect } from 'vitest';
import { listClients, createClient } from './clientService';

describe('clientService Integration Tests', () => {
  it('should list clients fetched from the backend', async () => {
    const clients = await listClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe('Test Client 1');
    expect(clients[0].status).toBe('active');
  });

  it('should successfully onboard a new client', async () => {
    const newClient = await createClient({ name: 'Acme Corp' });
    expect(newClient).toBeDefined();
    expect(newClient.name).toBe('Acme Corp');
    expect(newClient.status).toBe('pending');
  });
});
