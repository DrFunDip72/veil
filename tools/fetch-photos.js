/* Builds Veil's photo library from the Unsplash API, measuring each photo's
 * real style from its own pixels.
 *
 *   setx UNSPLASH_ACCESS_KEY "..."      (or pass --key=...)
 *   node tools/fetch-photos.js
 *   node tools/fetch-photos.js --probe  # 2 buckets, no file written
 *
 * Chrome must be running with --remote-debugging-port=9222 (used to decode
 * and measure the images — no native image deps).
 *
 * Why the measuring matters: Veil's blind taste test is only meaningful if a
 * photo's recorded style matches what the photo actually looks like. Dropping
 * in real images with invented axis values would leave a bright airy shot
 * labelled "moody film" and the matching would be theatre. So warmth, light,
 * colour and grain are computed from pixels. Pose and scale are not
 * recoverable without a model, so they come from the deliberately-chosen
 * search bucket each photo was found in.
 *
 * Licensing: only photo IDs and credits are committed — no image is
 * redistributed. The app hotlinks images.unsplash.com, which is what the
 * Unsplash License is built for. Their API Terms additionally require
 * crediting the photographer and Unsplash, which is why every entry carries
 * its creator and the app has a credits screen.
 */
const fs = require('fs');
const path = require('path');
const { connect, evaluate } = require('./cdp.js');

const OUT = path.join(__dirname, '..', 'photos.js');
const PROBE = process.argv.includes('--probe');
const KEY = (process.argv.find(a => a.startsWith('--key=')) || '').slice(6) ||
  process.env.UNSPLASH_ACCESS_KEY;

if (!KEY) {
  console.error(`
No Unsplash access key.

  1. https://unsplash.com/developers  ->  "Your apps"  ->  "New Application"
  2. Accept the terms, name it anything (e.g. "Veil")
  3. Copy the **Access Key** (not the Secret key)

Then either:
  $env:UNSPLASH_ACCESS_KEY = "paste-key-here"   # PowerShell, this session
  node tools/fetch-photos.js

or:
  node tools/fetch-photos.js --key=paste-key-here
`);
  process.exit(1);
}

/* Each bucket fixes the two axes that cannot be measured from pixels, and
 * spans them deliberately so the taste test has something to separate.
 *   pose:  -1 candid/documentary .. +1 posed/editorial
 *   scale: -1 intimate/tight     .. +1 epic/wide landscape
 */
const BUCKETS = [
  { q: 'engagement session couple',      shoot: 'engagements', pose: -0.7, scale: -0.3 },
  { q: 'engaged couple laughing',        shoot: 'engagements', pose: -0.9, scale: -0.5 },
  { q: 'couple mountains engagement',    shoot: 'engagements', pose: -0.2, scale:  0.9 },
  { q: 'couple editorial portrait',      shoot: 'engagements', pose:  0.8, scale: -0.4 },
  { q: 'couple golden hour field',       shoot: 'engagements', pose:  0.1, scale:  0.7 },

  { q: 'bridal portrait',                shoot: 'bridals',     pose:  0.8, scale: -0.6 },
  { q: 'bride wedding dress',            shoot: 'bridals',     pose:  0.7, scale: -0.3 },
  { q: 'bride veil outdoors',            shoot: 'bridals',     pose: -0.3, scale: -0.2 },
  { q: 'bride dress landscape',          shoot: 'bridals',     pose:  0.4, scale:  0.9 },
  { q: 'bride getting ready',            shoot: 'bridals',     pose: -0.8, scale: -0.7 },

  { q: 'wedding ceremony',               shoot: 'weddings',    pose: -0.6, scale:  0.1 },
  { q: 'wedding reception dancing',      shoot: 'weddings',    pose: -0.9, scale: -0.3 },
  { q: 'bride and groom portrait',       shoot: 'weddings',    pose:  0.7, scale: -0.3 },
  { q: 'wedding couple landscape',       shoot: 'weddings',    pose:  0.3, scale:  0.9 },
  { q: 'wedding guests celebration',     shoot: 'weddings',    pose: -0.9, scale: -0.4 },
  { q: 'outdoor wedding venue',          shoot: 'weddings',    pose: -0.2, scale:  0.8 },
];

const PAGES = PROBE ? 1 : Number((process.argv.find(a => a.startsWith('--pages=')) || '--pages=2').slice(8));
/* The API work is the scarce resource (50 calls/hour on a demo app) and the
 * measuring is the slow part, so the fetched list is cached to disk. A crash
 * or timeout during measurement then costs minutes, not an hour's quota. */
