/**
 * Database Seeding Script
 *
 * Seeds MongoDB and PostgreSQL with valid, synchronized data respecting all
 * constraints and validation logic across microservices.
 *
 * Usage:
 *   node scripts/seed-database.js              # Default: 3 clients, 500 hits each
 *   node scripts/seed-database.js --clients 5 --hits 1000  # Custom amounts
 *   node scripts/seed-database.js --clean      # Clean existing data first
 */

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../.env") });

const { Pool } = pg;

// ─── Parse CLI arguments ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const config = {
  numClients: 3,
  numHitsPerClient: 500,
  clean: false,
  help: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--clients" && args[i + 1]) {
    config.numClients = Number.parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--hits" && args[i + 1]) {
    config.numHitsPerClient = Number.parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--clean") {
    config.clean = true;
  } else if (args[i] === "--help" || args[i] === "-h") {
    config.help = true;
  }
}

if (config.help) {
  console.log(`
Database Seeding Script

Usage:
  node scripts/seed-database.js [options]

Options:
  --clients <number>    Number of clients to create (default: 3)
  --hits <number>       Number of API hits per client (default: 500)
  --clean               Clean existing data before seeding
  --help, -h            Show this help message

Examples:
  node scripts/seed-database.js
  node scripts/seed-database.js --clients 5 --hits 1000
  node scripts/seed-database.js --clean --hits 2000
  `);
  process.exit(0);
}

// ─── MongoDB Models ──────────────────────────────────────────────────────────
// Import models after mongoose is configured
import User from "../src/shared/models/User.js";
import Client from "../src/shared/models/Client.js";
import ApiKey from "../src/shared/models/ApiKey.js";
import ApiHit from "../src/shared/models/ApiHits.js";

// ─── Helper Functions ────────────────────────────────────────────────────────

function getRandomItem(arr) {
  return arr[crypto.randomInt(0, arr.length)];
}

function getRandomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function getRandomFloat(min, max, decimals = 2) {
  return Number.parseFloat(
    (
      (crypto.randomBytes(4).readUInt32LE() / 0xffffffff) * (max - min) +
      min
    ).toFixed(decimals),
  );
}

// Fixed passwords - simple but meet all requirements (8+ chars, uppercase, lowercase, number, symbol)
function generatePassword() {
  return "Test@1234"; // Meets: 8 chars, uppercase T, lowercase est, numbers 1234, symbol @
}

// Generate random date within last 30 days
function getRandomDate(daysBack = 30) {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Date(
    past.getTime() +
      (crypto.randomBytes(4).readUInt32LE() / 0xffffffff) *
        (now.getTime() - past.getTime()),
  );
}

// Service definitions
const SERVICES = [
  {
    name: "user-service",
    endpoints: [
      "/api/users",
      "/api/users/:id",
      "/api/users/profile",
      "/api/users/settings",
    ],
  },
  {
    name: "payment-service",
    endpoints: [
      "/api/payments",
      "/api/payments/:id",
      "/api/payments/process",
      "/api/payments/refund",
    ],
  },
  {
    name: "order-service",
    endpoints: [
      "/api/orders",
      "/api/orders/:id",
      "/api/orders/status",
      "/api/orders/history",
    ],
  },
  {
    name: "notification-service",
    endpoints: [
      "/api/notifications",
      "/api/notifications/send",
      "/api/notifications/preferences",
    ],
  },
  {
    name: "analytics-service",
    endpoints: [
      "/api/analytics/dashboard",
      "/api/analytics/reports",
      "/api/analytics/export",
    ],
  },
];

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const STATUS_CODES = {
  success: [200, 201, 204],
  clientError: [400, 401, 403, 404, 429],
  serverError: [500, 502, 503],
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
  "PostmanRuntime/7.32.3",
  "axios/1.6.0",
];

const IPS = [
  "203.0.113.45",
  "198.51.100.78",
  "192.0.2.123",
  "100.24.56.78", // NOSONAR
  "52.14.89.123",
  "34.120.56.78",
  "13.45.67.89",
  "104.18.23.45", // NOSONAR
];

