#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Setup colors for logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting zBOM Local Environment...${NC}"

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
  npm run db:use-postgres

  # Push schemas and seed data
  echo -e "${YELLOW}⚙️ Syncing database schema to PostgreSQL and seeding...${NC}"
  npx prisma db push --accept-data-loss
  npm run prisma:seed
  echo -e "${GREEN}✅ PostgreSQL setup complete.${NC}"
else
  echo -e "${YELLOW}⚠️ Docker is not running or not installed. Falling back to local SQLite...${NC}"
  
  # Configure DB provider to SQLite
  echo -e "${YELLOW}🔄 Configuring Prisma to use SQLite datasource...${NC}"
  npm run db:use-sqlite

  # Seed SQLite database if not already present
  if [ ! -f "server/db/dev.db" ]; then
    echo -e "${YELLOW}⚙️ Initializing local SQLite database (dev.db) and seeding...${NC}"
    # Touch file to ensure folder exists
    mkdir -p server/db
    npm run prisma:apply
    npm run prisma:seed
  else
    echo -e "${GREEN}✅ Existing SQLite database found.${NC}"
  fi
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
VITE_API_BASE_URL=http://localhost:3001 npm run dev:api &
BACKEND_PID=$!

# Wait briefly for backend to start up
sleep 1.5

# Start Vite frontend dev server in background
echo -e "${YELLOW}💻 Starting Vite Web Application (http://localhost:5173)...${NC}"
VITE_API_BASE_URL=http://localhost:3001 npm run dev &
FRONTEND_PID=$!

# Keep bash script alive and wait for background processes
wait "$FRONTEND_PID" "$BACKEND_PID"
