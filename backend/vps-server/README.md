# VoiceNote API - VPS Server

Simple Express server for cross-device sync. Deploy on your VPS with Docker or directly.

## 🐳 Docker Deployment (Recommended)

**Quick Start:**
```bash
docker-compose up -d
```

See [DOCKER.md](./DOCKER.md) for complete Docker deployment guide.

## 📦 Direct Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start server:**
   ```bash
   npm start
   ```

## Production Deployment

### With PM2 (recommended):

```bash
npm install -g pm2
pm2 start server.js --name voicenote-api
pm2 save
pm2 startup
```

### With Nginx reverse proxy:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Let's Encrypt:

```bash
sudo certbot --nginx -d api.yourdomain.com
```

## Environment Variables

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
nano .env
```

**Backend Variables:**
- `PORT` - Server port (default: 3333)
- `CORS_ORIGIN` - Allowed CORS origin (your frontend URL)
- `DB_PATH` - Path to SQLite database file
- `UPLOAD_DIR` - Directory for audio file uploads
- `JWT_SECRET` - Secret key for JWT tokens

**Note:** The backend does NOT need Gemini/Groq API keys. Those are configured in the **frontend** `.env` file. See [ENV_SETUP.md](../../ENV_SETUP.md) for details.

## Database

Uses SQLite by default. Database file is created automatically at `DB_PATH`.

To migrate to PostgreSQL or MySQL, just change the database connection code.

## File Storage

Audio files are stored in `UPLOAD_DIR`. Make sure:
- Directory is writable
- Enough disk space for audio files
- Backups are configured

## Security

- Change `JWT_SECRET` in production
- Use HTTPS (SSL)
- Configure firewall (only allow port 80/443)
- Regular backups
- Update dependencies regularly