// ─── Main Seeding Function ───────────────────────────────────────────────────

async function seedDatabase() { // NOSONAR
  let mongoConn;
  let pgPool;

  try {
    console.log("🌱 Starting database seeding...\n");
    console.log("Configuration:", JSON.stringify(config, null, 2));

    // ── Connect to MongoDB ─────────────────────────────────────────────────
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/cerberus";
    console.log(`\n📦 Connecting to MongoDB: ${mongoUri}`);
    mongoConn = await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected");

    // ── Connect to PostgreSQL ──────────────────────────────────────────────
    const pgConfig = {
      host: process.env.PG_HOST || process.env.POSTGRES_HOST || "localhost",
      port: parseInt(
        process.env.PG_PORT || process.env.POSTGRES_PORT || "5432",
        10,
      ),
      database:
        process.env.PG_DATABASE || process.env.POSTGRES_DB || "cerberus",
      user: process.env.PG_USER || process.env.POSTGRES_USER || "postgres",
      password:
        process.env.PG_PASSWORD || process.env.POSTGRES_PASSWORD || "postgres",
    };
    console.log(
      `\n📦 Connecting to PostgreSQL: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`,
    );
    pgPool = new Pool(pgConfig);
    await pgPool.query("SELECT 1");
    console.log("✅ PostgreSQL connected");

    // ── Clean existing data if requested ───────────────────────────────────
    if (config.clean) {
      console.log("\n🧹 Cleaning existing data...");

      // MongoDB cleanup
      await ApiHit.deleteMany({});
      await ApiKey.deleteMany({});
      await Client.deleteMany({});
      await User.deleteMany({});
      console.log("✅ MongoDB collections cleaned");

      // PostgreSQL cleanup
      await pgPool.query("DELETE FROM endpoint_metrics");
      console.log("✅ PostgreSQL tables cleaned");
    }

    // ── Create Super Admin User ────────────────────────────────────────────
    console.log("\n👤 Creating super admin user...");
    const superAdminPassword = generatePassword();
    const superAdmin = await User.create({
      username: "superadmin",
      email: "superadmin@cerberus.io",
      password: superAdminPassword,
      role: "super_admin",
      isActive: true,
      permissions: {
        canCreateApiKeys: true,
        canManageUsers: true,
        canViewAnalytics: true,
        canExportData: true,
      },
    });
    console.log(
      `✅ Super admin created: ${superAdmin.username} (${superAdmin.email})`,
    );
    console.log(`   Password: ${superAdminPassword}`);

    // ── Create Client Data ─────────────────────────────────────────────────
    console.log(`\n🏢 Creating ${config.numClients} clients...`);
    const clients = [];
    const clientAdmins = [];
    const clientViewers = [];
    const apiKeys = [];

    const clientTemplates = [
      {
        name: "Acme Corporation",
        slug: "acme-corp",
        email: "admin@acme.io",
        website: "https://acme.io",
      },
      {
        name: "TechStart Inc",
        slug: "techstart",
        email: "admin@techstart.io",
        website: "https://techstart.io",
      },
      {
        name: "DataFlow Systems",
        slug: "dataflow",
        email: "admin@dataflow.io",
        website: "https://dataflow.io",
      },
      {
        name: "CloudNine Solutions",
        slug: "cloudnine",
        email: "admin@cloudnine.io",
        website: "https://cloudnine.io",
      },
      {
        name: "NexGen Analytics",
        slug: "nexgen",
        email: "admin@nexgen.io",
        website: "https://nexgen.io",
      },
    ];

    for (let i = 0; i < config.numClients; i++) {
      const template = clientTemplates[i % clientTemplates.length];
      const clientPassword = generatePassword();
      const viewerPassword = generatePassword();

      // Create a temporary admin user first (with super_admin role to bypass clientId requirement)
      const tempAdminUser = await User.create({
        username: `temp-${template.slug}-admin`,
        email: `temp-${template.email}`,
        password: clientPassword,
        role: "super_admin", // Temp role to bypass clientId requirement
        isActive: true,
        permissions: {
          canCreateApiKeys: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canExportData: true,
        },
      });

      // Create client with the temp admin as createdBy
      const client = await Client.create({
        name: template.name,
        slug: template.slug,
        email: template.email,
        description: `${template.name} - API monitoring client`,
        website: template.website,
        createdBy: tempAdminUser._id,
        isActive: true,
        settings: {
          dataRetentionDays: 30,
          alertsEnabled: true,
          timezone: "UTC",
        },
      });

      // Now create the actual client admin user with clientId
      const adminUser = await User.create({
        username: `${template.slug}-admin`,
        email: template.email,
        password: clientPassword,
        role: "client_admin",
        clientId: client._id,
        isActive: true,
        permissions: {
          canCreateApiKeys: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canExportData: true,
        },
      });

      // Create client viewer user
      const viewerUser = await User.create({
        username: `${template.slug}-viewer`,
        email: `viewer@${template.slug}.io`,
        password: viewerPassword,
        role: "client_viewer",
        clientId: client._id,
        isActive: true,
        permissions: {
          canCreateApiKeys: false,
          canManageUsers: false,
          canViewAnalytics: true,
          canExportData: false,
        },
      });

      // Delete the temporary admin user
      await User.deleteOne({ _id: tempAdminUser._id });

      // Create API keys for the client
      const environments = ["production", "staging", "development"];
      const clientApiKeys = [];

      // Update client's createdBy to point to the actual admin user (not the temp one)
      client.createdBy = adminUser._id;
      await client.save();

      for (const env of environments) {
        const apiKeyRecord = await ApiKey.create({
          keyId: `key_${uuidv4().replace(/-/g, "")}`,
          keyValue: `sk_${uuidv4().replace(/-/g, "")}`,
          ClientId: client._id,
          name: `${template.name} - ${env} key`,
          description: `API key for ${env} environment`,
          environment: env,
          isActive: true,
          permissions: {
            canIngest: true,
            canReadAnalytics: env === "production",
            allowedServices:
              env === "production" ? [] : ["user-service", "order-service"],
          },
          security: {
            allowedIPs: ["0.0.0.0/0"],
            allowedOrigins: ["*"],
            lastRotated: new Date(),
            rotationWarningDays: 30,
          },
          createdBy: adminUser._id,
        });
        clientApiKeys.push(apiKeyRecord);
      }

      clients.push(client);
      clientAdmins.push(adminUser);
      clientViewers.push(viewerUser);
      apiKeys.push(...clientApiKeys);

      console.log(`✅ Client ${i + 1}/${config.numClients}: ${client.name}`);
      console.log(
        `   Admin: ${adminUser.username} (${adminUser.email}) - Password: ${clientPassword}`,
      );
      console.log(
        `   Viewer: ${viewerUser.username} (${viewerUser.email}) - Password: ${viewerPassword}`,
      );
      console.log(
        `   API Keys: ${clientApiKeys.length} (${environments.join(", ")})`,
      );
    }

    // ── Generate API Hits and Metrics ──────────────────────────────────────
    console.log(
      `\n📊 Generating ${config.numHitsPerClient} API hits per client...`,
    );

    const allApiHits = [];
    const metricsMap = new Map(); // Key: `${clientId}_${serviceName}_${endpoint}_${method}_${timeBucket}`, Value: metrics

    for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
      const client = clients[clientIndex];
      const clientKeys = apiKeys.filter(
        (k) => k.ClientId.toString() === client._id.toString(),
      );

      for (let hitIndex = 0; hitIndex < config.numHitsPerClient; hitIndex++) {
        const service = getRandomItem(SERVICES);
        const endpoint = getRandomItem(service.endpoints);
        const method = getRandomItem(METHODS);

        // Weighted status code distribution: 70% success, 20% client error, 10% server error
        const statusRand = Math.random();
        let statusCode;
        if (statusRand < 0.7) {
          statusCode = getRandomItem(STATUS_CODES.success);
        } else if (statusRand < 0.9) {
          statusCode = getRandomItem(STATUS_CODES.clientError);
        } else {
          statusCode = getRandomItem(STATUS_CODES.serverError);
        }

        const timestamp = getRandomDate(30);
        const latencyMs = getRandomFloat(10, 2000, 2);
        const apiKey = getRandomItem(clientKeys);
        const requestBytes = getRandomInt(100, 5000);
        const responseBytes = getRandomInt(200, 15000);

        // Create API hit record for MongoDB
        const apiHit = {
          eventId: uuidv4(),
          timestamp,
          serviceName: service.name,
          endpoint,
          method,
          statusCode,
          latencyMs,
          ClientId: client._id,
          ApiKeyId: apiKey._id,
          ip: getRandomItem(IPS),
          userAgent: getRandomItem(USER_AGENTS),
        };
        allApiHits.push(apiHit);

        // Aggregate metrics for PostgreSQL (hourly buckets)
        const timeBucket = new Date(timestamp);
        timeBucket.setMinutes(0, 0, 0); // Round to hour

        const metricKey = `${client._id}_${service.name}_${endpoint}_${method}_${timeBucket.toISOString()}`;

        if (!metricsMap.has(metricKey)) {
          metricsMap.set(metricKey, {
            clientId: client._id.toString(),
            serviceName: service.name,
            endpoint,
            method,
            timeBucket,
            totalHits: 0,
            errorHits: 0,
            latencies: [],
            hits2xx: 0,
            hits3xx: 0,
            hits4xx: 0,
            hits5xx: 0,
            rateLimitHits: 0,
            reqBytesTotal: 0,
            resBytesTotal: 0,
          });
        }

        const metric = metricsMap.get(metricKey);
        metric.totalHits++;
        if (statusCode >= 400) metric.errorHits++;
        metric.latencies.push(latencyMs);

        if (statusCode >= 200 && statusCode < 300) metric.hits2xx++;
        else if (statusCode >= 300 && statusCode < 400) metric.hits3xx++;
        else if (statusCode >= 400 && statusCode < 500) metric.hits4xx++;
        else if (statusCode >= 500) metric.hits5xx++;

        if (statusCode === 429) metric.rateLimitHits++;
        metric.reqBytesTotal += requestBytes;
        metric.resBytesTotal += responseBytes;
      }

      console.log(
        `✅ Generated ${config.numHitsPerClient} hits for ${client.name}`,
      );
    }

    // ── Insert API Hits into MongoDB ───────────────────────────────────────
    console.log("\n💾 Inserting API hits into MongoDB...");
    const BATCH_SIZE = 1000;

    for (let i = 0; i < allApiHits.length; i += BATCH_SIZE) {
      const batch = allApiHits.slice(i, i + BATCH_SIZE);
      await ApiHit.insertMany(batch, { ordered: false });
      console.log(
        `   Inserted ${Math.min(i + BATCH_SIZE, allApiHits.length)}/${allApiHits.length} hits`,
      );
    }
    console.log(`✅ MongoDB: ${allApiHits.length} API hits inserted`);

    // ── Insert Metrics into PostgreSQL ─────────────────────────────────────
    console.log("\n💾 Inserting aggregated metrics into PostgreSQL...");
    const metricsArray = Array.from(metricsMap.values());

    for (let i = 0; i < metricsArray.length; i += BATCH_SIZE) {
      const batch = metricsArray.slice(i, i + BATCH_SIZE);

      for (const metric of batch) {
        const avgLatency =
          metric.latencies.reduce((sum, val) => sum + val, 0) /
          metric.latencies.length;
        const minLatency = Math.min(...metric.latencies);
        const maxLatency = Math.max(...metric.latencies);

        const query = `
          INSERT INTO endpoint_metrics (
            client_id, service_name, endpoint, method, total_hits, error_hits,
            avg_latency, min_latency, max_latency, time_bucket,
            hits_2xx, hits_3xx, hits_4xx, hits_5xx, rate_limit_hits,
            req_bytes_total, res_bytes_total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (client_id, service_name, endpoint, method, time_bucket)
          DO UPDATE SET
            total_hits = endpoint_metrics.total_hits + EXCLUDED.total_hits,
            error_hits = endpoint_metrics.error_hits + EXCLUDED.error_hits,
            avg_latency = (
              (endpoint_metrics.avg_latency * endpoint_metrics.total_hits)
              + (EXCLUDED.avg_latency * EXCLUDED.total_hits)
            ) / NULLIF(endpoint_metrics.total_hits + EXCLUDED.total_hits, 0),
            min_latency = LEAST(endpoint_metrics.min_latency, EXCLUDED.min_latency),
            max_latency = GREATEST(endpoint_metrics.max_latency, EXCLUDED.max_latency),
            hits_2xx = endpoint_metrics.hits_2xx + EXCLUDED.hits_2xx,
            hits_3xx = endpoint_metrics.hits_3xx + EXCLUDED.hits_3xx,
            hits_4xx = endpoint_metrics.hits_4xx + EXCLUDED.hits_4xx,
            hits_5xx = endpoint_metrics.hits_5xx + EXCLUDED.hits_5xx,
            rate_limit_hits = endpoint_metrics.rate_limit_hits + EXCLUDED.rate_limit_hits,
            req_bytes_total = endpoint_metrics.req_bytes_total + EXCLUDED.req_bytes_total,
            res_bytes_total = endpoint_metrics.res_bytes_total + EXCLUDED.res_bytes_total,
            updated_at = CURRENT_TIMESTAMP
        `;

        await pgPool.query(query, [
          metric.clientId,
          metric.serviceName,
          metric.endpoint,
          metric.method,
          metric.totalHits,
          metric.errorHits,
          parseFloat(avgLatency.toFixed(3)),
          parseFloat(minLatency.toFixed(3)),
          parseFloat(maxLatency.toFixed(3)),
          metric.timeBucket,
          metric.hits2xx,
          metric.hits3xx,
          metric.hits4xx,
          metric.hits5xx,
          metric.rateLimitHits,
          metric.reqBytesTotal,
          metric.resBytesTotal,
        ]);
      }

      console.log(
        `   Processed ${Math.min(i + BATCH_SIZE, metricsArray.length)}/${metricsArray.length} metric buckets`,
      );
    }
    console.log(
      `✅ PostgreSQL: ${metricsArray.length} metric buckets inserted`,
    );

    // ── Summary ────────────────────────────────────────────────────────────
    console.log("\n" + "=".repeat(80));
    console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log("\n📈 Summary:");
    console.log(
      `   • Users: ${1 + clientAdmins.length + clientViewers.length} (1 super admin + ${clientAdmins.length} client admins + ${clientViewers.length} viewers)`,
    );
    console.log(`   • Clients: ${clients.length}`);
    console.log(`   • API Keys: ${apiKeys.length}`);
    console.log(`   • API Hits (MongoDB): ${allApiHits.length}`);
    console.log(`   • Metric Buckets (PostgreSQL): ${metricsArray.length}`);

    console.log("\n🔐 Credentials:");
    console.log(
      `   Super Admin: superadmin@cerberus.io / ${superAdminPassword}`,
    );
    for (let i = 0; i < clients.length; i++) {
      console.log(`\n   ${clients[i].name}:`);
      console.log(
        `     Admin: ${clientAdmins[i].email} / [generated password]`,
      );
      console.log(
        `     Viewer: ${clientViewers[i].email} / [generated password]`,
      );
    }

    console.log("\n📊 Data Distribution:");
    console.log(`   • Time range: Last 30 days`);
    console.log(`   • Services: ${SERVICES.map((s) => s.name).join(", ")}`);
    console.log(
      `   • Status code distribution: ~70% success, ~20% client error, ~10% server error`,
    );
    console.log(`   • Latency range: 10ms - 2000ms`);
    console.log(`   • Environments: production, staging, development`);

    console.log("\n✨ Your database is ready for testing and analytics!");
  } catch (error) {
    console.error("\n❌ Error during seeding:", error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup connections
    if (mongoConn) {
      await mongoose.disconnect();
      console.log("\n👋 MongoDB disconnected");
    }
    if (pgPool) {
      await pgPool.end();
      console.log("👋 PostgreSQL disconnected");
    }
  }
}

// Run the seeding
seedDatabase();
