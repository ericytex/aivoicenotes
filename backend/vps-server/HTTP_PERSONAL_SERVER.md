# HTTP Setup for Personal Server

You don't need HTTPS for a personal server! HTTP works perfectly fine for everything except microphone recording.

## What Works with HTTP:
✅ All features work:
- Viewing notes
- Uploading audio/video files
- Transcribing uploaded files
- Image text extraction
- Creating, editing, deleting notes
- User authentication
- Database sync
- Admin panel

❌ Only one limitation:
- **Microphone recording** won't work (browser security requires HTTPS)

## Why Microphone Requires HTTPS?

Browsers block microphone access on HTTP sites (except `localhost`) for security. This is a browser policy, not our app's requirement.

## Options:

### Option 1: Use HTTP Only (Recommended for Personal Use)
Everything works except live microphone recording. You can still:
- Upload audio/video files and transcribe them
- Use all other features

### Option 2: Self-Signed Certificate (If You Need Recording)
If you want microphone recording on your personal server:

```bash
cd ~/voicenote-full/backend/vps-server
./enable-https.sh
# Choose "self-signed" when prompted
```

**Note**: Your browser will show a security warning for self-signed certificates. This is normal for personal servers - just click "Advanced" → "Proceed to site" (or similar in your browser).

### Option 3: Let's Encrypt (For Production/Domain)
If you have a domain name and want a trusted certificate:

```bash
cd ~/voicenote-full/backend/vps-server
./enable-https.sh
# Enter your domain name when prompted
```

## Current Setup

Your app is configured to use **HTTP only** by default, which is perfect for personal use!

Access it at: `http://YOUR_IP:8888`

All features work - just microphone recording requires HTTPS.

