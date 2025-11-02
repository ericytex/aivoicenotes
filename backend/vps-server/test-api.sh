#!/bin/bash

# Test API endpoints to diagnose 404 issues

echo "🔍 Testing API Endpoints"
echo "════════════════════════"
echo ""

VPS_IP="${VPS_IP:-194.163.134.129}"
PORT="${PORT:-8888}"

echo "1. Testing health endpoint (should work)..."
curl -s "http://${VPS_IP}:${PORT}/health" | jq . || curl -s "http://${VPS_IP}:${PORT}/health"
echo ""
echo ""

echo "2. Testing direct backend API (port 3333)..."
curl -s "http://${VPS_IP}:3333/health" | jq . || curl -s "http://${VPS_IP}:3333/health"
echo ""
echo ""

echo "3. Testing /api/auth/signup through Nginx..."
curl -v -X POST "http://${VPS_IP}:${PORT}/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' 2>&1 | head -20
echo ""
echo ""

echo "4. Testing /api/auth/signup directly on backend..."
curl -v -X POST "http://${VPS_IP}:3333/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' 2>&1 | head -20
echo ""
echo ""

echo "5. Checking Nginx logs..."
echo "   Run: docker compose -f docker-compose.full.yml logs nginx | tail -20"
echo ""

echo "6. Checking API logs..."
echo "   Run: docker compose -f docker-compose.full.yml logs voicenote-api | tail -20"
echo ""

