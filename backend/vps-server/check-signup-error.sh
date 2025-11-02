#!/bin/bash

# Check signup error

echo "🔍 Checking Signup Error"
echo "═════════════════════════"
echo ""

cd "$(dirname "$0")"

echo "1. Testing signup directly on backend..."
curl -v http://localhost:3333/api/auth/signup \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' 2>&1 | head -40

echo ""
echo ""
echo "2. Checking backend logs for errors..."
docker compose -f docker-compose.full.yml logs voicenote-api | grep -i "error\|signup\|exception" | tail -20

echo ""
echo ""
echo "3. Checking recent backend logs..."
docker compose -f docker-compose.full.yml logs voicenote-api | tail -30

echo ""
echo ""
echo "4. Testing signin directly..."
curl -v http://localhost:3333/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' 2>&1 | head -40

echo ""
echo ""
echo "✅ Done!"
echo ""
echo "If signup returns 500, check:"
echo "   - Database permissions: ls -la data/"
echo "   - Backend logs: docker compose -f docker-compose.full.yml logs voicenote-api | tail -50"

