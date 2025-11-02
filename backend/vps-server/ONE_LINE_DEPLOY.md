# One-Line Deployment

## Option 1: Direct on VPS

SSH into your VPS and run:

```bash
bash <(curl -s https://raw.githubusercontent.com/ericytex/aivoicenotes/main/backend/vps-server/deploy.sh)
```

Or with custom frontend URL:

```bash
FRONTEND_URL=https://your-frontend.vercel.app bash <(curl -s https://raw.githubusercontent.com/ericytex/aivoicenotes/main/backend/vps-server/deploy.sh)
```

## Option 2: From Local Machine

From your local machine (requires SSH access):

```bash
# First time: Setup SSH key
ssh-copy-id root@194.163.134.129

# Then deploy
curl -s https://raw.githubusercontent.com/ericytex/aivoicenotes/main/backend/vps-server/deploy.sh | ssh root@194.163.134.129 "FRONTEND_URL=https://aivoicenotes.vercel.app bash"
```

## Option 3: Manual Clone & Deploy

```bash
# On VPS
cd ~
git clone https://github.com/ericytex/aivoicenotes.git voicenote-api
cd voicenote-api/backend/vps-server
chmod +x deploy.sh
FRONTEND_URL=https://aivoicenotes.vercel.app ./deploy.sh
```

## What the Script Does

1. ✅ Checks/installs Docker and Docker Compose
2. ✅ Clones/updates the repository
3. ✅ Creates `.env` file with correct settings
4. ✅ Builds Docker image
5. ✅ Starts the container
6. ✅ Configures firewall
7. ✅ Runs health check

## After Deployment

Your API will be available at:
- **Health Check:** http://194.163.134.129:3333/health
- **API Endpoint:** http://194.163.134.129:3333

Update your frontend `.env`:
```env
VITE_API_URL=http://194.163.134.129:3333
```

## Troubleshooting

**Script fails:**
```bash
# SSH into VPS and check manually
ssh root@194.163.134.129
cd ~/voicenote-api/backend/vps-server
docker-compose logs
```

**Port already in use:**
```bash
# Change port in .env or stop conflicting service
sudo netstat -tulpn | grep 3333
```

**Can't connect:**
```bash
# Test health endpoint
curl http://194.163.134.129:3333/health
```

