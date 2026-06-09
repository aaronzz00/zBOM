#!/usr/bin/env bash
# =============================================================================
# deploy-qcloud.sh — Tencent Cloud (CVM / Lighthouse) Deployment Script
# =============================================================================
# Strategy: Build on Target Server
#   SSH into remote server → git pull → docker compose build → migrate → up
#
# Requirements on remote server:
#   - Git, Docker, Docker Compose v2
#   - .env.prod file placed at REMOTE_APP_DIR/.env.prod
#   - SSH key-based access configured
#
# Usage:
#   ./deploy-qcloud.sh [OPTIONS]
#
# Options:
#   --host HOST         Remote server IP or hostname (required)
#   --user USER         SSH user (default: ubuntu)
#   --key  KEY_PATH     Path to SSH private key (default: ~/.ssh/id_rsa)
#   --app-dir DIR       App directory on server (default: /app/zbom)
#   --branch BRANCH     Git branch to deploy (default: main)
#   --skip-build        Skip docker image rebuild (only restart services)
#   --help              Show this help message
# =============================================================================

set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
error()  { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
info()   { echo -e "${CYAN}[→]${NC} $*"; }
section(){ echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

# ─── Default Configuration ─────────────────────────────────────────────────────
REMOTE_HOST=""
REMOTE_USER="ubuntu"
SSH_KEY="${HOME}/.ssh/id_rsa"
REMOTE_APP_DIR="/app/zbom"
DEPLOY_BRANCH="main"
SKIP_BUILD=false
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

# ─── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)       REMOTE_HOST="$2"; shift 2 ;;
    --user)       REMOTE_USER="$2"; shift 2 ;;
    --key)        SSH_KEY="$2"; shift 2 ;;
    --app-dir)    REMOTE_APP_DIR="$2"; shift 2 ;;
    --branch)     DEPLOY_BRANCH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --help)
      grep '^#' "$0" | head -30 | sed 's/^# \?//'
      exit 0
      ;;
    *)
      error "Unknown option: $1 (run --help for usage)"
      ;;
  esac
done

# ─── Validation ────────────────────────────────────────────────────────────────
[[ -z "$REMOTE_HOST" ]] && error "--host is required. Example: ./deploy-qcloud.sh --host 1.2.3.4"
[[ -f "$SSH_KEY" ]] || error "SSH key not found at: $SSH_KEY"

SSH_CMD="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST}"
SCP_CMD="scp -i ${SSH_KEY} -o StrictHostKeyChecking=no"

section "zBOM Deployment to Tencent Cloud"
info "Target: ${REMOTE_USER}@${REMOTE_HOST}"
info "App Dir: ${REMOTE_APP_DIR}"
info "Branch:  ${DEPLOY_BRANCH}"
info "Build:   $([ "$SKIP_BUILD" = true ] && echo "SKIPPED" || echo "YES")"

# ─── Step 1: Verify SSH Connection ─────────────────────────────────────────────
section "Step 1: Verifying SSH Connection"
$SSH_CMD "echo 'SSH OK'" || error "Cannot connect to ${REMOTE_HOST}. Check --host, --user, and --key."
log "SSH connection verified."

# ─── Step 2: Ensure Remote App Directory Exists ────────────────────────────────
section "Step 2: Preparing Remote Directory"
$SSH_CMD "mkdir -p ${REMOTE_APP_DIR}"

# Check if .env.prod exists on remote
$SSH_CMD "test -f ${REMOTE_APP_DIR}/${ENV_FILE}" || {
  warn ".env.prod not found on server at ${REMOTE_APP_DIR}/${ENV_FILE}"
  warn "To create it, run:"
  warn "  scp -i ${SSH_KEY} .env.prod ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/.env.prod"
  error "Deployment aborted — environment file is required."
}
log "Environment file confirmed on server."

# ─── Step 3: Pull Latest Code ──────────────────────────────────────────────────
section "Step 3: Pulling Latest Code"
$SSH_CMD "bash -s" << REMOTE_PULL
  set -e
  cd ${REMOTE_APP_DIR}

  # Initialize git repo if it doesn't exist
  if [ ! -d .git ]; then
    echo "Cloning repository..."
    git clone . /tmp/zbom-init 2>/dev/null || true
    # Copy only if not already initialized
    git init
    git remote add origin https://github.com/aaronzz00/zBOM.git 2>/dev/null || true
  fi

  git fetch --all --prune
  git checkout ${DEPLOY_BRANCH}
  git reset --hard origin/${DEPLOY_BRANCH}
  echo "Code updated to: \$(git log -1 --format='%h %s (%ar)')"
