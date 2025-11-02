# Clear Cache Instructions

If you're experiencing "504 (Outdated Optimize Dep)" errors, follow these steps:

## Step 1: Stop the Dev Server
Press `Ctrl+C` in the terminal where the dev server is running.

## Step 2: Clear All Caches
Run these commands:
```bash
rm -rf node_modules/.vite
rm -rf dist
rm -rf .vite
```

## Step 3: Clear Browser Cache & Service Worker
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage** in the left sidebar
4. Check all boxes
5. Click **Clear site data**
6. Or unregister the service worker:
   - Go to **Application** → **Service Workers**
   - Click **Unregister** for any registered workers

## Step 4: Restart Dev Server
```bash
npm run dev
```

Or force re-optimization:
```bash
npm run dev:force
```

## Alternative: Hard Refresh
If the above doesn't work, try:
- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

This forces the browser to bypass cache.

