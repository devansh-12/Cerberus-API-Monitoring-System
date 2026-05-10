#!/bin/bash
set -e

echo "🚀 Setting up test environment..."

# Create PostgreSQL database if it doesn't exist
echo "📦 Checking PostgreSQL database..."
docker compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'cerberus_analytics'" 2>/dev/null | grep -q 1 || {
  echo "Creating database cerberus_analytics..."
  docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE cerberus_analytics;"
}

# Run TimescaleDB migration if needed
echo "📊 Running TimescaleDB migration..."
docker compose exec -T postgres psql -U postgres -d cerberus_analytics -f /docker-entrypoint-initdb.d/init-postgres.sql 2>/dev/null || echo "Migration skipped or already applied"

# Start server in background
echo "🌐 Starting server..."
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Server failed to start within 30 seconds"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

# Run Playwright tests
echo "🧪 Running e2e tests..."
npm run test:e2e
TEST_EXIT=$?

# Cleanup
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

exit $TEST_EXIT
