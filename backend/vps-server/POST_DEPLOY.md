# Post-Deployment Guide

## What Happens After Running `./deploy-full.sh`

The deployment script will:

1. ✅ Install Docker, Node.js, and dependencies (if not already installed)
2. ✅ Clone/update the repository
3. ✅ Build the React frontend (`npm run build`)
4. ✅ Configure backend environment
5. ✅ Build Docker images
6. ✅ Start containers (backend API + Nginx)
7. ✅ Run health checks
8. ✅ Configure firewall

## After Deployment Completes

### Step 0: Configure External Access (Do This First!)

```bash
cd ~/voicenote-full/backend/vps-server

# Run firewall configuration
./configure-firewall.sh

# Check access configuration
./check-access.sh
```

This will:
- Configure UFW/iptables to allow port 8888
- Verify containers are running
- Test local access
- Show you the external URL

**Important:** If using a cloud provider (DigitalOcean, AWS, etc.), also configure their firewall/security groups to allow port 8888.

### Step 1: Verify Everything is Running

```bash
# Check container status
cd ~/voicenote-full/backend/vps-server
docker-compose -f docker-compose.full.yml ps

# Should show:
# - voicenote-api (running)
# - voicenote-nginx (running)
```

### Step 2: Test the Services

```bash
# Test backend health
curl http://localhost:3333/health

# Test frontend (via Nginx)
curl http://localhost/

# Test API through proxy
curl http://localhost/api/health
```

### Step 3: Access Your Application

**Open in browser:**
- Frontend: `http://194.163.134.129`
- API Health: `http://194.163.134.129/health`

**What you should see:**
- Landing page loads
- Can sign up/login
- Navigation works
- Can create notes, record audio, etc.

### Step 4: Check Logs (If Needed)

```bash
# View all logs
docker-compose -f docker-compose.full.yml logs -f

# View specific service
docker-compose -f docker-compose.full.yml logs -f nginx
docker-compose -f docker-compose.full.yml logs -f voicenote-api
```

## Common Next Steps

### 1. Set Up Domain (Optional)

If you have a domain name:

```bash
# Install Certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Update Nginx config to use your domain
# Edit: backend/vps-server/nginx/conf.d/frontend.conf
# Change: server_name _; to server_name yourdomain.com;
```

### 2. Create Your First Admin Account

1. Visit `http://194.163.134.129`
2. Sign up with your email
3. Then SSH into VPS and make yourself admin:

```bash
# Access the database container
docker exec -it voicenote-api node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/voicenotes.db');
db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run('your-email@example.com');
console.log('Admin set!');
"
```

Or create admin directly via API (if admin endpoint exists).

### 3. Configure Environment Variables (If Needed)

```bash
cd ~/voicenote-full/backend/vps-server

# Edit backend .env
nano .env

# After editing, restart
docker-compose -f docker-compose.full.yml restart voicenote-api
```

### 4. Set Up Monitoring (Optional)

```bash
# Check resource usage
docker stats

# Set up log rotation (already configured in docker-compose)
# Logs are limited to 10MB per service
```

## Troubleshooting

### Frontend Not Loading

```bash
# Check if files are copied
ls -la ~/voicenote-full/backend/vps-server/nginx/html/frontend/

# Check Nginx logs
docker-compose -f docker-compose.full.yml logs nginx

# Restart Nginx
docker-compose -f docker-compose.full.yml restart nginx
```

### API Not Working

```bash
# Check backend logs
docker-compose -f docker-compose.full.yml logs voicenote-api

# Test backend directly
curl http://localhost:3333/health

# Check database
ls -la ~/voicenote-full/backend/vps-server/data/voicenotes.db

# Restart backend
docker-compose -f docker-compose.full.yml restart voicenote-api
```

### Port 80 Already in Use

```bash
# Find what's using port 80
sudo netstat -tulpn | grep :80

# If it's Apache or another service, stop it:
sudo systemctl stop apache2  # or httpd, or nginx
```

### Build Failed

```bash
# Rebuild frontend manually
cd ~/voicenote-full
npm install
npm run build
cp -r dist/* backend/vps-server/nginx/html/frontend/
cd backend/vps-server
docker-compose -f docker-compose.full.yml restart nginx
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER ~/voicenote-full
chmod +x ~/voicenote-full/backend/vps-server/deploy-full.sh
```

## Updating the Application

### Update Frontend Only

```bash
cd ~/voicenote-full
git pull
npm install  # If dependencies changed
npm run build
cp -r dist/* backend/vps-server/nginx/html/frontend/
cd backend/vps-server
docker-compose -f docker-compose.full.yml restart nginx
```

### Update Backend Only

```bash
cd ~/voicenote-full/backend/vps-server
git pull
docker-compose -f docker-compose.full.yml build --no-cache voicenote-api
docker-compose -f docker-compose.full.yml up -d voicenote-api
```

### Full Update (Frontend + Backend)

```bash
cd ~/voicenote-full
git pull

# Rebuild frontend
npm install
npm run build
cp -r dist/* backend/vps-server/nginx/html/frontend/

# Rebuild backend
cd backend/vps-server
docker-compose -f docker-compose.full.yml build --no-cache
docker-compose -f docker-compose.full.yml up -d
```

## Useful Commands

```bash
# View running containers
docker ps

# Stop everything
cd ~/voicenote-full/backend/vps-server
docker-compose -f docker-compose.full.yml down

# Start everything
docker-compose -f docker-compose.full.yml up -d

# View resource usage
docker stats

# Clean up old images (free space)
docker system prune -a

# Backup database
cp ~/voicenote-full/backend/vps-server/data/voicenotes.db ~/backup-$(date +%Y%m%d).db
```

## Testing Checklist

After deployment, test:

- [ ] Frontend loads at `http://194.163.134.129`
- [ ] Can sign up for account
- [ ] Can sign in
- [ ] Can create a note
- [ ] Can record audio (if microphone permissions work)
- [ ] Can upload audio file
- [ ] API health check works: `http://194.163.134.129/health`
- [ ] Notes sync across devices (if testing from multiple devices)

## Security Checklist

- [ ] Firewall configured (ports 80, 443 open; others closed)
- [ ] Strong passwords for user accounts
- [ ] SSL certificate installed (for production)
- [ ] Regular backups configured
- [ ] Monitor logs for suspicious activity

## Need Help?

1. Check logs: `docker-compose -f docker-compose.full.yml logs -f`
2. Check status: `docker-compose -f docker-compose.full.yml ps`
3. Verify files: `ls -la ~/voicenote-full/backend/vps-server/nginx/html/frontend/`
4. Test endpoints: `curl http://localhost/health`

## Summary

After running `./deploy-full.sh`:

1. **Wait for script to finish** (5-10 minutes)
2. **Verify services**: `docker-compose -f docker-compose.full.yml ps`
3. **Test in browser**: `http://194.163.134.129`
4. **Check logs if issues**: `docker-compose -f docker-compose.full.yml logs`
5. **Create admin account** (see above)
6. **Start using your app!**

That's it! Your app is now live on your VPS. 🎉

