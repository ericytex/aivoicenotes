#!/bin/bash

# VoiceNote API - Quick Setup Script for VPS
# Run this script on your VPS to set up the backend

set -e

echo "🚀 VoiceNote API - VPS Setup"
echo "═══════════════════════════════════════"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Installing..."
    sudo apt-get install -y npm
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration!"
    echo "   - Set CORS_ORIGIN to your frontend URL"
    echo "   - Adjust PORT if needed"
fi

# Create uploads directory
mkdir -p uploads
echo "✅ Uploads directory created"

# Create logs directory
mkdir -p logs
echo "✅ Logs directory created"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano .env"
echo "2. Start server: npm start"
echo "3. Or use PM2: npm install -g pm2 && pm2 start ecosystem.config.js"
echo ""
echo "📚 See DEPLOY.md for full deployment instructions"

