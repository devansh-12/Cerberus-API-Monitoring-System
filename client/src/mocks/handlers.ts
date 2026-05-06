import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth handlers
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email === 'admin@cerberus.test' && body.password === 'admin123') {
      return HttpResponse.json({
        success: true,
        data: {
          userId: 'user-123',
          username: 'admin',
          email: 'admin@cerberus.test',
          role: 'super_admin'
        }
      });
    }
    return HttpResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
  }),
  
  http.get('/api/auth/profile', () => {
    return HttpResponse.json({
      success: true,
      data: {
        userId: 'user-123',
        username: 'admin',
        email: 'admin@cerberus.test',
        role: 'super_admin'
      }
    });
  }),

  http.get('/api/auth/logout', () => {
    return HttpResponse.json({ success: true, message: 'Logged out successfully' });
  }),

  // Client handlers
  http.get('/api/client/admin/clients', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          _id: 'client-1',
          name: 'Test Client 1',
          slug: 'test-client-1',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ]
    });
  }),
  
  http.post('/api/client/admin/clients/onboard', async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json({
      success: true,
      data: {
        _id: 'client-new',
        name: body.name || 'New Client',
        slug: 'new-client',
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    });
  })
];
