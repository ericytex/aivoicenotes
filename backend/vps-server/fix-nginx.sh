#!/bin/bash

# Quick fix for Nginx restarting issues

echo "🔧 Diagnosing Nginx Issues"
echo "═══════════════════════════"
echo ""

cd "$(dirname "$0")"

echo "1. Checking Nginx logs..."
docker compose -f docker-compose.full.yml logs --tail=30 nginx

echo ""
echo "2. Testing Nginx config syntax..."
# Try to exec into container and test config
docker compose -f docker-compose.full.yml exec nginx nginx -t 2>&1 || echo "Container not running, can't test"

echo ""
echo "3. Checking if config file exists..."
ls -la nginx/conf.d/frontend.conf

echo ""
echo "4. Checking if certificates exist (if HTTPS enabled)..."
if grep -q "ssl_certificate" nginx/conf.d/frontend.conf 2>/dev/null; then
    echo "HTTPS detected in config, checking certificates..."
    ls -la nginx/certs/ 2>/dev/null || echo "⚠️  Certificates directory not found"
    if [ ! -f "nginx/certs/fullchain.pem" ] || [ ! -f "nginx/certs/privkey.pem" ]; then
        echo "❌ Certificate files missing!"
        echo "Run: ./enable-https.sh to generate certificates"
    fi
fi

echo ""
echo "5. Common fixes:"
echo "   - If config error: Check nginx/conf.d/frontend.conf syntax"
echo "   - If certs missing: Run ./enable-https.sh"
echo "   - If volume mount error: Check docker-compose.full.yml"
echo ""

