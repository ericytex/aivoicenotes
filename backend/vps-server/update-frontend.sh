#!/bin/bash

# Quick script to update frontend with latest code

set -e

echo "🔄 Updating Frontend"
echo "══════════════════════"
echo ""

cd "$(dirname "$0")"

# Find the project root (should be ~/voicenote-full)
PROJECT_ROOT="$PWD"
while [ ! -f "$PROJECT_ROOT/package.json" ] && [ "$PROJECT_ROOT" != "/" ]; do
    PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo "❌ Could not find project root with package.json"
    echo "   Make sure you're in ~/voicenote-full or its subdirectories"
    exit 1
fi

echo "📁 Project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# Pull latest code
echo ""
echo "1. Pulling latest code..."
if [ -d ".git" ]; then
    git pull || echo "   Git pull failed or not needed"
else
    echo "   Not a git repository, skipping pull"
    echo "   Please update the code manually first"
fi

# Install dependencies (if needed)
echo ""
echo "2. Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
elif [ -f "package.json" ]; then
    npm install
else
    echo "   No package.json found"
    exit 1
fi

# Build frontend
echo ""
echo "3. Building frontend..."
npm run build

# Copy to Nginx directory
echo ""
echo "4. Copying to Nginx..."
FRONTEND_DIR="backend/vps-server/nginx/html/frontend"
mkdir -p "$FRONTEND_DIR"
rm -rf "${FRONTEND_DIR:?}"/*
cp -r dist/* "$FRONTEND_DIR/"

echo ""
echo "✅ Frontend updated!"
echo ""
echo "📍 Your app is available at: http://194.163.134.129:8888"
echo ""
echo "💡 Next steps:"
echo "   1. Open the app in your browser"
echo "   2. Sign out"
echo "   3. Sign back in (this will sync your account with the server)"
echo "   4. Sync should now work!"

