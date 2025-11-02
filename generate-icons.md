# Generating PWA Icons

The app uses an SVG icon (`public/icon.svg`). For best PWA compatibility, you should generate PNG versions:

## Required Sizes:
- 192x192px (Android home screen)
- 512x512px (Splash screen, high-res)

## Online Tools:
- https://cloudconvert.com/svg-to-png
- https://convertio.co/svg-png/

## Steps:
1. Upload `public/icon.svg`
2. Generate PNGs at 192x192 and 512x512
3. Save as `public/icon-192.png` and `public/icon-512.png`

The manifest.json is already configured to use these files when available.

