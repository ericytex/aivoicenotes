# VoiceNote AI - Transform Voice into Action

AI-powered voice transcription app. Record meetings, capture ideas, and convert voice notes into blogs, emails, and to-do lists instantly.

## 🚀 Features

- **Voice Recording** - Record, pause/resume with real-time transcription
- **Audio/Video Upload** - Upload files or YouTube links for transcription
- **Image Text Extraction** - Extract text from handwritten notes and whiteboards
- **AI Chat** - Ask questions about your notes and get clarifications
- **Note Sharing** - Share notes with read/edit permissions
- **Cross-Device Sync** - Access your notes on desktop, phone, or tablet
- **Action Items** - AI extracts action items and deadlines automatically
- **PWA Support** - Install as a Progressive Web App on mobile devices

## 📦 Quick Start

### Deploy on VPS (Full Stack)

**One-line deployment:**

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Run deployment script
cd ~
git clone https://github.com/ericytex/aivoicenotes.git voicenote-full
cd voicenote-full/backend/vps-server
chmod +x deploy-full.sh
./deploy-full.sh
```

**After deployment:**

```bash
# Configure external access
cd ~/voicenote-full/backend/vps-server
./configure-firewall.sh
./check-access.sh
```

Your app will be available at: `http://your-vps-ip:8888`

See [VPS_FULL_STACK.md](./VPS_FULL_STACK.md) for detailed deployment guide.

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│  (React/Vite)   │
│   Port 8888     │
└────────┬────────┘
         │
    ┌────▼────────────────┐
    │   Nginx             │
    │   (Reverse Proxy)    │
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │   Backend API       │
    │   (Express/Node)    │
    │   Port 3333         │
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │   SQLite Database    │
    │   (Shared across    │
    │    all devices)     │
    └─────────────────────┘
```

## 🔧 Configuration

### Frontend Environment Variables

Create `.env` in project root:

```env
# Backend API URL (empty = same domain, use /api)
VITE_API_URL=

# AI Service API Keys (for transcription, chat, etc.)
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_GROQ_API_KEY=your-groq-api-key
```

### Backend Environment Variables

Create `.env` in `backend/vps-server/`:

```env
PORT=3333
CORS_ORIGIN=http://your-vps-ip:8888
DB_PATH=./voicenotes.db
UPLOAD_DIR=./uploads
JWT_SECRET=your-secret-key-here
```

**Note:** AI API keys go in the frontend `.env`, not backend. See [ENV_SETUP.md](./ENV_SETUP.md) for details.

## 📚 Documentation

- **[VPS_FULL_STACK.md](./VPS_FULL_STACK.md)** - Complete VPS deployment guide
- **[POST_DEPLOY.md](./backend/vps-server/POST_DEPLOY.md)** - Post-deployment steps
- **[ENV_SETUP.md](./ENV_SETUP.md)** - Environment variables guide
- **[VPS_SETUP_QUICKSTART.md](./VPS_SETUP_QUICKSTART.md)** - Quick start guide

## 🔄 Updating the Application

### Update Frontend

```bash
cd ~/voicenote-full
git pull
npm install
npm run build
cp -r dist/* backend/vps-server/nginx/html/frontend/
cd backend/vps-server
docker compose -f docker-compose.full.yml restart nginx
```

### Update Backend

```bash
cd ~/voicenote-full/backend/vps-server
git pull
docker compose -f docker-compose.full.yml build --no-cache voicenote-api
docker compose -f docker-compose.full.yml up -d voicenote-api
```

## 🛠️ Troubleshooting

### Containers Not Running

```bash
cd ~/voicenote-full/backend/vps-server
docker compose -f docker-compose.full.yml logs -f
docker compose -f docker-compose.full.yml ps
```

### Nginx Restarting

```bash
./debug-nginx.sh
docker compose -f docker-compose.full.yml logs nginx
```

### Database Issues

```bash
# Fix permissions
./fix-permissions.sh

# Check database file
ls -la data/voicenotes.db
```

### External Access Issues

```bash
# Check firewall
./check-access.sh
./configure-firewall.sh

# Verify port is open
sudo netstat -tuln | grep 8888
```

## 🧪 Development

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Backend Development

```bash
cd backend/vps-server
npm install
npm start
```

## 📝 API Endpoints

All endpoints are prefixed with `/api`:

- `GET /api/health` - Health check
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note
- `PATCH /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/sync` - Sync notes
- `GET /api/sync/status` - Sync status
- `POST /api/notes/:id/audio` - Upload audio

## 🔐 Security

- Passwords are hashed with bcrypt
- JWT tokens for authentication
- CORS configured for specific origins
- SQL injection protection via parameterized queries
- File upload size limits (100MB)

## 📄 License

This project is private.

## 🤝 Contributing

This is a private project. For issues or questions, contact the repository owner.

## 🔗 Links

- Repository: https://github.com/ericytex/aivoicenotes
- Production: http://194.163.134.129:8888

---

**Built with:** React, TypeScript, Vite, Express.js, SQLite, Docker, Nginx
