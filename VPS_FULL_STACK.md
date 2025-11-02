# Full Stack VPS Deployment Guide

Deploy both frontend and backend on your VPS using Nginx.

## Architecture

```
Internet
   ↓
Nginx (Port 80/443)
   ├─→ Serves React Frontend (/)
   └─→ Proxies API requests (/api) → Backend API (Port 3333)
```

## Quick Start

### One-Line Deployment

```bash
# SSH into your VPS
ssh root@194.163.134.129

# Run deployment script
cd ~
git clone https://github.com/ericytex/aivoicenotes.git voicenote-full
cd voicenote-full/backend/vps-server
chmod +x deploy-full.sh
./deploy-full.sh
```

Or from your local machine:

```bash
curl -s https://raw.githubusercontent.com/ericytex/aivoicenotes/main/backend/vps-server/deploy-full.sh | ssh root@194.163.134.129 "bash"
```

## What Gets Deployed

1. **Frontend (React App)**
   - Built with `npm run build`
   - Served by Nginx from `/usr/share/nginx/html/frontend`
   - Accessible at `http://your-vps-ip/`

2. **Backend API**
   - Express.js server in Docker
   - Running on port 3333 (internal)
   - Accessible via proxy at `http://your-vps-ip/api`

3. **Nginx Reverse Proxy**
   - Serves static frontend files
   - Proxies `/api/*` to backend
   - Handles `/health` endpoint
   - Serves `/uploads/` files directly

## Manual Deployment Steps

### 1. On Your VPS

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y git curl

# Install Node.js (for building frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for Docker group to take effect

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clone and Build Frontend

```bash
cd ~
git clone https://github.com/ericytex/aivoicenotes.git voicenote-full
cd voicenote-full

# Install dependencies
npm install

# Create frontend .env (API URL is empty since same domain)
cat > .env << EOF
VITE_API_URL=
EOF

# Build frontend
npm run build
```

### 3. Setup Backend

```bash
cd ~/voicenote-full/backend/vps-server

# Create .env
cp env.example.txt .env
nano .env  # Edit if needed

# Create directories
mkdir -p data uploads logs nginx/html/frontend

# Copy frontend build
cp -r ~/voicenote-full/dist/* nginx/html/frontend/
```

### 4. Start Services

```bash
cd ~/voicenote-full/backend/vps-server

# Build and start
docker-compose -f docker-compose.full.yml up -d

# Check status
docker-compose -f docker-compose.full.yml ps
docker-compose -f docker-compose.full.yml logs -f
```

### 5. Configure Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Update Frontend

When you make changes to the frontend:

```bash
cd ~/voicenote-full
git pull
npm install  # If dependencies changed
npm run build
cp -r dist/* backend/vps-server/nginx/html/frontend/
cd backend/vps-server
docker-compose -f docker-compose.full.yml restart nginx
```

## Environment Variables

### Frontend (.env in project root)

```env
# Empty - uses relative paths since served from same domain
VITE_API_URL=
```

### Backend (.env in backend/vps-server)

```env
PORT=3333
CORS_ORIGIN=http://your-vps-ip
DB_PATH=./voicenotes.db
UPLOAD_DIR=./uploads
```

**Note:** Since frontend and backend are on the same domain, `CORS_ORIGIN` can be set to `*` or your specific domain.

## SSL/HTTPS Setup (Optional)

### Using Let's Encrypt

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot will automatically update Nginx config
```

### Manual SSL Setup

1. Get SSL certificates (from Let's Encrypt or your provider)
2. Place them in `backend/vps-server/nginx/certs/`:
   - `fullchain.pem`
   - `privkey.pem`
3. Uncomment HTTPS server block in `nginx/conf.d/frontend.conf`
4. Update domain names and certificate paths
5. Restart Nginx:
   ```bash
   docker-compose -f docker-compose.full.yml restart nginx
   ```

## API Endpoints

All API endpoints are accessible via `/api` prefix:

- `GET /api/health` - Health check
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/sync` - Sync notes
- `GET /api/sync/status` - Sync status
- `POST /api/notes/:id/audio` - Upload audio

## Troubleshooting

### Frontend not loading

```bash
# Check Nginx logs
docker-compose -f docker-compose.full.yml logs nginx

# Check if files exist
ls -la ~/voicenote-full/backend/vps-server/nginx/html/frontend/

# Restart Nginx
docker-compose -f docker-compose.full.yml restart nginx
```

### API not working

```bash
# Check backend logs
docker-compose -f docker-compose.full.yml logs voicenote-api

# Test backend directly
curl http://localhost:3333/health

# Check Nginx proxy
curl http://localhost/api/health
```

### Port already in use

```bash
# Check what's using port 80
sudo netstat -tulpn | grep :80

# Stop conflicting service or change Nginx port in docker-compose.full.yml
```

### Database issues

```bash
# Check database file
ls -la ~/voicenote-full/backend/vps-server/data/voicenotes.db

# Restart backend
docker-compose -f docker-compose.full.yml restart voicenote-api
```

## File Structure

```
~/voicenote-full/
├── dist/                          # Frontend build output
├── backend/vps-server/
│   ├── data/                      # SQLite database
│   ├── uploads/                   # Audio files
│   ├── nginx/
│   │   ├── html/
│   │   │   └── frontend/         # Frontend static files (copied from dist/)
│   │   ├── conf.d/
│   │   │   └── frontend.conf     # Nginx config
│   │   └── nginx.conf             # Main Nginx config
│   ├── docker-compose.full.yml   # Full stack compose file
│   └── .env                      # Backend config
```

## Performance Tips

1. **Enable Gzip** (already configured in Nginx)
2. **CDN for Assets** (optional) - Serve static assets from CDN
3. **Database Optimization** - Regular VACUUM for SQLite
4. **Caching** - Nginx already caches static assets for 1 year

## Security Considerations

1. **Firewall**: Only expose ports 80/443 (and 22 for SSH)
2. **SSL**: Always use HTTPS in production
3. **API Authentication**: Backend uses JWT tokens
4. **File Upload Limits**: Set to 100MB in Nginx config
5. **Rate Limiting**: Consider adding rate limiting to Nginx

## Backup

```bash
# Backup database
cp ~/voicenote-full/backend/vps-server/data/voicenotes.db ~/backup-$(date +%Y%m%d).db

# Backup uploads
tar -czf ~/uploads-backup-$(date +%Y%m%d).tar.gz ~/voicenote-full/backend/vps-server/uploads/
```

## Monitoring

```bash
# View all logs
docker-compose -f docker-compose.full.yml logs -f

# View specific service
docker-compose -f docker-compose.full.yml logs -f nginx
docker-compose -f docker-compose.full.yml logs -f voicenote-api

# Container stats
docker stats
```