REMOTE_PULL
log "Code is up to date."

# ─── Step 4: Build Docker Images ───────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  section "Step 4: Building Docker Images (this may take a few minutes)"
  $SSH_CMD "bash -s" << REMOTE_BUILD
    set -e
    cd ${REMOTE_APP_DIR}
    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build --no-cache
    echo "Build complete."
REMOTE_BUILD
  log "Docker images built."
else
  warn "Step 4: Skipping Docker build (--skip-build specified)"
fi

# ─── Step 5: Run Database Migrations ───────────────────────────────────────────
section "Step 5: Running Database Migrations"
$SSH_CMD "bash -s" << REMOTE_MIGRATE
  set -e
  cd ${REMOTE_APP_DIR}

  # Source env vars
  set -a; source ${ENV_FILE}; set +a

  DB_URL="postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@localhost:5432/\${POSTGRES_DB}"

  # Start only the db service first for migrations
  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d db

  # Wait for PostgreSQL to be healthy
  echo "Waiting for PostgreSQL to be ready..."
  RETRIES=30
  until docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T db pg_isready -U "\${POSTGRES_USER}" -d "\${POSTGRES_DB}" >/dev/null 2>&1 || [ \$RETRIES -eq 0 ]; do
    echo "  PostgreSQL not ready yet... (\$RETRIES retries left)"
    sleep 2
    RETRIES=\$((RETRIES - 1))
  done

  [ \$RETRIES -eq 0 ] && echo "ERROR: PostgreSQL failed to start" && exit 1

  # Run Prisma migrations inside the API container
  echo "Running Prisma migrations..."
  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} run --rm \
    -e DATABASE_URL="postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB}" \
    api sh -c "npx prisma db push --schema server/db/schema.prisma --skip-generate --accept-data-loss"

  echo "Migrations complete."
REMOTE_MIGRATE
log "Database migrations applied."

# ─── Step 6: Start / Restart All Services ──────────────────────────────────────
section "Step 6: Starting Production Services"
$SSH_CMD "bash -s" << REMOTE_UP
  set -e
  cd ${REMOTE_APP_DIR}
  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d
  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} ps
REMOTE_UP
log "All services are running."

# ─── Step 7: Health Check ──────────────────────────────────────────────────────
section "Step 7: Health Check"
info "Waiting 15s for services to initialize..."
sleep 15

$SSH_CMD "bash -s" << REMOTE_HEALTH
  set -e
  cd ${REMOTE_APP_DIR}

  # Check API health endpoint
  API_STATUS=\$(curl -sf http://localhost:3001/api/health -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
  WEB_STATUS=\$(curl -sf http://localhost:80 -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

  echo "  API health:    HTTP \${API_STATUS}"
  echo "  Web (Nginx):   HTTP \${WEB_STATUS}"

  if [ "\${API_STATUS}" != "200" ]; then
    echo "WARNING: API health check returned HTTP \${API_STATUS}"
    echo "API container logs:"
    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs --tail=30 api
  fi

  if [ "\${WEB_STATUS}" != "200" ]; then
    echo "WARNING: Nginx returned HTTP \${WEB_STATUS}"
    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs --tail=20 web
  fi
REMOTE_HEALTH

# ─── Done ──────────────────────────────────────────────────────────────────────
section "Deployment Complete"
log "${BOLD}zBOM deployed successfully to ${REMOTE_HOST}${NC}"
info "Application URL: http://${REMOTE_HOST}"
info ""
info "Useful remote commands:"
info "  View logs:    ssh -i ${SSH_KEY} ${REMOTE_USER}@${REMOTE_HOST} 'docker compose -f ${REMOTE_APP_DIR}/${COMPOSE_FILE} logs -f'"
info "  View status:  ssh -i ${SSH_KEY} ${REMOTE_USER}@${REMOTE_HOST} 'docker compose -f ${REMOTE_APP_DIR}/${COMPOSE_FILE} ps'"
info "  Stop all:     ssh -i ${SSH_KEY} ${REMOTE_USER}@${REMOTE_HOST} 'docker compose -f ${REMOTE_APP_DIR}/${COMPOSE_FILE} down'"
