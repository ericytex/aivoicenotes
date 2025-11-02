#!/bin/bash

# VoiceNote Full Stack - Automated Deployment Script (Frontend + Backend)
# Run this on your VPS to deploy both frontend and backend

set -e

VPS_IP="${VPS_IP:-194.163.134.129}"
PORT=3333
NGINX_PORT="${NGINX_PORT:-8080}"
FRONTEND_URL="${FRONTEND_URL:-http://$VPS_IP:$NGINX_PORT}"

echo "🚀 VoiceNote Full Stack - Automated Deployment"
echo "═══════════════════════════════════════════════"
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
echo "   Frontend Port: $NGINX_PORT"
echo "   Backend Port: $PORT"
echo ""

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

# Check Docker Compose (prefer plugin version, fallback to standalone)
COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo -e "${GREEN}✅ Docker Compose (plugin): $(docker compose version)${NC}"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo -e "${GREEN}✅ Docker Compose (standalone): $(docker-compose --version)${NC}"
else
    echo -e "${YELLOW}📦 Installing Docker Compose...${NC}"
    # Try plugin installation first (for newer Docker)
    if docker version &> /dev/null; then
        # Install as plugin
        sudo mkdir -p /usr/local/lib/docker/cli-plugins
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
        sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
        if docker compose version &> /dev/null; then
            COMPOSE_CMD="docker compose"
            echo -e "${GREEN}✅ Docker Compose (plugin) installed${NC}"
        fi
    fi
    
    # Fallback to standalone if plugin didn't work
    if [ -z "$COMPOSE_CMD" ]; then
        echo -e "${YELLOW}Installing Docker Compose (standalone)...${NC}"
        # Get latest version
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K[^"]+' | head -1)
        if [ -z "$COMPOSE_VERSION" ]; then
            COMPOSE_VERSION="v2.24.5"  # Fallback to known working version
        fi
        ARCH=$(uname -m)
        [ "$ARCH" = "x86_64" ] && ARCH="x86_64" || ARCH="aarch64"
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
        DOWNLOAD_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-${OS}-${ARCH}"
        
        sudo curl -L "$DOWNLOAD_URL" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        
        # Verify it's actually a binary, not an HTML error page
        if file /usr/local/bin/docker-compose | grep -q "executable"; then
            if docker-compose --version &> /dev/null 2>&1; then
                COMPOSE_CMD="docker-compose"
                echo -e "${GREEN}✅ Docker Compose (standalone) installed${NC}"
            else
                echo -e "${RED}❌ Docker Compose installed but not working${NC}"
                echo -e "${YELLOW}Please install manually: https://docs.docker.com/compose/install/${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ Failed to download Docker Compose binary${NC}"
            echo -e "${YELLOW}Attempting alternative installation method...${NC}"
            # Try pip installation as fallback
            if command -v pip3 &> /dev/null; then
                sudo pip3 install docker-compose
                if command -v docker-compose &> /dev/null && docker-compose --version &> /dev/null 2>&1; then
                    COMPOSE_CMD="docker-compose"
                    echo -e "${GREEN}✅ Docker Compose installed via pip${NC}"
                fi
            fi
            
            if [ -z "$COMPOSE_CMD" ]; then
                echo -e "${RED}❌ Failed to install Docker Compose${NC}"
                echo -e "${YELLOW}Please install manually:${NC}"
                echo "   sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
                echo "   OR: https://docs.docker.com/compose/install/"
                exit 1
            fi
        fi
    fi
fi

# Verify installation
if [ -z "$COMPOSE_CMD" ]; then
    echo -e "${RED}❌ Docker Compose not found${NC}"
    exit 1
fi

# Check Node.js (for building frontend)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js installed${NC}"
fi

echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
echo ""

# Create deployment directory
DEPLOY_DIR="$HOME/voicenote-full"
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
fi

# Navigate to project root
cd "$DEPLOY_DIR"

# Build frontend
echo ""
echo -e "${YELLOW}🏗️  Building frontend...${NC}"

# Check if node_modules exists, if not install
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Create .env for frontend if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  Creating frontend .env...${NC}"
    cat > .env << EOF
# Backend API URL - use relative path since served from same domain
VITE_API_URL=
EOF
    echo -e "${GREEN}✅ Frontend .env created${NC}"
fi

# Build frontend
echo -e "${YELLOW}🔨 Building React app...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Setup backend
cd "$DEPLOY_DIR/backend/vps-server"

# Create .env file
echo ""
echo -e "${YELLOW}⚙️  Configuring backend environment...${NC}"
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

echo -e "${GREEN}✅ Backend environment configured${NC}"

# Create necessary directories
mkdir -p data uploads logs nginx/html/frontend

# Copy frontend build to nginx directory
echo ""
echo -e "${YELLOW}📋 Copying frontend build to Nginx directory...${NC}"
cp -r "$DEPLOY_DIR/dist/"* nginx/html/frontend/
echo -e "${GREEN}✅ Frontend files copied${NC}"

# Use full stack docker-compose
echo ""
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
$COMPOSE_CMD -f docker-compose.full.yml build --no-cache

echo ""
echo -e "${YELLOW}🚀 Starting containers...${NC}"
$COMPOSE_CMD -f docker-compose.full.yml up -d

echo ""
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 5

# Check health
echo ""
echo -e "${YELLOW}🏥 Checking service health...${NC}"
for i in {1..10}; do
    if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API is healthy!${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Backend health check failed${NC}"
        echo -e "${YELLOW}📊 Checking logs...${NC}"
        $COMPOSE_CMD -f docker-compose.full.yml logs --tail=20
        exit 1
    fi
    sleep 2
done

# Check Nginx
for i in {1..5}; do
    if curl -f http://localhost/ > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Nginx is serving frontend!${NC}"
        break
    fi
    sleep 2
done

# Configure firewall
echo ""
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow $NGINX_PORT/tcp 2>/dev/null || true
    sudo ufw allow ${NGINX_HTTPS_PORT:-8443}/tcp 2>/dev/null || true
    echo -e "${GREEN}✅ Firewall configured (ports $NGINX_PORT and ${NGINX_HTTPS_PORT:-8443})${NC}"
else
    echo -e "${YELLOW}⚠️  UFW not found. Please manually open ports $NGINX_PORT and ${NGINX_HTTPS_PORT:-8443}${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Full Stack Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📍 Service Information:${NC}"
echo "   Frontend: http://$VPS_IP:$NGINX_PORT"
echo "   API: http://$VPS_IP:$NGINX_PORT/api"
echo "   Health: http://$VPS_IP:$NGINX_PORT/health"
echo ""
echo -e "${YELLOW}📊 Useful Commands:${NC}"
echo "   View logs:     cd $DEPLOY_DIR/backend/vps-server && $COMPOSE_CMD -f docker-compose.full.yml logs -f"
echo "   Restart:      cd $DEPLOY_DIR/backend/vps-server && $COMPOSE_CMD -f docker-compose.full.yml restart"
echo "   Stop:         cd $DEPLOY_DIR/backend/vps-server && $COMPOSE_CMD -f docker-compose.full.yml down"
echo "   Status:       cd $DEPLOY_DIR/backend/vps-server && $COMPOSE_CMD -f docker-compose.full.yml ps"
echo ""
echo -e "${YELLOW}🔄 To Update Frontend:${NC}"
echo "   1. cd $DEPLOY_DIR"
echo "   2. git pull"
echo "   3. npm run build"
echo "   4. cp -r dist/* backend/vps-server/nginx/html/frontend/"
echo "   5. $COMPOSE_CMD -f backend/vps-server/docker-compose.full.yml restart nginx"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. Visit http://$VPS_IP:$NGINX_PORT in your browser"
echo "   2. Test the API: curl http://$VPS_IP:$NGINX_PORT/health"
echo "   3. Check logs if needed: $COMPOSE_CMD -f docker-compose.full.yml logs -f"
echo "   4. Configure SSL (optional): See VPS_FULL_STACK.md"
echo "   5. See POST_DEPLOY.md for detailed next steps"
echo ""
echo -e "${GREEN}✨ Deployment complete! Your app is live at http://$VPS_IP:$NGINX_PORT${NC}"
echo ""

