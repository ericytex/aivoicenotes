#!/bin/bash

# Comprehensive fix for Nginx restarting issue

set -e

echo "🔧 Comprehensive Nginx Fix"
echo "═══════════════════════════"
echo ""

cd "$(dirname "$0")"

# Stop containers first
echo "1. Stopping containers..."
docker compose -f docker-compose.full.yml down

# Check for HTTPS config without certs
if grep -q "ssl_certificate" nginx/conf.d/frontend.conf 2>/dev/null; then
    echo ""
    echo "2. Removing broken HTTPS configuration..."
    # Backup
    cp nginx/conf.d/frontend.conf nginx/conf.d/frontend.conf.backup-$(date +%Y%m%d-%H%M%S)
fi

# Create clean HTTP-only config using Docker service name (proper way)
echo ""
echo "3. Creating clean HTTP-only configuration..."
cat > nginx/conf.d/frontend.conf <<'EOF'
# VoiceNote Frontend + API Nginx Configuration
# Serves React frontend and proxies API requests to backend

upstream voicenote-api {
    server voicenote-api:3333;
}

# HTTP server
server {
    listen 80;
    server_name _;

    # For Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }

    # Frontend (React app)
    location / {
        root /usr/share/nginx/html/frontend;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy - using Docker service name (works on same network)
    location /api {
        proxy_pass http://voicenote-api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for large uploads
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Health check
    location /health {
        proxy_pass http://voicenote-api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Serve uploaded files directly
    location /uploads/ {
        alias /usr/share/nginx/html/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "✅ Configuration created"

# Ensure frontend files exist
echo ""
echo "4. Checking frontend files..."
if [ ! -d "nginx/html/frontend" ] || [ ! -f "nginx/html/frontend/index.html" ]; then
    echo "⚠️  Frontend files missing!"
    echo "   Run: cd ~/voicenote-full && npm run build && cp -r dist/* backend/vps-server/nginx/html/frontend/"
else
    echo "✅ Frontend files found"
fi

# Ensure docker-compose doesn't have HTTPS port conflict
echo ""
echo "5. Updating docker-compose (removing HTTPS port if causing issues)..."
# Check if we need to comment out HTTPS port
if grep -q "8443:443" docker-compose.full.yml && ! grep -q "./nginx/certs" docker-compose.full.yml; then
    echo "⚠️  HTTPS port mapped but no certs - commenting out..."
    sed -i 's/- "${NGINX_HTTPS_PORT:-8443}:443"/# - "${NGINX_HTTPS_PORT:-8443}:443"/' docker-compose.full.yml
fi

# Start containers
echo ""
echo "6. Starting containers..."
docker compose -f docker-compose.full.yml up -d

echo ""
echo "7. Waiting for services..."
sleep 5

# Check status
echo ""
echo "8. Checking status..."
docker compose -f docker-compose.full.yml ps

# Test Nginx
echo ""
echo "9. Testing Nginx..."
if docker compose -f docker-compose.full.yml exec nginx nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx config is valid"
else
    echo "❌ Nginx config has errors:"
    docker compose -f docker-compose.full.yml exec nginx nginx -t 2>&1 || true
fi

# Check if running
echo ""
echo "10. Final check..."
sleep 2
if docker compose -f docker-compose.full.yml ps | grep -q "voicenote-nginx.*Up"; then
    echo "✅ Nginx is running!"
    echo ""
    echo "📍 Access your app at: http://194.163.134.129:8888"
    echo ""
    echo "⚠️  To enable recording (microphone), you need HTTPS:"
    echo "   ./enable-https.sh"
else
    echo "❌ Nginx is still restarting. Check logs:"
    echo "   docker compose -f docker-compose.full.yml logs nginx"
fi

