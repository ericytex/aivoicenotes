# VPS Deployment Guide

Complete guide to deploy VoiceNote API on your VPS.

## Prerequisites

- VPS with Ubuntu/Debian (or similar)
- Node.js 18+ installed
- Nginx installed (for reverse proxy)
- Domain name (optional, but recommended)

## Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot (for SSL)
sudo apt install -y certbot python3-certbot-nginx
```

## Step 2: Deploy Backend

```bash
# Clone your repo or upload files
cd ~
git clone https://github.com/ericytex/aivoicenotes.git
cd aivoicenotes/backend/vps-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env
# Edit with your settings:
# PORT=3333
# CORS_ORIGIN=https://your-frontend-domain.com
# DB_PATH=./voicenotes.db
# UPLOAD_DIR=./uploads
```

## Step 3: Test Run

```bash
# Test the server
npm start

# Should see:
# 🚀 VoiceNote API Server
# ✅ Server running at http://0.0.0.0:3333

# Test in another terminal:
curl http://localhost:3333/health
# Should return: {"status":"ok","timestamp":"..."}
```

Press `Ctrl+C` to stop.

## Step 4: Production with PM2

```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs voicenote-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions it gives you
```

## Step 5: Configure Nginx

```bash
# Copy nginx config
sudo cp nginx.conf.example /etc/nginx/sites-available/voicenote-api

# Edit with your domain
sudo nano /etc/nginx/sites-available/voicenote-api

# Enable site
sudo ln -s /etc/nginx/sites-available/voicenote-api /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 6: Setup SSL (Let's Encrypt)

```bash
# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 7: Configure Firewall

```bash
# Allow SSH (IMPORTANT - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 8: Update Frontend

In your frontend `.env` file:

```env
VITE_API_URL=https://api.yourdomain.com
```

Or if no domain:
```env
VITE_API_URL=http://your-vps-ip:3333
```

## Step 9: Backup Setup

```bash
# Create backup script
nano ~/backup-voicenote.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/backups"
mkdir -p $BACKUP_DIR

# Backup database
cp /path/to/voicenotes.db $BACKUP_DIR/voicenotes_$DATE.db

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /path/to/uploads/

# Keep only last 7 days
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x ~/backup-voicenote.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/youruser/backup-voicenote.sh
```

## Monitoring

```bash
# View PM2 logs
pm2 logs voicenote-api

# Monitor resource usage
pm2 monit

# Restart server
pm2 restart voicenote-api

# Stop server
pm2 stop voicenote-api
```

## Troubleshooting

**Server won't start:**
```bash
# Check logs
pm2 logs voicenote-api --lines 50

# Check if port is in use
sudo netstat -tulpn | grep 3333
```

**Nginx errors:**
```bash
# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Test nginx config
sudo nginx -t
```

**Database locked:**
```bash
# SQLite might be locked if multiple connections
# Restart PM2
pm2 restart voicenote-api
```

## Security Checklist

- [ ] Changed default passwords
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] CORS_ORIGIN set to your frontend domain
- [ ] Regular backups configured
- [ ] PM2 auto-restart on boot
- [ ] Updated system packages

## Scaling Options

**For higher traffic:**
1. Upgrade to PostgreSQL instead of SQLite
2. Add Redis for caching
3. Use object storage (S3/Cloudflare R2) for audio files
4. Add load balancer for multiple instances

## Support

If you need help, check logs:
- PM2: `pm2 logs voicenote-api`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- Server: Check console output

