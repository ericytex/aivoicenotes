#!/bin/bash

# Script to configure firewall for VoiceNote app

set -e

NGINX_PORT="${NGINX_PORT:-8888}"

echo "🔥 Configuring Firewall for External Access"
echo "═══════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# UFW Configuration
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}Configuring UFW...${NC}"
    
    # Check if UFW is active
    if sudo ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✅ UFW is active${NC}"
    else
        echo -e "${YELLOW}⚠️  UFW is not active. Enabling...${NC}"
        echo "y" | sudo ufw --force enable
    fi
    
    # Allow SSH (important - don't lock yourself out!)
    if sudo ufw status | grep -q "22/tcp"; then
        echo -e "${GREEN}✅ SSH (port 22) already allowed${NC}"
    else
        echo -e "${YELLOW}⚠️  SSH not explicitly allowed. Adding...${NC}"
        sudo ufw allow 22/tcp
        echo -e "${GREEN}✅ SSH allowed${NC}"
    fi
    
    # Allow Nginx port
    sudo ufw allow $NGINX_PORT/tcp
    echo -e "${GREEN}✅ Port $NGINX_PORT opened${NC}"
    
    # Show status
    echo ""
    echo -e "${YELLOW}Current UFW rules:${NC}"
    sudo ufw status numbered
    
    echo ""
    echo -e "${GREEN}✅ Firewall configured!${NC}"
    
elif command -v iptables &> /dev/null; then
    echo -e "${YELLOW}Configuring iptables...${NC}"
    
    # Allow Nginx port
    sudo iptables -A INPUT -p tcp --dport $NGINX_PORT -j ACCEPT
    
    # Save rules (depends on distro)
    if command -v netfilter-persistent &> /dev/null; then
        sudo netfilter-persistent save
    elif [ -f /etc/redhat-release ]; then
        sudo service iptables save
    else
        echo -e "${YELLOW}⚠️  Please save iptables rules manually${NC}"
    fi
    
    echo -e "${GREEN}✅ iptables configured!${NC}"
    
else
    echo -e "${RED}❌ No firewall tool found (ufw or iptables)${NC}"
    echo "Please configure your firewall manually to allow port $NGINX_PORT"
fi

echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  If using a VPS provider (DigitalOcean, AWS, etc.),"
echo "  you also need to configure their security group/firewall:"
echo ""
echo "  - DigitalOcean: Firewall settings in Control Panel"
echo "  - AWS: Security Groups"
echo "  - Google Cloud: Firewall Rules"
echo "  - Azure: Network Security Groups"
echo ""
echo "  Allow incoming TCP traffic on port $NGINX_PORT"
echo ""

