#!/bin/bash

# Fix backend connection and check signup error

set -e

echo "🔧 Fixing Backend Connection"
echo "════════════════════════════"
echo ""

cd "$(dirname "$0")"

# 1. Check backend status
echo "1. Checking backend container status..."
docker compose -f docker-compose.full.yml ps voicenote-api

echo ""
echo "2. Checking if backend is on the same network..."
docker network inspect vps-server_voicenote-network 2>/dev/null | grep -A 5 "voicenote-api" || echo "   Network not found or backend not connected"

echo ""
echo "3. Testing backend from Nginx container..."
docker compose -f docker-compose.full.yml exec nginx wget -q -O- http://voicenote-api:3333/health 2>/dev/null && echo "   ✅ Nginx can reach backend" || echo "   ❌ Nginx cannot reach backend"

echo ""
echo "4. Checking backend logs for signup errors..."
docker compose -f docker-compose.full.yml logs voicenote-api | grep -i "signup\|error\|exception\|failed" | tail -20

echo ""
echo "5. Testing signup directly on backend..."
curl -s http://localhost:3333/api/auth/signup \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' | jq . 2>/dev/null || curl -s http://localhost:3333/api/auth/signup \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

echo ""
echo ""
echo "6. Checking recent backend logs (last 30 lines)..."
docker compose -f docker-compose.full.yml logs voicenote-api | tail -30

echo ""
echo ""
echo "7. Checking database permissions..."
docker compose -f docker-compose.full.yml exec voicenote-api ls -la /app/data/ 2>/dev/null || echo "   Cannot check (container may not be running)"

echo ""
echo ""
echo "8. Restarting backend if needed..."
if docker compose -f docker-compose.full.yml ps voicenote-api | grep -q "Restarting"; then
    echo "   Backend is restarting - checking logs..."
    sleep 5
    docker compose -f docker-compose.full.yml logs voicenote-api | tail -20
else
    echo "   Backend appears to be running"
fi

echo ""
echo "✅ Done!"