const CACHE = path.join(__dirname, '.photo-cache.json');
const FRESH = process.argv.includes('--fresh');
const PER_PAGE = PROBE ? 8 : 30;

/* ------------------------------------------------------------- Unsplash API */
async function search(bucket, page) {
  const url = 'https://api.unsplash.com/search/photos' +
    '?query=' + encodeURIComponent(bucket.q) +
    '&per_page=' + PER_PAGE + '&page=' + page +
    '&orientation=portrait&content_filter=high';

  const res = await fetch(url, {
    headers: {
      Authorization: 'Client-ID ' + KEY,
      'Accept-Version': 'v1',
    },
  });

  if (res.status === 401) throw new Error('Unsplash rejected the key (401). Check you copied the Access Key, not the Secret key.');
  if (res.status === 403) {
    const left = res.headers.get('x-ratelimit-remaining');
    throw new Error('Rate limited by Unsplash (403, remaining=' + left + '). Demo apps get 50 requests/hour — wait an hour and re-run.');
  }
  if (!res.ok) throw new Error('Unsplash HTTP ' + res.status + ' for "' + bucket.q + '"');

  const json = await res.json();
  return {
    remaining: res.headers.get('x-ratelimit-remaining'),
    results: (json.results || []).map(r => ({
      id: (r.urls && r.urls.raw || '').match(/images\.unsplash\.com\/([^?]+)/)?.[1] || null,
      by: (r.user && r.user.name) || 'Unknown',
      u: (r.user && r.user.username) || '',
      w: r.width,
      h: r.height,
    })).filter(r => r.id),
  };
}

/* ------------------------------------------------------- measure the pixels */
const ANALYSE = `(async (ids) => {
  const one = async (id) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'https://images.unsplash.com/' + id + '?w=260&h=320&fit=crop&q=80';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error('load failed'));
        setTimeout(() => rej(new Error('timeout')), 20000);
      });

      const W = 120, H = 150;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;

      let rSum = 0, bSum = 0, lSum = 0, satSum = 0, n = 0;
      const lum = new Float32Array(W * H);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lum[p] = l;
        rSum += r; bSum += b; lSum += l;
        satSum += mx === 0 ? 0 : (mx - mn) / mx;
        n++;
      }

      /* High-frequency energy on the luminance plane: a stand-in for grain
       * and the absence of digital smoothing. */
      let hf = 0, hfN = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const p = y * W + x;
          hf += Math.abs(4 * lum[p] - lum[p - 1] - lum[p + 1] - lum[p - W] - lum[p + W]);
          hfN++;
        }
      }

      /* Film rarely reaches true black; crushed blacks read as digital. */
      const sorted = Array.from(lum).sort((a, b) => a - b);
      const p05 = sorted[(sorted.length * 0.05) | 0];
      const p95 = sorted[(sorted.length * 0.95) | 0];

      return {
        id, ok: true,
        rawWarmth: (rSum - bSum) / n,
        rawLight: lSum / n,
        rawColor: satSum / n,
        rawFilm: (hf / hfN) * 6 + p05 * 2 - (p95 - p05) * 0.5,
      };
    } catch (err) {
      return { id, ok: false, error: String((err && err.message) || err) };
    }
  };
  return Promise.all(ids.map(one));
})(${'%IDS%'})`;

async function analyse(ws, ids) {
  const out = [];
  const CHUNK = 24; // loaded concurrently inside the page
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await evaluate(ws, ANALYSE.replace('%IDS%', JSON.stringify(ids.slice(i, i + CHUNK))), 180000);
    out.push(...res);
    process.stdout.write('  measured ' + Math.min(i + CHUNK, ids.length) + '/' + ids.length + '   \r');
  }
  console.log('');
  return out;
}

/* Rank-normalise into -1..1. Absolute photographic values cluster tightly
 * (most photos sit near mid brightness); what the matcher needs is spread,
 * and relative position within a real corpus is both honest and well spread. */
function rankNormalise(rows, field, target) {
  const sorted = rows.slice().sort((a, b) => a[field] - b[field]);
  sorted.forEach((row, i) => {
    const pct = sorted.length === 1 ? 0.5 : i / (sorted.length - 1);
    row[target] = Math.round((pct * 2 - 1) * 1000) / 1000;
  });
}

