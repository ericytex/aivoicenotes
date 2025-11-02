# Docker Deployment Guide

Deploy VoiceNote API using Docker for consistency and ease of management.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/ericytex/aivoicenotes.git
cd aivoicenotes/backend/vps-server

# Create .env file
cp .env.example .env
nano .env
# Set: CORS_ORIGIN=https://your-frontend-domain.com
```

### 2. Build and Run

```bash
# Build the image
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f voicenote-api

# Check status
docker-compose ps
```

### 3. Verify

```bash
# Test health endpoint
curl http://localhost:3333/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Production Deployment

### Option A: Direct Port Exposure

For simple deployments without Nginx:

```bash
# Start with custom port (if 3333 is busy)
PORT=4000 docker-compose up -d
```

Update your frontend `.env`:
```env
VITE_API_URL=http://your-vps-ip:3333
```

### Option B: With Nginx Reverse Proxy

For production with SSL:

1. **Update Nginx config:**
   ```bash
   nano nginx/conf.d/api.conf
   # Change api.yourdomain.com to your domain
   ```

2. **Get SSL certificates:**
   ```bash
   # On host (not in container)
   sudo certbot certonly --standalone -d api.yourdomain.com
   
   # Copy certificates to project
   mkdir -p certs
   sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem certs/
   sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem certs/
   sudo chown $USER:$USER certs/*
   ```

3. **Start with production compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Update frontend `.env`:**
   ```env
   VITE_API_URL=https://api.yourdomain.com
   ```

## Common Commands

```bash
# View logs
docker-compose logs -f

# Restart service
docker-compose restart voicenote-api

# Stop service
docker-compose stop

# Stop and remove containers
docker-compose down

# Rebuild after code changes
docker-compose build --no-cache
docker-compose up -d

# View container stats
docker stats voicenote-api

# Execute command in container
docker-compose exec voicenote-api sh

# Backup database
docker-compose exec voicenote-api cp /app/data/voicenotes.db /app/data/backup.db
```

## Data Persistence

Data is persisted using Docker volumes:

- **Database:** `./data/voicenotes.db` (mounted to `/app/data` in container)
- **Uploads:** `./uploads/` (mounted to `/app/uploads` in container)

**Backup strategy:**

```bash
# Create backup
mkdir -p backups
tar -czf backups/backup-$(date +%Y%m%d).tar.gz data/ uploads/

# Restore backup
tar -xzf backups/backup-YYYYMMDD.tar.gz
docker-compose restart voicenote-api
```

## Environment Variables

Create `.env` file or set in `docker-compose.yml`:

```env
PORT=3333
CORS_ORIGIN=https://your-frontend.vercel.app
```

Variables in `docker-compose.yml`:
- `PORT` - Host port to map (default: 3333)
- `CORS_ORIGIN` - Allowed CORS origin
- `DB_PATH` - Database path in container (keep as `/app/data/voicenotes.db`)
- `UPLOAD_DIR` - Upload directory in container (keep as `/app/uploads`)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs voicenote-api

# Check container status
docker ps -a

# Rebuild without cache
docker-compose build --no-cache
```

### Port already in use

```bash
# Find what's using the port
sudo netstat -tulpn | grep 3333

# Or change port in docker-compose.yml
ports:
  - "4000:3333"  # Host:Container
```

### Permission issues

```bash
# Fix ownership of data directories
sudo chown -R $USER:$USER data/ uploads/
```

### Database locked

```bash
# Restart container
docker-compose restart voicenote-api

# Or check if multiple instances running
docker ps | grep voicenote-api
```

### Out of disk space

```bash
# Clean up Docker
docker system prune -a

# Remove old logs
docker-compose down
rm -rf logs/*
```

## Updating the Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d

# Verify
curl http://localhost:3333/health
```

## Monitoring

```bash
# View real-time logs
docker-compose logs -f voicenote-api

# Monitor resource usage
docker stats voicenote-api

# Check container health
docker inspect voicenote-api | grep -A 5 Health
```

## Security Best Practices

1. **Use non-root user** (already configured in Dockerfile)
2. **Limit container resources:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 512M
   ```
3. **Use secrets for sensitive data** (not in `.env` files)
4. **Keep images updated:**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```
5. **Use HTTPS** with Nginx reverse proxy in production

## Scaling

To run multiple instances (requires load balancer and shared database):

```yaml
services:
  voicenote-api:
    deploy:
      replicas: 3
```

Note: SQLite doesn't support multiple writers. For scaling, migrate to PostgreSQL.

## Migration from Non-Docker Setup

If you have an existing installation:

1. **Backup your data:**
   ```bash
   cp voicenotes.db data/
   cp -r uploads/ uploads_backup/
   ```

2. **Stop old service:**
   ```bash
   pm2 stop voicenote-api  # or systemctl stop
   ```

3. **Start Docker:**
   ```bash
   docker-compose up -d
   ```

4. **Verify:**
   ```bash
   curl http://localhost:3333/health
   ```

