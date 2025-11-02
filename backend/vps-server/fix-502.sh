#!/bin/bash

# Fix 502 Bad Gateway error

set -e

echo "🔧 Fixing 502 Bad Gateway"
echo "══════════════════════════"
echo ""

cd "$(dirname "$0")"

# 1. Check container status
echo "1. Checking container status..."
docker compose -f docker-compose.full.yml ps

echo ""
echo "2. Checking if backend is healthy..."
HEALTHY=$(docker compose -f docker-compose.full.yml ps voicenote-api | grep -q "healthy" && echo "yes" || echo "no")
if [ "$HEALTHY" = "no" ]; then
    echo "   ⚠️  Backend is not healthy"
else
    echo "   ✅ Backend is healthy"
fi

echo ""
echo "3. Testing backend directly (bypassing Nginx)..."
curl -s http://localhost:3333/health | jq . 2>/dev/null || curl -s http://localhost:3333/health || echo "   ❌ Backend not responding on port 3333"

echo ""
echo "4. Checking backend logs..."
echo "   Recent errors:"
docker compose -f docker-compose.full.yml logs voicenote-api | tail -20 | grep -i "error\|failed\|exception" || echo "   No recent errors"

echo ""
echo "5. Checking if backend container can reach the network..."
docker compose -f docker-compose.full.yml exec voicenote-api curl -s http://localhost:3333/health 2>/dev/null || echo "   ⚠️  Backend can't reach itself"

echo ""
echo "6. Checking Nginx can reach backend..."
docker compose -f docker-compose.full.yml exec nginx wget -q -O- http://voicenote-api:3333/health 2>/dev/null || {
    echo "   ❌ Nginx can't reach backend!"
    echo "   Checking network..."
    docker compose -f docker-compose.full.yml exec nginx ping -c 1 voicenote-api 2>/dev/null || echo "   ❌ Network issue"
}

echo ""
echo "7. Checking backend startup..."
echo "   Last 30 lines of backend logs:"
docker compose -f docker-compose.full.yml logs voicenote-api | tail -30

echo ""
echo "8. Restarting backend..."
docker compose -f docker-compose.full.yml restart voicenote-api
echo "   Waiting for backend to start..."
sleep 10

echo ""
echo "9. Re-checking backend health..."
sleep 5
curl -s http://localhost:3333/health | jq . 2>/dev/null || curl -s http://localhost:3333/health || echo "   ⚠️  Still not responding"

echo ""
echo "10. Restarting Nginx..."
docker compose -f docker-compose.full.yml restart nginx
sleep 3

echo ""
echo "11. Final test through Nginx..."
curl -s http://localhost:8888/health | jq . 2>/dev/null || curl -s http://localhost:8888/health || echo "   ⚠️  Still 502"

echo ""
echo "═════════════════════════════════════"
echo "✅ Diagnostic complete!"
echo ""
echo "If still 502, check:"
echo "   - Backend logs: docker compose -f docker-compose.full.yml logs voicenote-api"
echo "   - Nginx logs: docker compose -f docker-compose.full.yml logs nginx"
echo "   - Network: docker compose -f docker-compose.full.yml exec nginx ping voicenote-api"

