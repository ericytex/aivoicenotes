# Frontend URL Configuration Guide

## What is the Frontend URL?

The **Frontend URL** is where your React app is hosted. The backend needs this URL to:
- Allow CORS requests from your frontend
- Know which origins to trust

## How to Find Your Frontend URL

### If Deployed on Vercel:
1. Go to https://vercel.com
2. Find your project
3. Your URL will be: `https://your-project-name.vercel.app`
   - Or your custom domain if you set one up

### If Running Locally:
- Use: `http://localhost:5173` (Vite default port)
- Or: `http://localhost:3000` (if you changed it)

### If You Don't Have a Frontend Yet:

**Option 1: Deploy to Vercel (Recommended)**
```bash
# From your local machine (in the project root)
npm install -g vercel
vercel
# Follow the prompts, then use the URL it gives you
```

**Option 2: Test Locally First**
```bash
# Use localhost in the deployment script
FRONTEND_URL=http://localhost:5173 ./deploy.sh
```

## Setting the Frontend URL

### Method 1: Environment Variable (Recommended)
```bash
# When running deploy script
FRONTEND_URL=https://your-app.vercel.app ./deploy.sh
```

### Method 2: Edit the Script
Edit `deploy.sh` line 9:
```bash
FRONTEND_URL="${FRONTEND_URL:-https://your-app.vercel.app}"
```

### Method 3: Edit .env After Deployment
After the script runs, edit `~/voicenote-api/backend/vps-server/.env`:
```env
CORS_ORIGIN=https://your-app.vercel.app
```

Then restart:
```bash
cd ~/voicenote-api/backend/vps-server
docker-compose restart
```

## Common Frontend URLs

- **Vercel (default naming):** `https://aivoicenotes.vercel.app`
- **Vercel (custom):** `https://yourname.vercel.app`
- **Netlify:** `https://your-app.netlify.app`
- **Custom Domain:** `https://yourdomain.com`
- **Local Development:** `http://localhost:5173`

## Testing

After setting the frontend URL, test CORS:

```bash
# From your frontend, test the API
curl http://194.163.134.129:3333/health
```

If you get CORS errors in the browser, make sure:
1. The `CORS_ORIGIN` in `.env` matches your frontend URL exactly
2. No trailing slashes (use `https://app.com` not `https://app.com/`)
3. Restart the server after changing `.env`

