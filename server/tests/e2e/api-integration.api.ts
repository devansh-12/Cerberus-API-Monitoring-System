import { test, expect } from "@playwright/test";

/**
 * Real integration tests hitting actual backend
 * Requires: npm run dev (server running on port 5000)
 */

test.describe("Auth API Integration Tests", () => {
  test("POST /api/auth/login - validation rejects missing password", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/login", {
      data: { username: "testuser" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("GET /api/auth/profile - rejects without auth token", async ({
    request,
  }) => {
    const response = await request.get("/api/auth/profile");
    expect(response.status()).toBe(401);
  });

  test("GET /health - returns healthy status", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data).toHaveProperty("timestamp");
    expect(body.data).toHaveProperty("uptime");
  });
});

test.describe("Client API Integration Tests", () => {
  test("GET /api/client/admin/clients - rejects without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/client/admin/clients");
    expect(response.status()).toBe(401);
  });

  test("POST /api/hit - rejects without API key", async ({ request }) => {
    const response = await request.post("/api/hit");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.message).toMatch(/api key is required/i);
  });

  test("404 handler - returns standard error format", async ({ request }) => {
    const response = await request.get("/api/unknown-route");
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Endpoint not found");
    expect(body.statusCode).toBe(404);
  });
});

test.describe("API Contract Tests", () => {
  test("all responses have consistent JSON structure", async ({ request }) => {
    const endpoints = [
      { method: "get", path: "/health" },
      { method: "post", path: "/api/auth/login", data: {} },
      { method: "get", path: "/api/client/admin/clients" },
      { method: "post", path: "/api/hit" },
    ];

    for (const { method, path, data } of endpoints) {
      const response = await request[method as keyof typeof request](path, {
        data,
      });
      expect(response.headers()["content-type"]).toMatch(/json/);

      const body = await response.json();
      expect(body).toHaveProperty("success");
    }
  });

  test("error responses include proper status codes", async ({ request }) => {
    const errorCases = [
      { path: "/api/auth/login", expectedStatus: 400 },
      { path: "/api/unknown", expectedStatus: 404 },
    ];

    for (const { path, expectedStatus } of errorCases) {
      const response = await request.post(path, { data: {} });
      expect(response.status()).toBe(expectedStatus);
    }
  });
});
