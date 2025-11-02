#!/bin/bash

# Quick fix for Nginx restarting - reverts to HTTP-only if HTTPS fails

set -e

echo "🔧 Quick Fix for Nginx"
echo "═══════════════════════"
echo ""

cd "$(dirname "$0")"

# Check logs first
echo "Checking Nginx logs..."
docker compose -f docker-compose.full.yml logs --tail=20 nginx 2>&1 | tail -10

echo ""
echo "Reverting to HTTP-only configuration..."

# Ensure we're not trying to use HTTPS without certs
if grep -q "ssl_certificate" nginx/conf.d/frontend.conf 2>/dev/null; then
    echo "⚠️  HTTPS config detected but certificates missing"
    echo "Removing HTTPS configuration..."
fi

# Restore original HTTP-only config
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

    # API proxy - must preserve /api prefix
    location /api {
        proxy_pass http://194.163.134.129:3333;
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
    
    # Health check endpoint (no /api prefix)
    location /health {
        proxy_pass http://194.163.134.129:3333/health;
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

echo "✅ Config reverted to HTTP-only"

# Restart Nginx
echo ""
echo "Restarting Nginx..."
docker compose -f docker-compose.full.yml restart nginx

sleep 3

# Check status
echo ""
echo "Checking status..."
docker compose -f docker-compose.full.yml ps nginx

echo ""
echo "✅ Done! Nginx should be running now on port 8888"
echo "Access at: http://194.163.134.129:8888"
echo ""
echo "⚠️  Note: Microphone won't work without HTTPS"
echo "To enable HTTPS: ./enable-https.sh"

