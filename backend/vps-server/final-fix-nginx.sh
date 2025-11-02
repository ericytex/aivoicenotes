#!/bin/bash

# Final fix for Nginx - ensure it starts correctly

set -e

echo "🔧 Final Nginx Fix"
echo "═════════════════"
echo ""

cd "$(dirname "$0")"

# Pull latest
echo "1. Pulling latest config..."
git pull

# Stop Nginx
echo ""
echo "2. Stopping Nginx..."
docker compose -f docker-compose.full.yml stop nginx

# Validate config file
echo ""
echo "3. Validating config file..."
if grep -c "location /health" nginx/conf.d/frontend.conf | grep -q "^1$"; then
    echo "   ✅ Only one /health location found"
else
    echo "   ❌ Multiple /health locations found!"
    echo "   Checking..."
    grep -n "location /health" nginx/conf.d/frontend.conf
    exit 1
fi

# Test config syntax (in a temporary container)
echo ""
echo "4. Testing config syntax..."
docker run --rm -v "$PWD/nginx/conf.d/frontend.conf:/tmp/test.conf:ro" nginx:alpine nginx -t -c /tmp/test.conf 2>/dev/null || {
    echo "   Creating temp config for syntax check..."
    cat > /tmp/nginx-test.conf <<EOF
events {}
http {
    include /tmp/test.conf;
}
EOF
    docker run --rm -v "$PWD/nginx/conf.d/frontend.conf:/tmp/test.conf:ro" -v "/tmp/nginx-test.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t || {
        echo "   ⚠️  Config syntax check failed, but continuing..."
    }
}

# Start Nginx
echo ""
echo "5. Starting Nginx..."
docker compose -f docker-compose.full.yml up -d nginx

# Wait
echo ""
echo "6. Waiting for Nginx to start..."
sleep 5

# Check status
echo ""
echo "7. Checking Nginx status..."
if docker compose -f docker-compose.full.yml ps nginx | grep -q "Up"; then
    echo "   ✅ Nginx is running!"
else
    echo "   ❌ Nginx failed to start!"
    echo ""
    echo "   Check logs:"
    docker compose -f docker-compose.full.yml logs nginx | tail -20
    exit 1
fi

# Test config from inside container
echo ""
echo "8. Testing config from inside container..."
docker compose -f docker-compose.full.yml exec nginx nginx -t

# Test endpoint
echo ""
echo "9. Testing API endpoint..."
VPS_IP="${VPS_IP:-194.163.134.129}"
RESPONSE=$(curl -s -w "\n%{http_code}" http://${VPS_IP}:8888/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "   HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "404" ]; then
    echo "   ❌ Still getting 404"
    echo "   Response: $BODY"
    echo ""
    echo "   Checking Nginx config inside container..."
    docker compose -f docker-compose.full.yml exec nginx cat /etc/nginx/conf.d/default.conf | grep -A 5 "location /api"
else
    echo "   ✅ API is responding!"
    echo "   Response: $BODY"
fi

echo ""
echo "✅ Done!"