async function main() {
  const buckets = PROBE ? BUCKETS.slice(0, 2) : BUCKETS;
  console.log('Fetching from Unsplash (' + buckets.length + ' queries x ' + PAGES + ' page(s))\n');

  let photos = [];
  let remaining = '?';

  if (!FRESH && fs.existsSync(CACHE)) {
    photos = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log('  reusing ' + photos.length + ' photos from ' + path.basename(CACHE) +
      '  (--fresh to re-fetch)\n');
  } else {
    const seen = new Set();
    for (const bucket of buckets) {
      let added = 0, found = 0;
      for (let page = 1; page <= PAGES; page++) {
        const res = await search(bucket, page);
        remaining = res.remaining;
        found += res.results.length;
        res.results.forEach(r => {
          if (seen.has(r.id)) return;
          seen.add(r.id);
          photos.push({
            id: r.id, shoot: bucket.shoot, pose: bucket.pose, scale: bucket.scale,
            by: r.by, u: r.u,
          });
          added++;
        });
      }
      console.log('  ' + bucket.q.padEnd(30) + found + ' found, ' + added + ' new');
    }
    // Persist before the slow part, so a timeout never costs API quota again.
    fs.writeFileSync(CACHE, JSON.stringify(photos));
    console.log('\n  cached to ' + path.basename(CACHE));
  }

  console.log('\n' + photos.length + ' unique photos   (api calls left this hour: ' + remaining + ')');
  const perShoot = {};
  photos.forEach(p => { perShoot[p.shoot] = (perShoot[p.shoot] || 0) + 1; });
  console.log('  per shoot: ' + JSON.stringify(perShoot));

  const NEED = 70; // 14 photographers x 5 photos
  Object.entries(perShoot).forEach(([shoot, n]) => {
    if (n < NEED) console.log('  WARNING: ' + shoot + ' has ' + n + ', needs >= ' + NEED);
  });

  console.log('\nMeasuring pixels in Chrome');
  const ws = await connect();
  const stats = await analyse(ws, photos.map(p => p.id));
  ws.close();

  const byId = {};
  stats.forEach(s => { byId[s.id] = s; });
  const good = photos.filter(p => byId[p.id] && byId[p.id].ok);
  good.forEach(p => Object.assign(p, byId[p.id]));

  console.log('  ' + good.length + ' of ' + photos.length + ' measured ok');
  const failed = stats.filter(s => !s.ok);
  if (failed.length) console.log('  example failure: ' + failed[0].error);
  if (!good.length) throw new Error('nothing measured — is the CDN reachable from Chrome?');

  rankNormalise(good, 'rawWarmth', 'warmth');
  rankNormalise(good, 'rawLight', 'light');
  rankNormalise(good, 'rawColor', 'color');
  rankNormalise(good, 'rawFilm', 'grain');

  const slim = good.map(p => ({
    id: p.id,
    shoot: p.shoot,
    by: p.by,
    u: p.u,
    axes: {
      warmth: p.warmth, light: p.light, grain: p.grain,
      pose: p.pose, scale: p.scale, color: p.color,
    },
  }));

  const spread = ['warmth', 'light', 'grain', 'color'].map(k => {
    const v = slim.map(p => p.axes[k]);
    return k + ' [' + Math.min(...v).toFixed(2) + ', ' + Math.max(...v).toFixed(2) + ']';
  });
  console.log('  measured axis spread: ' + spread.join('  '));

  if (PROBE) {
    console.log('\n--probe: not writing photos.js');
    console.log(JSON.stringify(slim.slice(0, 2), null, 2));
    return;
  }

  const body =
    '/* Generated by tools/fetch-photos.js on ' + new Date().toISOString().slice(0, 10) + '.\n' +
    ' *\n' +
    ' * Real wedding photography hotlinked from Unsplash. warmth/light/grain/\n' +
    ' * colour are measured from each photo\'s own pixels; pose and scale come\n' +
    ' * from the search bucket it was found in. Credits are carried per photo\n' +
    ' * because the Unsplash API Terms require attributing the photographer.\n' +
    ' *\n' +
    ' * Do not hand-edit — re-run the tool.\n' +
    ' */\n' +
    'const VEIL_PHOTO_LIBRARY = ' + JSON.stringify(slim) + ';\n' +
    "if (typeof window !== 'undefined') window.VEIL_PHOTO_LIBRARY = VEIL_PHOTO_LIBRARY;\n" +
    "if (typeof module !== 'undefined') module.exports = VEIL_PHOTO_LIBRARY;\n";

  fs.writeFileSync(OUT, body);
  console.log('\nwrote photos.js — ' + slim.length + ' photos, ' + (body.length / 1024).toFixed(1) + ' KB');
  console.log("Next: node test/photos.test.js   (data.js assigns them to photographers on load)");
}

main().catch(e => { console.error('\n' + e.message); process.exitCode = 1; });
