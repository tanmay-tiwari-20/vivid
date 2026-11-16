import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const ink = '#172822';
const emerald = '#1EC89A';
const white = '#ffffff';

// Four asymmetric cut-paper forms circulate around a clear central opening.
// The two sizes and broad gaps give the emblem a crafted, printmaking character.
function mark(foreground = ink, accent = emerald) {
  return `<g transform="translate(38 38) scale(.84)">
    <path fill="${accent}" d="M-4-7C-29-6-44-20-38-36C-35-46-22-46-13-38C-4-30-1-17-4-7Z"/>
    <path fill="${accent}" d="M7-4C6-26 17-40 29-38C41-36 46-23 37-13C29-4 17-1 7-4Z"/>
    <path fill="${foreground}" d="M4 7C29 6 44 20 38 36C35 46 22 46 13 38C4 30 1 17 4 7Z"/>
    <path fill="${foreground}" d="M-7 4C-6 26-17 40-29 38C-41 36-46 23-37 13C-29 4-17 1-7 4Z"/>
  </g>`;
}

// Original rounded lowercase outlines, with emerald dots and low-contrast strokes.
// Both the wordmark and descriptor are paths, so exports need no installed font.
function wordmark(foreground, accent) {
  const v = 'M7 0C10 0 12 2 13 5L26 39L39 5C40 2 42 0 45 0C50 0 54 4 52 9L34 52C31 59 21 59 18 52L0 9C-2 4 2 0 7 0Z';
  const i = `<circle cx="6" cy="-13" r="7" fill="${accent}"/><rect width="12" height="55" rx="6"/>`;
  const d = `<g fill="none" stroke="${foreground}" stroke-width="12" stroke-linecap="round"><ellipse cx="24" cy="27" rx="18" ry="22"/><path d="M43-14V49"/></g>`;
  return `<g fill="${foreground}" transform="translate(84 18) scale(.97 1)">
    <path d="${v}"/>
    <g transform="translate(61)">${i}</g>
    <path transform="translate(83)" d="${v}"/>
    <g transform="translate(144)">${i}</g>
    <g transform="translate(161)">${d}</g>
  </g>`;
}

const descriptorLetters = {
  M: [8, 'M0 10V0l4 5.2L8 0v10'],
  E: [7, 'M7 0H0v10h7M0 4.8h6'],
  D: [7, 'M0 0h2.5C8.5 0 8.5 10 2.5 10H0Z'],
  I: [0, 'M0 0v10'],
  A: [8, 'M0 10 4 0l4 10M1.5 6.3h5'],
  W: [12, 'M0 0 2.8 10 6 1.5 9.2 10 12 0'],
  O: [8, 'M4 0C-1.3 0-1.3 10 4 10s5.3-10 0-10Z'],
  R: [7.5, 'M0 10V0h3.4c5.3 0 5.3 5.2 0 5.2H0m3.5 0 4 4.8'],
  K: [7.5, 'M0 0v10M7.5 0 0 5l7.5 5'],
  S: [7, 'M6.8 1C5.3-.5 0-.4 0 2.7s7 2.1 7 5.1-5.3 2.9-7 1.2'],
};

function descriptor(foreground) {
  let x = 0;
  const paths = [...'MEDIA WORKS'].map(letter => {
    if (letter === ' ') { x += 5; return ''; }
    const [width, path] = descriptorLetters[letter];
    const result = `<path transform="translate(${x})" d="${path}"/>`;
    x += width + 5;
    return result;
  }).join('');
  return `<g transform="translate(85 80) scale(1.6 1.4)" fill="none" stroke="${foreground}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

function lockup(foreground = ink, accent = emerald) {
  return `${mark(foreground, accent)}${wordmark(foreground, accent)}${descriptor(foreground)}`;
}

function svg(content, viewBox, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>\n`;
}

