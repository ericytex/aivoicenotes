#!/bin/bash

# Quick fix script for database permissions issue

echo "🔧 Fixing database directory permissions..."

cd "$(dirname "$0")"

# Create data directory if it doesn't exist
mkdir -p data uploads

# Fix permissions
# Get the user ID that Docker uses (usually 1001 for nodejs user in Alpine)
# But we'll make it writable by all for now (Docker handles this better)
chmod 777 data uploads

echo "✅ Permissions fixed!"
echo ""
echo "Now restart the containers:"
echo "  docker compose -f docker-compose.full.yml restart voicenote-api"

