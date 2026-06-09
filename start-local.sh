#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Setup colors for logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting zBOM Local Environment...${NC}"

POSTGRES_DATABASE_URL="${POSTGRES_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/zbom?schema=public}"
SQLITE_DATABASE_URL="file://$(pwd)/server/db/dev.db"
export SESSION_SECRET="${SESSION_SECRET:-dev-session-secret-for-local-dev}"

has_workspace_data() {
  node --input-type=module -e 'import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient(); try { const count = await prisma.workspace.count(); process.exit(count > 0 ? 0 : 1); } catch { process.exit(1); } finally { await prisma.$disconnect(); }'
}

configure_prisma() {
  local provider="$1"
  node scripts/switch-db-provider.js "$provider"
  npx prisma generate --schema server/db/schema.prisma
}

sync_schema() {
  npx prisma db push --schema server/db/schema.prisma
}

seed_if_empty() {
  if has_workspace_data; then
    echo -e "${GREEN}✅ Existing workspace data found. Skipping seed to preserve imported data.${NC}"
  else
    echo -e "${YELLOW}🌱 No workspace data found. Seeding demo data once...${NC}"
    npx tsx server/db/seed.ts
  fi
}

backfill_tooling_numbers() {
  echo -e "${YELLOW}🔢 Checking tooling numbers...${NC}"
  node scripts/backfill-tooling-numbers.mjs
}

# 1. Verify node_modules
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 node_modules not found. Running npm install...${NC}"
  npm install
else
  echo -e "${GREEN}✅ node_modules found.${NC}"
fi

# 2. Check if Docker is running
DOCKER_RUNNING=false
if docker info >/dev/null 2>&1; then
  DOCKER_RUNNING=true
fi

if [ "$DOCKER_RUNNING" = true ]; then
  echo -e "${GREEN}🐳 Docker daemon detected. Setting up PostgreSQL...${NC}"
  export DATABASE_URL="$POSTGRES_DATABASE_URL"
  
  # Start postgres container
  docker-compose up -d
  
  # Wait for postgres port to accept connections
  echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready on port 5432...${NC}"
  until nc -z localhost 5432 >/dev/null 2>&1; do
    sleep 1
  done
  echo -e "${GREEN}✅ PostgreSQL is active.${NC}"

  # Configure DB provider to PostgreSQL
  echo -e "${YELLOW}🔄 Configuring Prisma to use PostgreSQL datasource...${NC}"
  configure_prisma postgresql

  # Sync schema without reseeding existing data.
  echo -e "${YELLOW}⚙️ Syncing database schema to PostgreSQL...${NC}"
  sync_schema
  seed_if_empty
  backfill_tooling_numbers
  echo -e "${GREEN}✅ PostgreSQL setup complete.${NC}"
else
  echo -e "${YELLOW}⚠️ Docker is not running or not installed. Falling back to local SQLite...${NC}"
  export DATABASE_URL="$SQLITE_DATABASE_URL"
  
  # Configure DB provider to SQLite
  echo -e "${YELLOW}🔄 Configuring Prisma to use SQLite datasource...${NC}"
  configure_prisma sqlite

  # Create/sync SQLite schema and seed only when the workspace is empty.
  mkdir -p server/db
  echo -e "${YELLOW}⚙️ Syncing local SQLite database schema...${NC}"
  sync_schema
  seed_if_empty
  backfill_tooling_numbers
  echo -e "${GREEN}✅ SQLite fallback setup complete.${NC}"
fi

# 3. Start development servers
echo -e "${GREEN}⚡ Starting Servers...${NC}"

# Define cleanup trap to kill child processes on exit
cleanup() {
  echo -e "\n${YELLOW}🛑 Shutting down backend API and Web servers...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Start Fastify backend server in background
echo -e "${YELLOW}🖥️ Starting Fastify API Server (http://localhost:3001)...${NC}"
DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" npm run dev:api &
BACKEND_PID=$!

# Wait briefly for backend to start up
sleep 2

# Start Vite frontend dev server in background
echo -e "${YELLOW}💻 Starting Vite Web Application (http://localhost:3000)...${NC}"
VITE_API_BASE_URL=http://localhost:3001 npm run dev &
FRONTEND_PID=$!

# Keep bash script alive and wait for background processes
wait "$FRONTEND_PID" "$BACKEND_PID"
