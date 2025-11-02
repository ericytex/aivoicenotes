#!/bin/bash

# Quick status check script

echo "📊 VoiceNote Container Status"
echo "═══════════════════════════════"
echo ""

cd "$(dirname "$0")"

echo "All containers:"
docker compose -f docker-compose.full.yml ps

echo ""
echo "Detailed status:"
docker compose -f docker-compose.full.yml ps -a

echo ""
echo "Nginx logs (last 20 lines):"
docker compose -f docker-compose.full.yml logs --tail=20 nginx 2>/dev/null || echo "Nginx container not found"

echo ""
echo "API logs (last 20 lines):"
docker compose -f docker-compose.full.yml logs --tail=20 voicenote-api

echo ""
echo "═══════════════════════════════"
echo ""
echo "Quick fixes:"
echo "  Start all:     docker compose -f docker-compose.full.yml up -d"
echo "  Restart:       docker compose -f docker-compose.full.yml restart"
echo "  View logs:     docker compose -f docker-compose.full.yml logs -f"
echo ""

