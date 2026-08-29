import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = '/Users/miteshnijhara/.gemini/antigravity/scratch/getjobready-app/logo.svg';
const appDir = '/Users/miteshnijhara/.gemini/antigravity/scratch/getjobready-app';
const publicDir = path.join(appDir, 'public');
const distDir = path.join(appDir, 'dist');

async function generate() {
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. logo.png (512x512)
  const logo512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'logo.png'), logo512);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), logo512);
  fs.writeFileSync(path.join(distDir, 'logo.png'), logo512);

  // 2. favicon.png (64x64)
  const fav64 = await sharp(svgBuffer).resize(64, 64).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'favicon.png'), fav64);
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), fav64);
  fs.writeFileSync(path.join(distDir, 'favicon.png'), fav64);

  // 3. favicon.ico (32x32)
  const fav32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), fav32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), fav32);
  fs.writeFileSync(path.join(distDir, 'favicon.ico'), fav32);

  // 4. apple-touch-icon.png (180x180)
  const apple180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(distDir, 'apple-touch-icon.png'), apple180);

  console.log('✅ Generated logo.png, favicon.png, favicon.ico, apple-touch-icon.png!');
}

generate();
