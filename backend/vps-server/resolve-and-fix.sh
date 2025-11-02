#!/bin/bash

# Resolve merge conflict and apply Nginx fix

set -e

echo "🔄 Resolving merge conflict and applying fix..."
echo "═════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# Backup local changes (if in git repo)
echo "1. Checking for local changes..."
if [ -d ".git" ]; then
    echo "   Stashing local changes (if any)..."
    git stash push -m "Local Nginx config changes before fix" 2>/dev/null || echo "   No local changes to stash"
    
    echo ""
    echo "2. Pulling latest changes..."
    git pull || echo "   Git pull failed or not needed"
else
    echo "   Not a git repository, skipping git operations"
fi

# Now run the fix
echo ""
echo "3. Running comprehensive fix..."
if [ -f "fix-nginx-now.sh" ]; then
    chmod +x fix-nginx-now.sh
    ./fix-nginx-now.sh
else
    echo "❌ fix-nginx-now.sh not found after pull"
    echo "   Trying manual fix..."
    
    # Stop containers
    docker compose -f docker-compose.full.yml down
    
    # Create clean config
    mkdir -p nginx/conf.d
    cat > nginx/conf.d/frontend.conf <<'EOF'
# VoiceNote Frontend + API Nginx Configuration
upstream voicenote-api {
    server voicenote-api:3333;
}

server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }

    location / {
        root /usr/share/nginx/html/frontend;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

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
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    location /health {
        proxy_pass http://voicenote-api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    location /uploads/ {
        alias /usr/share/nginx/html/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    echo "✅ Config created"
    
    # Start containers
    docker compose -f docker-compose.full.yml up -d
    
    echo ""
    echo "✅ Done! Check status:"
    echo "   docker compose -f docker-compose.full.yml ps"
fi

