# Self-Signed Certificate Guide

## Yes, browsers accept self-signed certificates! 

They just show a warning that you need to bypass once per browser.

## What Happens:

1. **First Visit**: Browser shows "Not Secure" / "Your connection is not private"
2. **You Click Through**: "Advanced" → "Proceed anyway"
3. **It Works**: Browser remembers your choice, microphone access works!
4. **Future Visits**: Works normally (unless you clear browser data)

## Why Self-Signed Shows a Warning?

Self-signed certificates aren't verified by a trusted Certificate Authority (CA) like Let's Encrypt. Browsers warn you because they can't verify who issued the certificate.

**For personal servers, this is perfectly fine!** You know you trust your own server.

## Browser Instructions:

### Chrome / Edge / Brave
1. Visit your site: `https://YOUR_IP:8443`
2. See "Your connection is not private"
3. Click **"Advanced"**
4. Click **"Proceed to [site] (unsafe)"**
5. Done! Site loads, microphone works.

### Firefox
1. Visit your site: `https://YOUR_IP:8443`
2. See "Warning: Potential Security Risk Ahead"
3. Click **"Advanced"**
4. Click **"Accept the Risk and Continue"**
5. Done!

### Safari (Mac/iOS)
1. Visit your site: `https://YOUR_IP:8443`
2. See "Safari can't verify the identity"
3. Click **"Show Details"**
4. Click **"visit this website"**
5. Done!

## One-Time Setup:

Each browser/device needs to accept it once. After that:
- ✅ It remembers your choice
- ✅ No more warnings
- ✅ Microphone access works
- ✅ All features work normally

## Important Notes:

- **Personal Use Only**: Self-signed is perfect for your personal server
- **Not for Public Sites**: Don't use self-signed for public websites (use Let's Encrypt instead)
- **Mobile Devices**: Same process - visit once, accept warning, works forever
- **Clear Browser Data**: If you clear browser data, you'll need to accept again

## Security:

Self-signed certificates still provide:
- ✅ **Encryption** (HTTPS/TLS) - data is encrypted in transit
- ✅ **Microphone access** - browsers allow mic on HTTPS
- ⚠️ **No identity verification** - browser can't verify the server is who it claims

For personal servers where you control both client and server, this is perfectly secure!

