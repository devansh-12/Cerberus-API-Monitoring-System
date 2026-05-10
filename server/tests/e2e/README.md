# Playwright Integration Tests

Real integration tests hitting the actual backend API.

## Setup

```bash
npm install
```

## Running Tests

**Start the server first:**
```bash
npm run dev
```

**Run tests:**
```bash
npm run test:e2e
```

**Run tests with UI:**
```bash
npm run test:e2e:ui
```

## What's Tested

- Auth endpoints (login validation, profile auth requirement)
- Client endpoints (auth protection)
- API hit ingestion (API key validation)
- Health check endpoint
- 404 handler
- API contract compliance (JSON structure, status codes)

## Configuration

See `playwright.config.ts` for settings. Tests are in `tests/e2e/*.api.ts`.
