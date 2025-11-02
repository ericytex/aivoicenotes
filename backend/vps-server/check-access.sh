#!/bin/bash

# Script to verify and configure external access to VoiceNote app

set -e

VPS_IP="${VPS_IP:-194.163.134.129}"
NGINX_PORT="${NGINX_PORT:-8888}"

echo "🔍 Checking External Access Configuration"
echo "════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if containers are running
echo -e "${YELLOW}1. Checking containers...${NC}"
if docker compose -f docker-compose.full.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Containers are running${NC}"
    docker compose -f docker-compose.full.yml ps
else
    echo -e "${RED}❌ Containers are not running${NC}"
    echo "Start them with: docker compose -f docker-compose.full.yml up -d"
    exit 1
fi

echo ""

# Check if port is listening
echo -e "${YELLOW}2. Checking if port $NGINX_PORT is listening...${NC}"
if netstat -tuln 2>/dev/null | grep -q ":$NGINX_PORT " || ss -tuln 2>/dev/null | grep -q ":$NGINX_PORT "; then
    echo -e "${GREEN}✅ Port $NGINX_PORT is listening${NC}"
else
    echo -e "${RED}❌ Port $NGINX_PORT is not listening${NC}"
    echo "Check container logs: docker compose -f docker-compose.full.yml logs nginx"
fi

echo ""

# Check firewall (UFW)
echo -e "${YELLOW}3. Checking firewall (UFW)...${NC}"
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "$NGINX_PORT"; then
        echo -e "${GREEN}✅ Port $NGINX_PORT is allowed in UFW${NC}"
        ufw status | grep "$NGINX_PORT"
    else
        echo -e "${YELLOW}⚠️  Port $NGINX_PORT is not explicitly allowed${NC}"
        echo "Opening port..."
        sudo ufw allow $NGINX_PORT/tcp
        echo -e "${GREEN}✅ Port $NGINX_PORT opened${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW not found. Checking iptables...${NC}"
    if command -v iptables &> /dev/null; then
        if sudo iptables -L -n | grep -q "$NGINX_PORT"; then
            echo -e "${GREEN}✅ Port $NGINX_PORT found in iptables${NC}"
        else
            echo -e "${YELLOW}⚠️  Port $NGINX_PORT might be blocked. Check iptables manually.${NC}"
        fi
    fi
fi

echo ""

# Check if service is responding locally
echo -e "${YELLOW}4. Testing local access...${NC}"
if curl -f -s http://localhost:$NGINX_PORT/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Service is responding locally${NC}"
    curl -s http://localhost:$NGINX_PORT/health | head -1
else
    echo -e "${RED}❌ Service is not responding locally${NC}"
    echo "Check logs: docker compose -f docker-compose.full.yml logs"
fi

echo ""

# Check Nginx configuration
echo -e "${YELLOW}5. Checking Nginx configuration...${NC}"
if [ -f "nginx/html/frontend/index.html" ]; then
    echo -e "${GREEN}✅ Frontend files found${NC}"
else
    echo -e "${RED}❌ Frontend files not found${NC}"
    echo "Frontend directory should be at: nginx/html/frontend/"
fi

echo ""

# Test external access (if possible)
echo -e "${YELLOW}6. External Access Information:${NC}"
echo "   Frontend URL: http://$VPS_IP:$NGINX_PORT"
echo "   API Health: http://$VPS_IP:$NGINX_PORT/health"
echo "   API Endpoint: http://$VPS_IP:$NGINX_PORT/api"
echo ""

# Check if VPS IP matches current server
CURRENT_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "unknown")
if [ "$CURRENT_IP" != "unknown" ]; then
    echo -e "${YELLOW}7. Current server IP: $CURRENT_IP${NC}"
    if [ "$CURRENT_IP" = "$VPS_IP" ]; then
        echo -e "${GREEN}✅ IP matches configured VPS IP${NC}"
    else
        echo -e "${YELLOW}⚠️  IP doesn't match. Update VPS_IP if needed.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Summary:${NC}"
echo ""
echo "Test external access from your computer:"
echo "  curl http://$VPS_IP:$NGINX_PORT/health"
echo ""
echo "Or open in browser:"
echo "  http://$VPS_IP:$NGINX_PORT"
echo ""
echo "If access fails:"
echo "  1. Check VPS firewall allows port $NGINX_PORT"
echo "  2. Check VPS provider's security group/firewall settings"
echo "  3. Verify containers are running"
echo "  4. Check logs: docker compose -f docker-compose.full.yml logs -f"
echo ""

