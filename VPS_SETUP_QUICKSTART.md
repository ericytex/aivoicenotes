# Quick Start: VPS Deployment

## TL;DR - Get it running in 5 minutes

```bash
# On your VPS
cd ~
git clone https://github.com/ericytex/aivoicenotes.git
cd aivoicenotes/backend/vps-server
chmod +x setup.sh
./setup.sh

# Edit configuration
nano .env
# Set: CORS_ORIGIN=https://your-frontend.vercel.app

# Start server
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Then in your frontend `.env`:
```env
VITE_API_URL=http://your-vps-ip:3333
```

**Done!** Your database is now syncing across devices.

---

## Detailed Steps

### 1. On Your VPS

```bash
# Connect to your VPS
ssh user@your-vps-ip

# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone or upload the backend
cd ~
git clone https://github.com/ericytex/aivoicenotes.git
cd aivoicenotes/backend/vps-server

# Run setup
chmod +x setup.sh
./setup.sh

# Or manually:
npm install
cp .env.example .env
nano .env  # Edit configuration
```

### 2. Configure `.env`

```env
PORT=3333
CORS_ORIGIN=https://aivoicenotes.vercel.app
DB_PATH=./voicenotes.db
UPLOAD_DIR=./uploads
```

### 3. Start Server

**Option A: Direct (for testing)**
```bash
npm start
```

**Option B: PM2 (production)**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on reboot
```

### 4. Configure Frontend

In your frontend project root, create/update `.env`:
```env
VITE_API_URL=http://your-vps-ip:3333
```

Or with domain:
```env
VITE_API_URL=https://api.yourdomain.com
```

### 5. Test

```bash
# On VPS, test health endpoint
curl http://localhost:3333/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 6. Optional: Add Domain & SSL

See `backend/vps-server/DEPLOY.md` for:
- Nginx reverse proxy setup
- SSL certificate (Let's Encrypt)
- Firewall configuration

---

## Verification

Once running, check:

1. **Server health:**
   ```bash
   curl http://your-vps-ip:3000/health
   ```

2. **Frontend sync:**
   - Open your app
   - Check SyncStatus component (should show cloud icon)
   - Create a note on one device
   - Check another device - note should appear

3. **Logs:**
   ```bash
   pm2 logs voicenote-api
   ```

---

## Troubleshooting

**Port already in use:**
```bash
sudo netstat -tulpn | grep 3333
# Kill the process or change PORT in .env
```

**Can't connect from frontend:**
- Check firewall: `sudo ufw allow 3333/tcp`
- Check CORS_ORIGIN in .env matches your frontend URL
- Check server is running: `pm2 status`

**Database errors:**
```bash
# Check database file
ls -la voicenotes.db

# Restart server
pm2 restart voicenote-api
```

---

## Architecture

```
Frontend (Vercel)
    ↓
Backend API (Your VPS)
    ↓
SQLite Database (shared across all devices)
    ↓
Audio Files (uploads/ directory)
```

All devices sync with the VPS database, creating a single source of truth.

