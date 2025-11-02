#!/bin/bash

# VoiceNote API - Remote Deployment Script
# Run this from your LOCAL machine to deploy to VPS via SSH

set -e

VPS_IP="194.163.134.129"
VPS_USER="${VPS_USER:-root}"
# Set your actual frontend URL here (or via FRONTEND_URL env var)
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "🚀 VoiceNote API - Remote Deployment"
echo "═══════════════════════════════════════"
echo ""

# Check SSH access
echo "🔐 Testing SSH connection to $VPS_USER@$VPS_IP..."
if ! ssh -o ConnectTimeout=5 "$VPS_USER@$VPS_IP" "echo 'Connection successful'" 2>/dev/null; then
    echo "❌ Cannot connect to VPS. Please check:"
    echo "   1. SSH key is set up: ssh-copy-id $VPS_USER@$VPS_IP"
    echo "   2. VPS is accessible: ping $VPS_IP"
    echo "   3. Correct username: $VPS_USER"
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

# Upload and run deployment script
echo "📤 Uploading deployment script..."
scp deploy.sh "$VPS_USER@$VPS_IP:/tmp/"

echo "🚀 Running deployment on VPS..."
ssh "$VPS_USER@$VPS_IP" << EOF
    chmod +x /tmp/deploy.sh
    FRONTEND_URL="$FRONTEND_URL" /tmp/deploy.sh
EOF

echo ""
echo "✅ Remote deployment initiated!"
echo ""
echo "📊 To check status, SSH into the VPS:"
echo "   ssh $VPS_USER@$VPS_IP"
echo "   cd ~/voicenote-api/backend/vps-server"
echo "   docker-compose logs -f"

