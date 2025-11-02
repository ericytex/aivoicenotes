#!/bin/bash

# Quick fix for permissions issue

set -e

echo "🔧 Fixing Permissions"
echo "══════════════════════"
echo ""

cd "$(dirname "$0")"

# Stop containers
echo "1. Stopping containers..."
docker compose -f docker-compose.full.yml stop

# Fix permissions on host directories
echo ""
echo "2. Fixing permissions on data and uploads directories..."

# Create directories if they don't exist
mkdir -p data uploads

# Get the UID/GID that the container uses (nodejs user is typically 1000:1000)
# But we'll use 777 for simplicity in this case
chmod -R 777 data uploads

# Also ensure ownership allows container to write
sudo chown -R $USER:$USER data uploads 2>/dev/null || true

echo "   ✅ Permissions fixed"
echo ""

# Verify permissions
echo "3. Verifying permissions..."
ls -ld data uploads
ls -la data/ uploads/ 2>/dev/null | head -5 || echo "   Directories are empty (this is OK)"

echo ""
echo "4. Starting containers..."
docker compose -f docker-compose.full.yml up -d

echo ""
echo "5. Waiting for backend to start..."
sleep 10

echo ""
echo "6. Checking backend status..."
docker compose -f docker-compose.full.yml ps voicenote-api

echo ""
echo "7. Testing backend..."
sleep 5
curl -s http://localhost:3333/health | jq . 2>/dev/null || curl -s http://localhost:3333/health || echo "   ⚠️  Backend not responding yet"

echo ""
echo "✅ Done!"
echo ""
echo "If still having issues, check logs:"
echo "   docker compose -f docker-compose.full.yml logs voicenote-api | tail -30"

