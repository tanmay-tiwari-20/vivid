import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = `${root}assets/brand/`;
const images = `${root}public/images/`;
const clear = { r: 0, g: 0, b: 0, alpha: 0 };

// Preserve supplied shapes and gradients; only remove the matte and margins.
async function prepare(filename, dark, width, height) {
  const { data, info } = await sharp(`${sources}${filename}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const distances = new Uint8Array(info.width * info.height);
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const pixel = y * info.width + x, offset = pixel * 3;
      const rgb = [data[offset], data[offset + 1], data[offset + 2]];
      const distance = dark ? Math.max(...rgb) : 255 - Math.min(...rgb);
      distances[pixel] = distance;
      if (distance > 10) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  left = Math.max(0, left - 3); top = Math.max(0, top - 3);
  right = Math.min(info.width - 1, right + 3); bottom = Math.min(info.height - 1, bottom + 3);
  const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
  const rgba = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const pixel = y * info.width + x, distance = distances[pixel];
      if (distance <= 2) continue;
      let alpha = 1;
      const touchesMatte = [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => distances[(y + dy) * info.width + x + dx] <= 2));
      if (touchesMatte) {
        let interiorDistance = distance;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            interiorDistance = Math.max(interiorDistance, distances[(y + dy) * info.width + x + dx] ?? 0);
          }
        }
        alpha = distance / interiorDistance;
      }
      const target = ((y - top) * cropWidth + x - left) * 4, matte = dark ? 0 : 255;
      for (let channel = 0; channel < 3; channel++) {
        rgba[target + channel] = Math.max(0, Math.min(255, Math.round((data[pixel * 3 + channel] - matte * (1 - alpha)) / alpha)));
      }
      rgba[target + 3] = Math.round(alpha * 255);
    }
  }
  return sharp(rgba, { raw: { width: cropWidth, height: cropHeight, channels: 4 } })
    .resize(width, height, { fit: 'contain', background: clear }).png({ compressionLevel: 9 }).toBuffer();
}

function imageSvg(buffer, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Vivid Media Works"><title>Vivid Media Works</title><image width="${width}" height="${height}" href="data:image/png;base64,${buffer.toString('base64')}"/></svg>\n`;
}

await mkdir(images, { recursive: true });
const logoLight = await prepare('IMG_1881.PNG', false, 1200, 540);
const logoDark = await prepare('IMG_1882.PNG', true, 1200, 540);
const markLight = await prepare('IMG_1883.PNG', false, 1024, 736);
const markDark = await prepare('IMG_1884.PNG', true, 1024, 736);

for (const [filename, buffer] of [
  ['vivid-logo-light.png', logoLight], ['vivid-logo-dark.png', logoDark],
  ['vivid-mark-light.png', markLight], ['vivid-mark-dark.png', markDark],
  ['vivid-logo.png', logoLight], ['vivid-logo-inverse.png', logoDark], ['vivid-mark.png', markLight],
]) await writeFile(`${images}${filename}`, buffer);

// Keep existing URLs and CMS fixture files pointed at the supplied artwork.
for (const [filename, buffer, width, height] of [
  ['vivid-logo.svg', logoLight, 1200, 540], ['vivid-logo-inverse.svg', logoDark, 1200, 540],
  ['vivid-logo-mono.svg', logoLight, 1200, 540], ['vivid-mark.svg', markLight, 1024, 736],
]) await writeFile(`${images}${filename}`, imageSvg(buffer, width, height));
await writeFile(`${images}vivid-logo-original.png`, await readFile(`${sources}IMG_1881.PNG`));
await sharp(logoLight).flatten({ background: '#ffffff' }).png().toFile(`${images}vivid-logo-preview.png`);

const faviconMark = await sharp(markDark).resize(52, 44, { fit: 'contain', background: clear }).png().toBuffer();
await writeFile(`${root}public/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Vivid Media Works</title><rect width="64" height="64" rx="14" fill="#052d20"/><image x="6" y="10" width="52" height="44" href="data:image/png;base64,${faviconMark.toString('base64')}"/></svg>\n`);

await mkdir(`${root}docs/previews/`, { recursive: true });
const preview = await sharp({ create: { width: 1200, height: 900, channels: 4, background: '#ffffff' } }).composite([
  { input: await sharp(logoLight).resize(840, 378).png().toBuffer(), left: 180, top: 36 },
  { input: await sharp({ create: { width: 1200, height: 450, channels: 4, background: '#052d20' } }).png().toBuffer(), left: 0, top: 450 },
  { input: await sharp(logoDark).resize(840, 378).png().toBuffer(), left: 180, top: 486 },
]).png().toBuffer();
await writeFile(`${root}docs/previews/vivid-logo-redesign.png`, preview);
console.log('Prepared supplied IMG_1881–IMG_1884 logos, marks, favicon, and preview.');
