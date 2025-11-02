#!/bin/bash

# Fresh deployment script - clean install from scratch

set -e

VPS_IP="${VPS_IP:-194.163.134.129}"
NGINX_PORT="${NGINX_PORT:-8888}"

echo "🚀 Fresh Deployment - Clean Install"
echo "═════════════════════════════════════"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Backend dir: $SCRIPT_DIR"
echo ""

cd "$SCRIPT_DIR"

# 1. Stop and remove all containers
echo "1. Stopping and removing existing containers..."
docker compose -f docker-compose.full.yml down -v 2>/dev/null || true
docker compose down -v 2>/dev/null || true

# Clean up any orphaned containers
echo "   Cleaning up orphaned containers..."
docker ps -a | grep -E "voicenote|nginx" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

echo "   ✅ Containers stopped and removed"
echo ""

# 2. Pull fresh code
echo "2. Pulling fresh code from GitHub..."
cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
    echo "   ❌ Not a git repository. Please clone first:"
    echo "      git clone https://github.com/ericytex/aivoicenotes.git voicenote-full"
    exit 1
fi

git fetch origin
git reset --hard origin/main
git clean -fd

echo "   ✅ Code pulled"
echo ""

# 3. Build frontend
echo "3. Installing frontend dependencies..."
cd "$PROJECT_ROOT"
npm install

echo ""
echo "4. Building frontend..."
npm run build

echo "   ✅ Frontend built"
echo ""

# 5. Prepare directories
echo "5. Preparing directories..."
cd "$SCRIPT_DIR"

# Create necessary directories
mkdir -p nginx/html/frontend
mkdir -p nginx/html/uploads
mkdir -p data
mkdir -p uploads

# Copy frontend build
echo "   Copying frontend files..."
rm -rf nginx/html/frontend/*
cp -r "$PROJECT_ROOT/dist/"* nginx/html/frontend/

echo "   ✅ Directories prepared"
echo ""

# 6. Build backend Docker image
echo "6. Building backend Docker image..."
docker compose -f docker-compose.full.yml build voicenote-api

echo "   ✅ Backend image built"
echo ""

# 7. Start services
echo "7. Starting services..."
docker compose -f docker-compose.full.yml up -d

echo ""
echo "8. Waiting for services to be healthy..."
sleep 10

# 9. Check status
echo ""
echo "9. Checking service status..."
docker compose -f docker-compose.full.yml ps

echo ""
echo "10. Testing services..."

# Test health
echo "   Testing health endpoint..."
HEALTH=$(curl -s http://localhost:3333/health | grep -o '"status":"ok"' || echo "")
if [ -n "$HEALTH" ]; then
    echo "   ✅ Backend health check passed"
else
    echo "   ⚠️  Backend health check failed"
fi

# Test Nginx
echo "   Testing Nginx..."
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${NGINX_PORT}/health || echo "000")
if [ "$NGINX_STATUS" = "200" ]; then
    echo "   ✅ Nginx is working"
else
    echo "   ⚠️  Nginx returned status: $NGINX_STATUS"
fi

echo ""
echo "═════════════════════════════════════"
echo "✅ Deployment Complete!"
echo ""
echo "📍 Access your app:"
echo "   Frontend: http://${VPS_IP}:${NGINX_PORT}"
echo "   API Health: http://${VPS_IP}:${NGINX_PORT}/health"
echo "   API Direct: http://${VPS_IP}:3333/health"
echo ""
echo "📋 Next steps:"
echo "   1. Test sign up: http://${VPS_IP}:${NGINX_PORT}/auth"
echo "   2. Check logs: docker compose -f docker-compose.full.yml logs -f"
echo ""
echo "🔍 If there are issues:"
echo "   - Nginx logs: docker compose -f docker-compose.full.yml logs nginx"
echo "   - API logs: docker compose -f docker-compose.full.yml logs voicenote-api"

