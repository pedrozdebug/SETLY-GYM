// Generates PWA icons and iOS splash screens from vector sources.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const mark = (stroke = '#fff') => `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;

function icon(size, { maskable = false, mono = false } = {}) {
  const pad = maskable ? size * 0.22 : size * 0.2;
  const inner = size - pad * 2;
  const scale = inner / 24;
  const bg = mono ? '' : maskable
    ? `<rect width="${size}" height="${size}" fill="#8B5CF6"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#8B5CF6"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}<g transform="translate(${pad} ${pad}) scale(${scale})">${mark(mono ? '#000' : '#fff')}</g></svg>`);
}

function splash(w, h) {
  const s = Math.round(Math.min(w, h) * 0.22);
  const x = (w - s) / 2, y = (h - s) / 2 - s * 0.3;
  const fs = Math.round(s * 0.24);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#09090B"/>
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.24}" fill="#8B5CF6"/>
    <g transform="translate(${x + s * 0.22} ${y + s * 0.22}) scale(${(s * 0.56) / 24})">${mark()}</g>
    <text x="${w / 2}" y="${y + s + fs * 2}" fill="#FFFFFF" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="${fs}" font-weight="700" text-anchor="middle">Setly<tspan fill="#8B5CF6"> Gym</tspan></text>
  </svg>`);
}

mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });
const out = (buf, path) => sharp(buf).png().toFile(path);

await Promise.all([
  out(icon(192), 'public/icons/icon-192.png'),
  out(icon(512), 'public/icons/icon-512.png'),
  out(icon(192, { maskable: true }), 'public/icons/maskable-192.png'),
  out(icon(512, { maskable: true }), 'public/icons/maskable-512.png'),
  out(icon(512, { mono: true }), 'public/icons/monochrome-512.png'),
  out(icon(180, { maskable: true }), 'public/icons/apple-touch-icon.png'),
  ...[[1290, 2796], [1179, 2556], [1170, 2532], [1125, 2436], [828, 1792], [750, 1334], [1640, 2360]].map(([w, h]) => out(splash(w, h), `public/splash/splash-${w}x${h}.png`)),
]);
console.log('icons + splash generated');
