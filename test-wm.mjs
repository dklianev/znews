import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function test() {
    const logoPath = path.resolve('server/fonts/brand-logo.png');
    // Create a dummy image
    const imgBuffer = await sharp({
        create: { width: 1200, height: 800, channels: 4, background: { r: 50, g: 150, b: 200, alpha: 1 } }
    }).png().toBuffer();

    const imgSharp = sharp(imgBuffer);
    const metadata = await imgSharp.metadata();

    // 1. Calculate watermark width: 25% of image width
    const wmWidth = Math.max(100, Math.round(metadata.width * 0.25));

    // 2. Resize watermark
    const wmBuffer = await sharp(logoPath)
        .resize({ width: wmWidth })
        .toBuffer();

    // 3. Get watermark height
    const wmMeta = await sharp(wmBuffer).metadata();

    // 4. Calculate position (right bottom with 3% margin)
    const margin = Math.round(metadata.width * 0.03);
    const left = metadata.width - wmMeta.width - margin;
    const top = metadata.height - wmMeta.height - margin;

    // 5. Composite and save
    await imgSharp
        .composite([{ input: wmBuffer, left, top, blend: 'over' }])
        .webp({ quality: 82 })
        .toFile('test-watermark-out.webp');

    console.log('Watermark test complete. File: test-watermark-out.webp');
}

test().catch(console.error);
