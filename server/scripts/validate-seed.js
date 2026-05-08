/**
 * Database Validation Script
 * 
 * Verifies that seeded data is valid and synchronized across MongoDB and PostgreSQL.
 * 
 * Usage:
 *   node scripts/validate-seed.js
 */

import mongoose from 'mongoose';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;

// Import models
import User from '../src/shared/models/User.js';
import Client from '../src/shared/models/Client.js';
import ApiKey from '../src/shared/models/ApiKey.js';
import ApiHit from '../src/shared/models/ApiHits.js';

let mongoConn;
let pgPool;
let errors = [];
let warnings = [];

function log(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️',
    section: '📊',
  };
  console.log(`${icons[type] || 'ℹ️'} ${message}`);
}

async function validateMongoDB() {
  log('Validating MongoDB...', 'section');

  // Check users
  const users = await User.find({});
  log(`Users: ${users.length}`, 'info');
  
  const superAdmins = users.filter(u => u.role === 'super_admin');
  if (superAdmins.length !== 1) {
    errors.push(`Expected 1 super admin, found ${superAdmins.length}`);
  } else {
    log('Super admin exists', 'success');
  }

  const clientAdmins = users.filter(u => u.role === 'client_admin');
  const clientViewers = users.filter(u => u.role === 'client_viewer');
  log(`Client admins: ${clientAdmins.length}`, 'info');
  log(`Client viewers: ${clientViewers.length}`, 'info');

  // Check clients
  const clients = await Client.find({});
  log(`Clients: ${clients.length}`, 'info');

  for (const client of clients) {
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(client.slug)) {
      errors.push(`Invalid slug format: ${client.slug}`);
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
      errors.push(`Invalid email format: ${client.email}`);
    }

    // Validate settings
    if (client.settings.dataRetentionDays < 7 || client.settings.dataRetentionDays > 365) {
      errors.push(`Invalid dataRetentionDays for ${client.name}: ${client.settings.dataRetentionDays}`);
    }

    // Check createdBy reference
    const creator = await User.findById(client.createdBy);
    if (!creator) {
      errors.push(`Client ${client.name} has invalid createdBy reference`);
    }
  }

  log('Client validations complete', 'success');

  // Check API keys
  const apiKeys = await ApiKey.find({});
  log(`API Keys: ${apiKeys.length}`, 'info');

  for (const key of apiKeys) {
    // Validate environment
    if (!['production', 'staging', 'development', 'testing'].includes(key.environment)) {
      errors.push(`Invalid environment for API key ${key.keyId}: ${key.environment}`);
    }

    // Validate ClientId reference
    const client = await Client.findById(key.ClientId);
    if (!client) {
      errors.push(`API key ${key.keyId} has invalid ClientId reference`);
    }

    // Check expiration
    if (key.isExpired()) {
      warnings.push(`API key ${key.keyId} is expired`);
    }
  }

  log('API key validations complete', 'success');

  // Check API hits
  const apiHits = await ApiHit.find({});
  log(`API Hits: ${apiHits.length}`, 'info');

  for (const hit of apiHits.slice(0, 100)) { // Sample check first 100
    // Validate method
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(hit.method)) {
      errors.push(`Invalid HTTP method for hit ${hit.eventId}: ${hit.method}`);
    }

    // Validate status code
    if (hit.statusCode < 100 || hit.statusCode > 599) {
      errors.push(`Invalid status code for hit ${hit.eventId}: ${hit.statusCode}`);
    }

    // Validate references
    const hitClient = await Client.findById(hit.ClientId);
    if (!hitClient) {
      errors.push(`API hit ${hit.eventId} has invalid ClientId reference`);
    }

    const hitApiKey = await ApiKey.findById(hit.ApiKeyId);
    if (!hitApiKey) {
      errors.push(`API hit ${hit.eventId} has invalid ApiKeyId reference`);
    }
  }

  log('API hit validations complete (sampled)', 'success');

  return { users, clients, apiKeys, apiHits };
}

async function validatePostgreSQL() {
  log('\nValidating PostgreSQL...', 'section');

  // Check endpoint_metrics
  const metricsResult = await pgPool.query('SELECT COUNT(*) FROM endpoint_metrics');
  const metricsCount = parseInt(metricsResult.rows[0].count);
  log(`Endpoint metrics: ${metricsCount}`, 'info');

  // Check for negative values
  const negativeResult = await pgPool.query(`
    SELECT COUNT(*) FROM endpoint_metrics 
    WHERE total_hits < 0 OR error_hits < 0 OR avg_latency < 0
  `);
  const negativeCount = parseInt(negativeResult.rows[0].count);
  if (negativeCount > 0) {
    errors.push(`${negativeCount} metric records have negative values`);
  } else {
    log('No negative values in metrics', 'success');
  }

  // Check time_bucket range
  const timeRangeResult = await pgPool.query(`
    SELECT 
      MIN(time_bucket) as min_time,
      MAX(time_bucket) as max_time
    FROM endpoint_metrics
  `);
  const { min_time, max_time } = timeRangeResult.rows[0];
  log(`Metrics time range: ${min_time} to ${max_time}`, 'info');

  // Verify time_bucket is within last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
  if (new Date(min_time) < thirtyDaysAgo) {
    warnings.push('Some metrics are older than 30 days');
  } else {
    log('Metrics within expected time range', 'success');
  }

  // Check unique constraint
  const duplicatesResult = await pgPool.query(`
    SELECT client_id, service_name, endpoint, method, time_bucket, COUNT(*)
    FROM endpoint_metrics
    GROUP BY client_id, service_name, endpoint, method, time_bucket
    HAVING COUNT(*) > 1
  `);
  if (duplicatesResult.rows.length > 0) {
    errors.push(`${duplicatesResult.rows.length} duplicate metric records found`);
  } else {
    log('No duplicate metrics', 'success');
  }

  return metricsCount;
}

