#!/usr/bin/env node
/**
 * get-api-key.js
 *
 * Retrieves active API keyValues from MongoDB after seeding.
 * Copy one of the printed keys and pass it to replay-logs.js.
 *
 * Usage:
 *   node scripts/get-api-key.js
 *   node scripts/get-api-key.js --env production
 *   node scripts/get-api-key.js --all
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const env  = args.includes('--env') ? args[args.indexOf('--env') + 1] : null;
const all  = args.includes('--all');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/api_monitoring';

const ApiKeySchema = new mongoose.Schema({
  keyValue:    String,
  name:        String,
  environment: String,
  isActive:    Boolean,
  ClientId:    mongoose.Types.ObjectId,
}, { collection: 'api_keys' });

const ApiKey = mongoose.model('ApiKey', ApiKeySchema);

async function main() {
  await mongoose.connect(MONGO_URI);

  const filter = { isActive: true };
  if (env) filter.environment = env;

  const keys = await ApiKey.find(filter).select('keyValue name environment ClientId').lean();

  if (keys.length === 0) {
    console.error('\n❌ No active API keys found. Run: npm run seed\n');
    process.exit(1);
  }

  console.log('\n✅ Active API Keys (use any of these with --api-key):\n');
  for (const k of keys) {
    console.log(`  ${k.keyValue}  →  ${k.name} (${k.environment})`);
  }

  if (!all) {
    console.log('\n📋 Quick copy (first production key):');
    const prod = keys.find(k => k.environment === 'production') || keys[0];
    console.log(`\n  ${prod.keyValue}\n`);
    console.log('Usage:');
    console.log(`  node benchmark/replay-logs.js --api-key ${prod.keyValue} --limit 500000 --workers 50\n`);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
