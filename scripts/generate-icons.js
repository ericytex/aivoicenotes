// Script to generate PNG icons from SVG for PWA
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Try to use sharp if available, otherwise provide instructions
try {
  const sharp = require('sharp');
  
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const outputDir = path.join(__dirname, '../public');
  
  if (!fs.existsSync(svgPath)) {
    console.error('icon.svg not found!');
    process.exit(1);
  }
  
  async function generateIcons() {
    console.log('Generating PWA icons...');
    
    // Generate 192x192 PNG
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(outputDir, 'icon-192.png'));
    console.log('✓ Generated icon-192.png');
    
    // Generate 512x512 PNG
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(outputDir, 'icon-512.png'));
    console.log('✓ Generated icon-512.png');
    
    console.log('\n✅ All icons generated successfully!');
  }
  
  generateIcons().catch(err => {
    console.error('Error generating icons:', err);
    console.log('\n💡 Alternative: Use an online converter:');
    console.log('   1. Go to https://cloudconvert.com/svg-to-png');
    console.log('   2. Upload public/icon.svg');
    console.log('   3. Set sizes to 192x192 and 512x512');
    console.log('   4. Download and save as icon-192.png and icon-512.png in public/');
    process.exit(1);
  });
} catch (error) {
  console.log('sharp not installed. Installing...');
  console.log('Run: npm install --save-dev sharp');
  console.log('\n💡 Alternative: Use an online converter:');
  console.log('   1. Go to https://cloudconvert.com/svg-to-png');
  console.log('   2. Upload public/icon.svg');
  console.log('   3. Set sizes to 192x192 and 512x512');
  console.log('   4. Download and save as icon-192.png and icon-512.png in public/');
}

