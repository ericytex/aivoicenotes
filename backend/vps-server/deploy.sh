#!/bin/bash

# VoiceNote API - Automated Deployment Script
# Run this on your VPS to deploy the backend API

set -e

VPS_IP="194.163.134.129"
# Set your actual frontend URL here (or via FRONTEND_URL env var)
# For full VPS deployment (frontend + backend), use deploy-full.sh instead
# Examples:
# - Vercel: https://your-app.vercel.app
# - Local dev: http://localhost:5173
# - Custom domain: https://yourdomain.com
# - Full VPS: http://your-vps-ip (use deploy-full.sh)
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
PORT=3333

echo "🚀 VoiceNote API - Automated Deployment"
echo "═══════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please don't run as root. Use a regular user with sudo privileges.${NC}"
   exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   VPS IP: $VPS_IP"
echo "   Frontend URL: $FRONTEND_URL"
echo "   Port: $PORT"
echo ""
if [ "$FRONTEND_URL" = "http://localhost:5173" ]; then
    echo -e "${YELLOW}⚠️  Using default localhost. Set FRONTEND_URL if you have a deployed frontend.${NC}"
    echo "   Example: FRONTEND_URL=https://your-app.vercel.app ./deploy.sh"
    echo ""
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed${NC}"
    echo -e "${YELLOW}⚠️  Please log out and back in for Docker group changes to take effect, then run this script again.${NC}"
    exit 0
fi

echo -e "${GREEN}✅ Docker: $(docker --version)${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
fi

echo -e "${GREEN}✅ Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version)${NC}"
echo ""

# Create deployment directory
DEPLOY_DIR="$HOME/voicenote-api"
echo -e "${YELLOW}📁 Setting up deployment directory...${NC}"

if [ -d "$DEPLOY_DIR" ]; then
    echo -e "${YELLOW}⚠️  Directory exists. Updating...${NC}"
    cd "$DEPLOY_DIR"
    if [ -d ".git" ]; then
        git pull || echo -e "${YELLOW}⚠️  Git pull failed, continuing...${NC}"
    fi
else
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    git clone https://github.com/ericytex/aivoicenotes.git "$DEPLOY_DIR"
    cd "$DEPLOY_DIR/backend/vps-server"
fi

# Navigate to backend directory
cd "$DEPLOY_DIR/backend/vps-server" 2>/dev/null || {
    echo -e "${RED}❌ Backend directory not found. Please check the repository structure.${NC}"
    exit 1
}

# Create .env file
echo -e "${YELLOW}⚙️  Configuring environment...${NC}"
if [ ! -f .env ]; then
    cp env.example.txt .env
    echo -e "${GREEN}✅ Created .env file${NC}"
fi

# Update .env with frontend URL
if grep -q "CORS_ORIGIN=" .env; then
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=$FRONTEND_URL|" .env
else
    echo "CORS_ORIGIN=$FRONTEND_URL" >> .env
fi

# Ensure PORT is set
if ! grep -q "PORT=" .env; then
    echo "PORT=$PORT" >> .env
fi

echo -e "${GREEN}✅ Environment configured${NC}"

# Create necessary directories
mkdir -p data uploads logs
echo -e "${GREEN}✅ Directories created${NC}"

# Build and start containers
echo ""
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker-compose build --no-cache

echo ""
echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker-compose up -d

echo ""
echo -e "${YELLOW}⏳ Waiting for service to start...${NC}"
sleep 5

# Check health
echo ""
echo -e "${YELLOW}🏥 Checking service health...${NC}"
for i in {1..10}; do
    if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Service is healthy!${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Service health check failed${NC}"
        echo -e "${YELLOW}📊 Checking logs...${NC}"
        docker-compose logs --tail=20
        exit 1
    fi
    sleep 2
done

# Configure firewall
echo ""
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow $PORT/tcp 2>/dev/null || true
    echo -e "${GREEN}✅ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠️  UFW not found. Please manually open port $PORT${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📍 Service Information:${NC}"
echo "   API URL: http://$VPS_IP:$PORT"
echo "   Health: http://$VPS_IP:$PORT/health"
echo "   Frontend should use: http://$VPS_IP:$PORT"
echo ""
echo -e "${YELLOW}📊 Useful Commands:${NC}"
echo "   View logs:    cd $DEPLOY_DIR/backend/vps-server && docker-compose logs -f"
echo "   Restart:     cd $DEPLOY_DIR/backend/vps-server && docker-compose restart"
echo "   Stop:        cd $DEPLOY_DIR/backend/vps-server && docker-compose down"
echo "   Status:      cd $DEPLOY_DIR/backend/vps-server && docker-compose ps"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. Update your frontend .env with: VITE_API_URL=http://$VPS_IP:$PORT"
echo "   2. Test the API: curl http://$VPS_IP:$PORT/health"
echo "   3. Check logs if anything fails: docker-compose logs"
echo ""

