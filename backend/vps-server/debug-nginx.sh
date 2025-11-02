#!/bin/bash

# Debug Nginx container issues

echo "🐛 Debugging Nginx Container"
echo "═════════════════════════════"
echo ""

echo "1. Checking Nginx logs..."
docker compose -f docker-compose.full.yml logs --tail=50 nginx

echo ""
echo "2. Checking if Nginx config files exist..."
ls -la nginx/nginx.conf
ls -la nginx/conf.d/

echo ""
echo "3. Testing Nginx config syntax (in container)..."
docker compose -f docker-compose.full.yml exec nginx nginx -t 2>&1 || echo "Container not running, can't test config"

echo ""
echo "4. Checking frontend files..."
ls -la nginx/html/frontend/ | head -10

echo ""
echo "5. Checking container status..."
docker compose -f docker-compose.full.yml ps nginx

echo ""
echo "6. Checking if port is in use..."
sudo netstat -tuln | grep 8888 || echo "Port 8888 not in use"

echo ""
echo "═════════════════════════════"
echo "Common fixes:"
echo "1. If config error: Check nginx/conf.d/frontend.conf"
echo "2. If files missing: Run deploy-full.sh again"
echo "3. If port conflict: Change NGINX_PORT in docker-compose.full.yml"
echo ""

