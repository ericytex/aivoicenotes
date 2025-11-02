#!/bin/bash

# Fix Nginx API proxy configuration

set -e

echo "🔧 Fixing Nginx API Proxy"
echo "══════════════════════════"
echo ""

cd "$(dirname "$0")"

# Stop containers
echo "1. Stopping Nginx..."
docker compose -f docker-compose.full.yml stop nginx

# Ensure the config file exists and is correct
echo ""
echo "2. Checking Nginx configuration..."
if [ ! -f "nginx/conf.d/frontend.conf" ]; then
    echo "❌ frontend.conf not found!"
    exit 1
fi

# Verify the config
echo "   Checking for /api location block..."
if grep -q "location /api" nginx/conf.d/frontend.conf; then
    echo "   ✅ /api location block found"
else
    echo "   ❌ /api location block missing!"
    exit 1
fi

# Check docker-compose to see how config is mounted
echo ""
echo "3. Checking Docker Compose configuration..."
if grep -q "frontend.conf" docker-compose.full.yml; then
    echo "   ✅ frontend.conf is mounted in docker-compose"
else
    echo "   ⚠️  frontend.conf might not be mounted correctly"
fi

# Restart Nginx
echo ""
echo "4. Starting Nginx..."
docker compose -f docker-compose.full.yml up -d nginx

echo ""
echo "5. Waiting for Nginx to start..."
sleep 3

# Test the config
echo ""
echo "6. Testing Nginx configuration..."
if docker compose -f docker-compose.full.yml exec nginx nginx -t 2>&1; then
    echo "   ✅ Nginx config is valid"
else
    echo "   ❌ Nginx config has errors!"
    exit 1
fi

# Reload Nginx to apply changes
echo ""
echo "7. Reloading Nginx..."
docker compose -f docker-compose.full.yml exec nginx nginx -s reload

echo ""
echo "8. Verifying /api location is active..."
docker compose -f docker-compose.full.yml exec nginx cat /etc/nginx/conf.d/default.conf | grep -A 5 "location /api" || {
    echo "   ⚠️  Could not verify /api location in running config"
}

echo ""
echo "✅ Done!"
echo ""
echo "📍 Test the API:"
echo "   curl http://194.163.134.129:8888/api/auth/signin"
echo ""
echo "   Or check logs:"
echo "   docker compose -f docker-compose.full.yml logs nginx | tail -20"

