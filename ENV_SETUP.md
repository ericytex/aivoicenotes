# Environment Variables Setup Guide

This guide explains where to configure environment variables for the VoiceNote app.

## Architecture Overview

The app has two parts:
1. **Frontend** (React/Vite) - Runs in the browser, handles transcription/AI
2. **Backend** (Express API) - Runs on VPS, handles database sync and file storage

## Frontend `.env` File

**Location:** Root of the project (same directory as `package.json`)

**Purpose:** API keys for client-side AI services (Gemini, Groq)

```env
# Backend API URL
VITE_API_URL=http://your-vps-ip:3333

# AI Service API Keys
VITE_GEMINI_API_KEY=your-gemini-api-key-here
VITE_GROQ_API_KEY=your-groq-api-key-here
```

**Where it's used:**
- Transcription (Gemini/Groq)
- Image text extraction (Gemini Vision)
- AI chat (Gemini)
- Note summarization (Gemini)
- Action item extraction (Groq)

**Security Note:**
⚠️ These keys are exposed in the browser since they're used client-side. For production:
- Use API key restrictions (domain/IP whitelist) in provider dashboards
- Consider moving to server-side proxy if you need to hide keys completely

## Backend `.env` File

**Location:** `backend/vps-server/.env`

**Purpose:** Server configuration (no API keys needed currently)

```env
# Server Configuration
PORT=3333
CORS_ORIGIN=https://your-frontend-domain.com

# Database
DB_PATH=./voicenotes.db

# Upload Directory
UPLOAD_DIR=./uploads

# JWT Secret
JWT_SECRET=your-secret-key-here
```

**Where it's used:**
- Server port and CORS settings
- Database location
- File upload directory
- Authentication (if JWT is implemented)

**Note:** The backend doesn't currently use AI API keys. All AI processing happens in the frontend.

## Setup Steps

### 1. Frontend Setup

```bash
# In project root
cp .env.example .env

# Edit with your keys
nano .env
```

### 2. Backend Setup

```bash
# In backend/vps-server/
cp .env.example .env

# Edit with your server config
nano .env
```

## Getting API Keys

### Gemini API Key
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key to `VITE_GEMINI_API_KEY`

### Groq API Key
1. Go to https://console.groq.com/keys
2. Sign up / Sign in
3. Create a new API key
4. Copy the key to `VITE_GROQ_API_KEY`

## Docker Environment Variables

When using Docker, you can pass environment variables in `docker-compose.yml`:

```yaml
environment:
  - CORS_ORIGIN=${CORS_ORIGIN:-*}
  - PORT=3333
```

Or use a `.env` file (docker-compose automatically loads it).

## Production Security Checklist

- [ ] API keys have domain restrictions set
- [ ] API keys have usage quotas/limits set
- [ ] Backend CORS_ORIGIN is set to specific domain (not `*`)
- [ ] JWT_SECRET is a strong random string
- [ ] `.env` files are in `.gitignore` (don't commit keys!)
- [ ] Using HTTPS for all API calls

## Troubleshooting

**"API key not configured" error:**
- Check that `VITE_` prefix is present (Vite requirement)
- Check key is in frontend `.env`, not backend
- Restart dev server after changing `.env`

**Backend can't connect:**
- Check `VITE_API_URL` matches backend URL
- Check backend CORS_ORIGIN includes your frontend domain
- Check firewall allows port 3333

**Keys exposed in browser:**
- This is expected for client-side APIs
- Use API key restrictions for security
- Consider server-side proxy for sensitive keys

