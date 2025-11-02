#!/bin/bash

# Check service status and test API

set -e

VPS_IP="${VPS_IP:-194.163.134.129}"

echo "🔍 Checking Services and Testing API"
echo "═════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

echo "1. Checking container status..."
docker compose -f docker-compose.full.yml ps

echo ""
echo "2. Checking Nginx is listening..."
docker compose -f docker-compose.full.yml exec nginx netstat -tlnp | grep :80 || echo "   Nginx not listening on port 80"

echo ""
echo "3. Testing health endpoint (internal)..."
docker compose -f docker-compose.full.yml exec nginx curl -s http://voicenote-api:3333/health || echo "   Failed"

echo ""
echo "4. Testing /api/auth/signin through Nginx (internal)..."
docker compose -f docker-compose.full.yml exec nginx curl -s -X POST http://voicenote-api:3333/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' || echo "   Failed"

echo ""
echo "5. Testing from host (external IP)..."
curl -v http://${VPS_IP}:8888/health 2>&1 | head -15

echo ""
echo "6. Testing API endpoint from host (external IP)..."
curl -v http://${VPS_IP}:8888/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' 2>&1 | grep -E "< HTTP|success|error|Endpoint"

echo ""
echo "✅ Done!"
echo ""
echo "If tests fail, check:"
echo "   - Nginx logs: docker compose -f docker-compose.full.yml logs nginx | tail -30"
echo "   - API logs: docker compose -f docker-compose.full.yml logs voicenote-api | tail -30"