async function validateCrossServiceConsistency(mongoData) {
  log('\nValidating Cross-Service Consistency...', 'section');

  const { apiHits } = mongoData;

  // Get total hits from MongoDB per client
  const mongoHitsByClient = {};
  for (const hit of apiHits) {
    const clientId = hit.ClientId.toString();
    mongoHitsByClient[clientId] = (mongoHitsByClient[clientId] || 0) + 1;
  }

  // Get total hits from PostgreSQL per client
  const pgResult = await pgPool.query(`
    SELECT client_id, SUM(total_hits) as total
    FROM endpoint_metrics
    GROUP BY client_id
  `);

  const pgHitsByClient = {};
  for (const row of pgResult.rows) {
    pgHitsByClient[row.client_id] = parseInt(row.total);
  }

  // Compare
  let consistent = true;
  for (const [clientId, mongoCount] of Object.entries(mongoHitsByClient)) {
    const pgCount = pgHitsByClient[clientId] || 0;
    if (mongoCount !== pgCount) {
      errors.push(`Client ${clientId}: MongoDB=${mongoCount}, PostgreSQL=${pgCount} (MISMATCH)`);
      consistent = false;
    }
  }

  if (consistent) {
    log('MongoDB and PostgreSQL hit counts are synchronized', 'success');
  } else {
    log('Hit count mismatches detected', 'error');
  }

  // Verify all MongoDB clients have PostgreSQL metrics
  const mongoClientIds = new Set([...apiHits.map(h => h.ClientId.toString())]);
  const pgClientIds = new Set(pgResult.rows.map(r => r.client_id));
  
  const missingClients = [...mongoClientIds].filter(id => !pgClientIds.has(id));
  if (missingClients.length > 0) {
    errors.push(`${missingClients.length} clients missing PostgreSQL metrics`);
  } else {
    log('All clients have PostgreSQL metrics', 'success');
  }

  // Verify status code distribution
  const statusDistribution = { success: 0, clientError: 0, serverError: 0 };
  for (const hit of apiHits) {
    if (hit.statusCode >= 200 && hit.statusCode < 400) {
      statusDistribution.success++;
    } else if (hit.statusCode >= 400 && hit.statusCode < 500) {
      statusDistribution.clientError++;
    } else if (hit.statusCode >= 500) {
      statusDistribution.serverError++;
    }
  }

  const total = apiHits.length;
  const successPct = ((statusDistribution.success / total) * 100).toFixed(1);
  const clientErrorPct = ((statusDistribution.clientError / total) * 100).toFixed(1);
  const serverErrorPct = ((statusDistribution.serverError / total) * 100).toFixed(1);

  log(`Status code distribution:`, 'info');
  log(`  Success (2xx-3xx): ${successPct}% (expected ~70-90%)`, statusDistribution.success / total >= 0.7 ? 'success' : 'warn');
  log(`  Client Error (4xx): ${clientErrorPct}% (expected ~10-30%)`, 'info');
  log(`  Server Error (5xx): ${serverErrorPct}% (expected ~5-15%)`, 'info');
}

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DATABASE SEED VALIDATION');
    console.log('='.repeat(80) + '\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/cerberus';
    log(`Connecting to MongoDB: ${mongoUri}`, 'info');
    mongoConn = await mongoose.connect(mongoUri);
    log('MongoDB connected', 'success');

    // Connect to PostgreSQL
    const pgConfig = {
      host: process.env.PG_HOST || process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.PG_DATABASE || process.env.POSTGRES_DB || 'cerberus',
      user: process.env.PG_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.PG_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    };
    log(`Connecting to PostgreSQL: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`, 'info');
    pgPool = new Pool(pgConfig);
    await pgPool.query('SELECT 1');
    log('PostgreSQL connected', 'success');

    // Run validations
    const mongoData = await validateMongoDB();
    const pgMetricsCount = await validatePostgreSQL();
    await validateCrossServiceConsistency(mongoData);

    // Summary
    console.log('\n' + '='.repeat(80));
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ VALIDATION PASSED - All checks successful!');
    } else {
      console.log('⚠️  VALIDATION COMPLETED WITH ISSUES');
    }
    console.log('='.repeat(80));

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
    }

    console.log('\n📊 Final Statistics:');
    console.log(`  • Errors: ${errors.length}`);
    console.log(`  • Warnings: ${warnings.length}`);
    console.log(`  • Status: ${errors.length === 0 ? 'PASS' : 'FAIL'}\n`);

    process.exit(errors.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Validation failed with error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (mongoConn) await mongoose.disconnect();
    if (pgPool) await pgPool.end();
  }
}

main();
