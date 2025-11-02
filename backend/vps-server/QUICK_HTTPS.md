# Quick HTTPS Setup for Microphone Access

## Problem
Browsers require HTTPS to access the microphone (except localhost). Your app is currently on HTTP, so microphone recording doesn't work.

## Solutions

### Option 1: Use Localhost (Quick Test)
Access via `http://localhost:8888` on your VPS:
```bash
# SSH with port forwarding
ssh -L 8888:localhost:8888 user@194.163.134.129
# Then access http://localhost:8888 in your browser
```

### Option 2: Self-Signed Certificate (Quick, but browser warning)
```bash
cd ~/voicenote-full/backend/vps-server
./setup-ssl.sh
# When prompted, say no to having a domain
# Then follow instructions to enable HTTPS in nginx config
```

### Option 3: Let's Encrypt SSL (Best for Production)

**Requirements:**
- A domain name pointing to your VPS IP (194.163.134.129)
- Port 80 open for verification

**Steps:**

1. **Point your domain to your VPS:**
   ```
   A record: yourdomain.com → 194.163.134.129
   ```

2. **Run SSL setup:**
   ```bash
   cd ~/voicenote-full/backend/vps-server
   DOMAIN=yourdomain.com EMAIL=your@email.com ./setup-ssl.sh
   ```

3. **Update Nginx config:**
   Edit `nginx/conf.d/frontend.conf`:
   - Uncomment HTTPS server block (lines 70-134)
   - Change `server_name yourdomain.com` to your actual domain
   - Certificate paths are already correct

4. **Update docker-compose:**
   Edit `docker-compose.full.yml`, change:
   ```yaml
   ports:
     - "443:443"  # Changed from 8888:80
   ```
   And ensure volume mount includes:
   ```yaml
   - ./nginx/certs:/etc/nginx/certs:ro
   ```

5. **Restart:**
   ```bash
   docker compose -f docker-compose.full.yml down
   docker compose -f docker-compose.full.yml up -d
   ```

6. **Access:** `https://yourdomain.com`

## Without Domain? Use Cloudflare Tunnel

If you don't have a domain, you can use Cloudflare Tunnel (free):

1. Sign up at https://cloudflare.com
2. Install `cloudflared`:
   ```bash
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
   sudo chmod +x /usr/local/bin/cloudflared
   ```
3. Run tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:8888
   ```
4. Use the provided HTTPS URL

## Temporary Workaround

For testing without HTTPS, you can:
- Use the upload feature instead of recording
- Record locally on your computer and upload the file
- Use a mobile app that records audio, then upload

## Verify HTTPS Works

After setting up HTTPS:
1. Visit your site via HTTPS
2. Check browser shows lock icon
3. Try recording - microphone should work!

