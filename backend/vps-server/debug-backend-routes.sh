#!/bin/bash

# Debug backend routes

echo "🔍 Debugging Backend Routes"
echo "═══════════════════════════"
echo ""

cd "$(dirname "$0")"

echo "1. Checking backend container..."
docker compose -f docker-compose.full.yml ps voicenote-api

echo ""
echo "2. Checking recent backend logs for incoming requests..."
docker compose -f docker-compose.full.yml logs voicenote-api | grep -i "POST\|GET" | tail -10

echo ""
echo "3. Testing backend directly (bypassing Nginx)..."
curl -v http://localhost:3333/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' 2>&1 | head -30

echo ""
echo "4. Checking what path the backend receives..."
echo "   Watch backend logs while making a request:"
echo "   docker compose -f docker-compose.full.yml logs -f voicenote-api"
echo ""
echo "   Then in another terminal:"
echo "   curl http://194.163.134.129:8888/api/auth/signin -X POST -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}'"

echo ""
echo "5. Restarting backend to ensure latest code is running..."
docker compose -f docker-compose.full.yml restart voicenote-api
sleep 3

echo ""
echo "6. Testing again after restart..."
curl -v http://localhost:3333/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' 2>&1 | grep -E "< HTTP|success|error|Endpoint"

echo ""
echo "✅ Done!"

