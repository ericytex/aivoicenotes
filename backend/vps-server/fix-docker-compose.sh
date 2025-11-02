#!/bin/bash

# Quick fix for Docker Compose installation issues

echo "🔧 Fixing Docker Compose installation..."

# Remove corrupted installation
if [ -f /usr/local/bin/docker-compose ]; then
    sudo rm /usr/local/bin/docker-compose
fi

# Try plugin installation (modern Docker)
if docker version &> /dev/null; then
    echo "📦 Installing Docker Compose as plugin..."
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VERSION="v2.24.5"
    ARCH=$(uname -m)
    [ "$ARCH" = "x86_64" ] && ARCH="x86_64" || ARCH="aarch64"
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-${OS}-${ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    
    if docker compose version &> /dev/null; then
        echo "✅ Docker Compose (plugin) installed successfully!"
        docker compose version
        exit 0
    fi
fi

# Fallback: Install via apt (if available)
if command -v apt-get &> /dev/null; then
    echo "📦 Installing Docker Compose via apt..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    
    if docker compose version &> /dev/null; then
        echo "✅ Docker Compose installed via apt!"
        docker compose version
        exit 0
    fi
fi

# Final fallback: standalone binary
echo "📦 Installing Docker Compose (standalone)..."
COMPOSE_VERSION="v2.24.5"
ARCH=$(uname -m)
[ "$ARCH" = "x86_64" ] && ARCH="x86_64" || ARCH="aarch64"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-${OS}-${ARCH}" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

if docker-compose --version &> /dev/null 2>&1; then
    echo "✅ Docker Compose (standalone) installed!"
    docker-compose --version
else
    echo "❌ Installation failed. Please install manually:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

