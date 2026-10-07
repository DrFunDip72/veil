/* Generates Veil's PWA icons as real PNGs with no dependencies.
 * Run: node tools/gen-icons.js
 *
 * Mark: an ivory "V" under a thin arch — the veil. Drawn by signed distance
 * so it stays crisp at 180px and smooth at 512px.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..');

const PLUM = [92, 49, 72];
const IVORY = [251, 248, 244];
const BLUSH = [231, 205, 210];

/* ------------------------------------------------------------ PNG encoding */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- the drawing */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/* Coverage of the mark at normalised point (x, y), both in 0..1. */
function markCoverage(x, y, px, scaleIn) {
  // Re-map into the mark's own box so maskable icons can inset the artwork.
  const s = scaleIn;
  const mx = (x - 0.5) / s + 0.5;
  const my = (y - 0.5) / s + 0.5;
  const aa = px * 1.25 / s;

  const smooth = d => {
    if (d <= -aa) return 1;
    if (d >= aa) return 0;
    return 0.5 - d / (2 * aa);
  };

  // The V
  const vTop = 0.315, vBot = 0.735, vHalf = 0.215, stroke = 0.082;
  const dLeft = distToSegment(mx, my, 0.5 - vHalf, vTop, 0.5, vBot);
  const dRight = distToSegment(mx, my, 0.5 + vHalf, vTop, 0.5, vBot);
  const vCov = Math.max(smooth(dLeft - stroke / 2), smooth(dRight - stroke / 2));

  // The arch above it — top half of a thin ring
  const cx = 0.5, cy = 0.335, r = 0.265, ring = 0.026;
  const dRing = Math.abs(Math.hypot(mx - cx, my - cy) - r) - ring / 2;
  const archCov = my <= cy ? smooth(dRing) : 0;

  return { vCov, archCov };
}

function render(size, { inset = 1, bg = PLUM, squareBleed = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const px = 1 / size;
  const radius = 0.185; // rounded square for the non-maskable icons

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
      const i = (y * size + x) * 4;

      // Background shape: full bleed for maskable, rounded square otherwise.
      let bgA = 1;
      if (!squareBleed) {
        const qx = Math.abs(nx - 0.5) - (0.5 - radius);
        const qy = Math.abs(ny - 0.5) - (0.5 - radius);
        const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius
          + Math.min(Math.max(qx, qy), 0) * 0;
        bgA = d <= -px ? 1 : d >= px ? 0 : 0.5 - d / (2 * px);
      }

      const { vCov, archCov } = markCoverage(nx, ny, px, inset);

      // Compose: background, then the arch in blush, then the V in ivory.
      let r = bg[0], g = bg[1], b = bg[2];
      if (archCov > 0) {
        r = r + (BLUSH[0] - r) * archCov;
        g = g + (BLUSH[1] - g) * archCov;
        b = b + (BLUSH[2] - b) * archCov;
      }
      if (vCov > 0) {
        r = r + (IVORY[0] - r) * vCov;
        g = g + (IVORY[1] - g) * vCov;
        b = b + (IVORY[2] - b) * vCov;
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

const targets = [
  { file: 'icon-192.png', size: 192, opts: { squareBleed: false } },
  { file: 'icon-512.png', size: 512, opts: { squareBleed: false } },
  // Maskable needs the mark inside the ~80% safe zone, on full bleed.
  { file: 'icon-maskable-512.png', size: 512, opts: { inset: 0.68, squareBleed: true } },
  { file: 'apple-touch-icon.png', size: 180, opts: { inset: 0.86, squareBleed: true } },
];

targets.forEach(t => {
  const buf = render(t.size, t.opts);
  fs.writeFileSync(path.join(OUT, t.file), buf);
  console.log('wrote ' + t.file + '  ' + t.size + 'x' + t.size + '  ' + buf.length + ' bytes');
});

/* Matching SVG for the favicon and the in-app wordmark. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="18.5" fill="#5C3148"/>
  <path d="M23.5 33.5 A26.5 26.5 0 0 1 76.5 33.5" fill="none" stroke="#E7CDD2" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M28.5 31.5 L50 73.5 L71.5 31.5" fill="none" stroke="#FBF8F4" stroke-width="8.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);
console.log('wrote icon.svg');
