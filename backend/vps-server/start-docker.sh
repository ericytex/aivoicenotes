#!/bin/bash

# VoiceNote API - Docker Quick Start Script

set -e

echo "🐳 VoiceNote API - Docker Setup"
echo "═══════════════════════════════════════"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker: $(docker --version)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version)"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration!"
    echo "   - Set CORS_ORIGIN to your frontend URL"
fi

# Create data directories
mkdir -p data uploads
echo "✅ Data directories created"

# Build and start
echo ""
echo "🔨 Building Docker image..."
docker-compose build

echo ""
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for server to start..."
sleep 3

# Check health
if curl -f http://localhost:3333/health > /dev/null 2>&1; then
    echo ""
    echo "✅ Server is running!"
    echo ""
    echo "📍 API URL: http://localhost:3333"
    echo "📊 View logs: docker-compose logs -f"
    echo "🛑 Stop: docker-compose down"
    echo ""
else
    echo ""
    echo "⚠️  Server started but health check failed."
    echo "📊 Check logs: docker-compose logs voicenote-api"
    echo ""
fi

