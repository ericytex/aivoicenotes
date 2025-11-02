#!/bin/bash

# Enable HTTPS for VoiceNote (self-signed or Let's Encrypt)
# NOTE: HTTPS is ONLY needed for microphone recording.
# HTTP works fine for everything else on a personal server!

# Automated HTTPS Setup Script for VoiceNote App
# Sets up HTTPS with self-signed certificate or Let's Encrypt

set -e

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
USE_LETSENCRYPT="${USE_LETSENCRYPT:-false}"
VPS_IP="${VPS_IP:-194.163.134.129}"

echo "🔒 Automated HTTPS Setup"
echo "═══════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")"

# Check if HTTPS is already enabled
if grep -q "listen 443 ssl" nginx/conf.d/frontend.conf 2>/dev/null; then
    echo -e "${YELLOW}⚠️  HTTPS appears to already be enabled${NC}"
    read -p "Do you want to re-configure? (y/n): " reconfigure
    if [ "$reconfigure" != "y" ]; then
        exit 0
    fi
fi

# Determine if using Let's Encrypt or self-signed
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${YELLOW}No domain provided. Setting up self-signed certificate.${NC}"
    echo "Browser will show security warning, but microphone will work."
    echo ""
    USE_LETSENCRYPT=false
else
    echo -e "${YELLOW}Domain provided: $DOMAIN${NC}"
    echo -e "${YELLOW}Email: $EMAIL${NC}"
    read -p "Use Let's Encrypt? (y/n): " use_letsencrypt
    if [ "$use_letsencrypt" = "y" ]; then
        USE_LETSENCRYPT=true
    fi
fi

# Create certificates directory
mkdir -p nginx/certs

# Generate certificates
if [ "$USE_LETSENCRYPT" = "true" ]; then
    echo ""
    echo -e "${YELLOW}Setting up Let's Encrypt certificate...${NC}"
    
    # Install certbot if needed
    if ! command -v certbot &> /dev/null; then
        echo "Installing Certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Stop nginx temporarily
    docker compose -f docker-compose.full.yml stop nginx 2>/dev/null || true
    
    # Get certificate
    sudo certbot certonly --standalone \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        --preferred-challenges http || {
        echo -e "${RED}❌ Failed to get Let's Encrypt certificate${NC}"
        echo "Falling back to self-signed certificate..."
        USE_LETSENCRYPT=false
    }
    
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        # Copy certificates
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/certs/
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/certs/
        sudo chown $USER:$USER nginx/certs/*.pem
        SERVER_NAME="$DOMAIN"
        echo -e "${GREEN}✅ Let's Encrypt certificate obtained!${NC}"
    fi
fi

if [ "$USE_LETSENCRYPT" = "false" ]; then
    echo ""
    echo -e "${YELLOW}Generating self-signed certificate...${NC}"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/certs/privkey.pem \
        -out nginx/certs/fullchain.pem \
        -subj "/C=US/ST=State/L=City/O=VoiceNote/CN=$VPS_IP" \
        -addext "subjectAltName=IP:${VPS_IP}" 2>/dev/null || \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/certs/privkey.pem \
        -out nginx/certs/fullchain.pem \
        -subj "/C=US/ST=State/L=City/O=VoiceNote/CN=$VPS_IP"
    
    SERVER_NAME="_"
    echo -e "${GREEN}✅ Self-signed certificate created!${NC}"
fi

# Backup original config
cp nginx/conf.d/frontend.conf nginx/conf.d/frontend.conf.backup

# Create new config with HTTPS enabled (HTTP on port 80, HTTPS on port 443 inside container)
cat > nginx/conf.d/frontend.conf <<EOF
# VoiceNote Frontend + API Nginx Configuration
# Serves React frontend and proxies API requests to backend

upstream voicenote-api {
    server voicenote-api:3333;
}

# HTTP server - redirect to HTTPS (mapped to port 8888 externally)
server {
    listen 80;
    server_name ${SERVER_NAME};

    # For Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name ${SERVER_NAME};

    # SSL certificates
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Increase upload size for audio files
    client_max_body_size 100M;

    # Frontend (React app)
    location / {
        root /usr/share/nginx/html/frontend;
        try_files \$uri \$uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy - using Docker service name
    location /api {
        proxy_pass http://voicenote-api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts for large uploads
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Health check
    location /health {
        proxy_pass http://voicenote-api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
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

echo -e "${GREEN}✅ Nginx configuration updated${NC}"

# Update docker-compose to add HTTPS port (keep 8888 for HTTP)
if ! grep -q "nginx/certs" docker-compose.full.yml; then
    echo ""
    echo -e "${YELLOW}Updating docker-compose.yml...${NC}"
    
    # Backup
    cp docker-compose.full.yml docker-compose.full.yml.backup
    
    # Add certs volume mount if not present
    # Find the line with nginx/conf.d and add certs mount after it
    if ! grep -q "./nginx/certs" docker-compose.full.yml; then
        sed -i '/nginx\/conf.d\/frontend.conf/a\      # SSL certificates\n      - ./nginx/certs:/etc/nginx/certs:ro' docker-compose.full.yml
    fi
    
    # Ensure HTTPS port is included (8443:443)
    if ! grep -q "8443:443" docker-compose.full.yml; then
        # Add 8443:443 port if only 8888:80 exists
        sed -i 's/- "${NGINX_PORT:-8888}:80"/- "${NGINX_PORT:-8888}:80"\n      - "${NGINX_HTTPS_PORT:-8443}:443"/' docker-compose.full.yml
    fi
    
    echo -e "${GREEN}✅ Docker Compose updated${NC}"
fi

# Update firewall (use custom ports, not 80/443)
echo ""
echo -e "${YELLOW}Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow 8443/tcp 2>/dev/null || true
    sudo ufw allow 8888/tcp 2>/dev/null || true
    echo -e "${GREEN}✅ Firewall updated (ports 8888 and 8443)${NC}"
fi

# Restart containers
echo ""
echo -e "${YELLOW}Restarting containers...${NC}"
docker compose -f docker-compose.full.yml down
docker compose -f docker-compose.full.yml up -d

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ HTTPS Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""

if [ "$USE_LETSENCRYPT" = "true" ]; then
    echo -e "${YELLOW}📍 Access your app at:${NC}"
    echo "   HTTP:  http://${DOMAIN}:8888 (redirects to HTTPS)"
    echo "   HTTPS: https://${DOMAIN}:8443"
    echo ""
    echo -e "${YELLOW}📝 Set up auto-renewal:${NC}"
    echo "   sudo certbot renew --dry-run"
    echo "   # Add to crontab: 0 3 * * * certbot renew --quiet"
else
    echo -e "${YELLOW}📍 Access your app at:${NC}"
    echo "   HTTP:  http://${VPS_IP}:8888 (redirects to HTTPS)"
    echo "   HTTPS: https://${VPS_IP}:8443"
    echo ""
    echo -e "${YELLOW}⚠️  Browser Security Warning:${NC}"
    echo "   Your browser will show a security warning because this is a self-signed certificate."
    echo "   Click 'Advanced' → 'Proceed to ${VPS_IP}:8443 (unsafe)' to continue."
    echo ""
    echo -e "${YELLOW}💡 For production, use Let's Encrypt with a domain:${NC}"
    echo "   DOMAIN=yourdomain.com EMAIL=your@email.com USE_LETSENCRYPT=true ./enable-https.sh"
fi

echo ""
echo -e "${GREEN}✅ Microphone access will now work!${NC}"
echo ""