const images = `${root}public/images/`;
await mkdir(images, { recursive: true });
const primary = svg(lockup(), '0 -2 289 98', 'Vivid Media Works');
const inverse = svg(lockup(white), '0 -2 289 98', 'Vivid Media Works');
const mono = svg(lockup(ink, ink), '0 -2 289 98', 'Vivid Media Works');
const standalone = svg(mark(), '0 0 77 78', 'Vivid Media Works motion bloom mark');
const favicon = svg(`<rect width="64" height="64" rx="16" fill="${ink}"/><g transform="translate(9 8) scale(.6)">${mark(white, emerald)}</g>`, '0 0 64 64', 'Vivid Media Works');

await writeFile(`${images}vivid-logo.svg`, primary);
await writeFile(`${images}vivid-logo-inverse.svg`, inverse);
await writeFile(`${images}vivid-logo-mono.svg`, mono);
await writeFile(`${images}vivid-mark.svg`, standalone);
await writeFile(`${root}public/favicon.svg`, favicon);
await sharp(Buffer.from(primary)).resize({ width: 1734 }).png().toFile(`${images}vivid-logo.png`);
await sharp(Buffer.from(inverse)).resize({ width: 1734 }).png().toFile(`${images}vivid-logo-inverse.png`);
await sharp(Buffer.from(standalone)).resize({ width: 924 }).png().toFile(`${images}vivid-mark.png`);

const board = svg(`
  <rect width="1440" height="1080" fill="#f3fbf8"/>
  <rect x="32" y="32" width="1376" height="538" rx="20" fill="white"/>
  <g font-family="Arial, sans-serif" fill="${ink}">
    <text x="80" y="91" font-size="15" letter-spacing="3">VIVID MEDIA WORKS</text>
    <text x="1360" y="91" font-size="13" text-anchor="end" fill="#62756d">MOTION BLOOM / 03</text>
  </g>
  <g transform="translate(315 200) scale(2.8)">${lockup()}</g>
  <text x="720" y="518" font-family="Arial, sans-serif" font-size="17" text-anchor="middle" fill="#62756d">Different voices. Shared momentum.</text>
  <rect x="32" y="594" width="828" height="282" rx="20" fill="${ink}"/>
  <g transform="translate(189 666) scale(1.78)">${lockup(white)}</g>
  <text x="68" y="846" font-family="Arial, sans-serif" font-size="12" fill="#b7cec3" letter-spacing="2">ON DARK</text>
  <rect x="884" y="594" width="524" height="282" rx="20" fill="#dff7ef"/>
  <g transform="translate(1035 633) scale(1.72)">${mark()}</g>
  <g transform="translate(1228 701) scale(.68)">${mark()}</g>
  <g transform="translate(1315 722) scale(.35)">${mark()}</g>
  <text x="920" y="846" font-family="Arial, sans-serif" font-size="12" fill="#62756d" letter-spacing="2">A LITTLE CREATIVE ENERGY</text>
  <g font-family="Arial, sans-serif" font-size="12" fill="#62756d" letter-spacing="2">
    <text x="64" y="920">CUT-PAPER FORMS. ROUNDED LETTERING.</text>
  </g>
  <path d="M64 948H1376" stroke="#d8e8e1"/>
  <g font-family="Arial, sans-serif" font-size="13" fill="${ink}">
    <rect x="64" y="984" width="26" height="26" rx="6" fill="${emerald}"/><text x="103" y="1002">EMERALD / #1EC89A</text>
    <rect x="450" y="984" width="26" height="26" rx="6" fill="${ink}"/><text x="489" y="1002">DEEP GREEN / #172822</text>
    <rect x="893" y="984" width="26" height="26" rx="6" fill="white" stroke="#d8e8e1"/><text x="932" y="1002">WHITE / #FFFFFF</text>
  </g>`, '0 0 1440 1080', 'Vivid Media Works motion bloom identity, light and dark versions');
await mkdir(`${root}docs/previews/`, { recursive: true });
await sharp(Buffer.from(board)).png().toFile(`${root}docs/previews/vivid-logo-redesign.png`);
console.log('Generated Vivid motion bloom logos, transparent PNG exports, favicon, and brand preview.');
