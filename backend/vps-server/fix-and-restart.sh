#!/bin/bash

# Fix merge conflict and restart services

set -e

echo "🔧 Fixing merge conflict and restarting services"
echo "════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# Stash local changes
echo "1. Stashing local changes..."
git stash push -m "Local Nginx config before update" 2>/dev/null || echo "   No local changes to stash"

# Pull latest
echo ""
echo "2. Pulling latest changes..."
git pull

# Restart Nginx
echo ""
echo "3. Restarting Nginx..."
docker compose -f docker-compose.full.yml restart nginx

# Restart API (in case backend code changed)
echo ""
echo "4. Restarting API backend..."
docker compose -f docker-compose.full.yml restart voicenote-api

echo ""
echo "5. Waiting for services to be healthy..."
sleep 5

# Test health
echo ""
echo "6. Testing health endpoint..."
curl -s http://localhost:8888/health | jq . || curl -s http://localhost:8888/health

echo ""
echo ""
echo "7. Testing API endpoint..."
curl -v http://localhost:8888/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' 2>&1 | grep -E "< HTTP|success|error"

echo ""
echo ""
echo "✅ Done!"
echo ""
echo "Check API logs if still failing:"
echo "   docker compose -f docker-compose.full.yml logs voicenote-api | tail -30"

