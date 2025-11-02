#!/bin/bash

# SSL Setup Script for VoiceNote App
# Sets up HTTPS using Let's Encrypt

set -e

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

echo "🔒 SSL Certificate Setup"
echo "════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if domain is provided
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}⚠️  No domain specified.${NC}"
    echo ""
    echo "Usage:"
    echo "  DOMAIN=yourdomain.com EMAIL=your@email.com ./setup-ssl.sh"
    echo ""
    echo "If you don't have a domain, you can:"
    echo "  1. Use a free domain from services like DuckDNS, No-IP, etc."
    echo "  2. Access via IP with HTTP (microphone won't work)"
    echo "  3. Set up self-signed certificate (browser will show warning)"
    echo ""
    read -p "Do you have a domain? (y/n): " has_domain
    
    if [ "$has_domain" != "y" ]; then
        echo ""
        echo -e "${YELLOW}Setting up self-signed certificate (for testing only)...${NC}"
        echo "Browser will show security warning, but microphone will work."
        echo ""
        
        # Create self-signed certificate
        mkdir -p nginx/certs
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/certs/privkey.pem \
            -out nginx/certs/fullchain.pem \
            -subj "/C=US/ST=State/L=City/O=VoiceNote/CN=194.163.134.129"
        
        echo -e "${GREEN}✅ Self-signed certificate created${NC}"
        echo ""
        echo "To use HTTPS, you need to:"
        echo "  1. Update nginx/conf.d/frontend.conf to enable HTTPS server block"
        echo "  2. Change port mapping in docker-compose.full.yml from 8888:80 to 443:443"
        echo "  3. Restart containers"
        exit 0
    fi
    
    read -p "Enter your domain: " DOMAIN
    read -p "Enter your email (for Let's Encrypt): " EMAIL
fi

if [ -z "$EMAIL" ]; then
    read -p "Enter your email (for Let's Encrypt): " EMAIL
fi

echo ""
echo -e "${YELLOW}Setting up SSL for domain: $DOMAIN${NC}"
echo ""

# Install Certbot
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Installing Certbot...${NC}"
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
else
    echo -e "${GREEN}✅ Certbot already installed${NC}"
fi

# Ensure port 80 is open for verification
echo -e "${YELLOW}Ensuring port 80 is open...${NC}"
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true

# Update Nginx config temporarily for verification
echo -e "${YELLOW}Configuring Nginx for SSL verification...${NC}"

# Create temporary server block for verification
sudo tee /tmp/voicenote-ssl.conf > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF

# Stop containers temporarily
cd ~/voicenote-full/backend/vps-server
docker compose -f docker-compose.full.yml stop nginx 2>/dev/null || true

# Get certificate
echo ""
echo -e "${YELLOW}Obtaining SSL certificate from Let's Encrypt...${NC}"
echo "This may take a few minutes..."
echo ""

sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

# Copy certificates to project directory
echo ""
echo -e "${YELLOW}Copying certificates...${NC}"
mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/certs/
sudo chown $USER:$USER nginx/certs/*.pem

# Update Nginx config for HTTPS
echo -e "${YELLOW}Updating Nginx configuration...${NC}"
sed -i "s/server_name _;/server_name $DOMAIN;/" nginx/conf.d/frontend.conf

# Enable HTTPS server block (uncomment it)
# This would need manual editing, but let's provide instructions
echo ""
echo -e "${GREEN}✅ SSL certificate obtained!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update nginx/conf.d/frontend.conf:"
echo "   - Uncomment the HTTPS server block (lines 70-134)"
echo "   - Update server_name to: $DOMAIN"
echo "   - Certificate paths should be:"
echo "     /etc/nginx/certs/fullchain.pem"
echo "     /etc/nginx/certs/privkey.pem"
echo ""
echo "2. Update docker-compose.full.yml:"
echo "   - Change ports from \"8888:80\" to \"443:443\""
echo "   - Add volume mount: ./nginx/certs:/etc/nginx/certs:ro"
echo ""
echo "3. Restart containers:"
echo "   docker compose -f docker-compose.full.yml up -d"
echo ""
echo "4. Access your app at: https://$DOMAIN"
echo ""
echo "5. Set up auto-renewal:"
echo "   sudo certbot renew --dry-run"
echo ""

