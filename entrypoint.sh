#!/bin/sh
# ===========================================
# AI Recruiter - Entrypoint Script
# Runs migrations, creates S3 bucket, then starts app
# ===========================================

set -e

echo "🚀 AI Recruiter - Starting initialization..."

# -------------------------------------------
# 1. Parse DATABASE_URL
# -------------------------------------------
# postgresql://user:pass@host:port/db
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_recruiter}"
# Extract components
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "🔧 Database config: host=$DB_HOST port=$DB_PORT user=$DB_USER db=$DB_NAME"

# -------------------------------------------
# 1. Wait for PostgreSQL with Node.js
# -------------------------------------------
echo "⏳ Waiting for PostgreSQL..."
node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST || '$DB_HOST',
  port: process.env.DB_PORT || $DB_PORT,
  user: process.env.DB_USER || '$DB_USER',
  password: process.env.DB_PASSWORD || '$DB_PASS',
  database: process.env.DB_NAME || '$DB_NAME',
  connectionTimeoutMillis: 5000,
});

async function waitForDb() {
  let retries = 30;
  while (retries > 0) {
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('✅ PostgreSQL ready');
      return;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('❌ PostgreSQL not ready after 30 attempts');
        process.exit(1);
      }
      console.log('⏳ Waiting for PostgreSQL... (' + retries + ' retries left)');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
waitForDb().catch(e => { console.error(e); process.exit(1); });
"

# -------------------------------------------
# 2. Run database migrations (Drizzle)
# -------------------------------------------
echo "📦 Running database migrations..."
npx drizzle-kit push
echo "✅ Migrations complete"

# -------------------------------------------
# 3. Wait for RustFS to be ready
# -------------------------------------------
echo "⏳ Waiting for RustFS..."
node -e "
async function waitForRustFS() {
  let retries = 30;
  while (retries > 0) {
    try {
      const res = await fetch('http://localhost:9000/health');
      if (res.ok) {
        console.log('✅ RustFS ready');
        return;
      }
    } catch (err) {
      // ignore
    }
    retries--;
    if (retries === 0) {
      console.error('❌ RustFS not ready after 30 attempts');
      process.exit(1);
    }
    console.log('⏳ Waiting for RustFS... (' + retries + ' retries left)');
    await new Promise(r => setTimeout(r, 2000));
  }
}
waitForRustFS().catch(e => { console.error(e); process.exit(1); });
"

# -------------------------------------------
# 4. Create S3 bucket if not exists
# -------------------------------------------
echo "🪣 Checking/creating S3 bucket 'ai-recruiter'..."
node -e "
const { S3Client, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'rustfsadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'rustfsadmin',
  },
  forcePathStyle: true,
});

async function ensureBucket() {
  const bucket = 'ai-recruiter';
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('✅ Bucket already exists:', bucket);
  } catch (err) {
    if (err.name === 'NotFound' || err.\$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log('✅ Bucket created:', bucket);
    } else {
      console.error('❌ Error checking bucket:', err.message);
      process.exit(1);
    }
  }
}

ensureBucket().catch(e => { console.error(e); process.exit(1); });
"

echo "✅ Initialization complete"

# -------------------------------------------
# 5. Start the application
# -------------------------------------------
echo "🚀 Starting AI Recruiter application..."
exec node dist/main.js