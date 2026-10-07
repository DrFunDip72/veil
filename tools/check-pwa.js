/* Verifies Veil is actually installable rather than just looking like it.
 * Run:  node tools/check-pwa.js [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8123').replace(/\/$/, '');

let fails = 0;
const check = (label, pass, detail) => {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  if (!pass) fails++;
};

async function main() {
  console.log('Manifest');
  const mRes = await fetch(BASE + '/manifest.webmanifest');
  check('manifest is served', mRes.ok, 'HTTP ' + mRes.status);
  const m = await mRes.json();

  check('has a name', !!m.name, m.name);
  check('has a short_name under 13 chars', !!m.short_name && m.short_name.length <= 12, m.short_name);
  check('display is standalone', m.display === 'standalone', m.display);
  check('has start_url', !!m.start_url, m.start_url);
  check('has theme_color + background_color',
    !!m.theme_color && !!m.background_color, m.theme_color + ' / ' + m.background_color);

  const sizes = (m.icons || []).map(i => i.sizes);
  check('has a 192px icon', sizes.includes('192x192'), sizes.join(', '));
  check('has a 512px icon', sizes.includes('512x512'));
  check('has a maskable icon',
    (m.icons || []).some(i => (i.purpose || '').includes('maskable')));

  console.log('\nIcons resolve and are real PNGs');
  for (const icon of m.icons) {
    const r = await fetch(BASE + '/' + icon.src.replace(/^\.?\//, ''));
    const buf = Buffer.from(await r.arrayBuffer());
    const sig = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    check(icon.src, r.ok && sig && icon.sizes === w + 'x' + h,
      'HTTP ' + r.status + ', ' + w + 'x' + h + ', png=' + sig);
  }

  console.log('\nService worker + shell');
  const sw = await fetch(BASE + '/sw.js');
  check('sw.js is served', sw.ok, 'HTTP ' + sw.status);
  const swText = await sw.text();
  const shell = [...swText.matchAll(/'\.\/([^']+)'/g)].map(x => x[1]).filter(f => f && !f.endsWith('/'));
  for (const f of new Set(shell)) {
    const r = await fetch(BASE + '/' + f, { method: 'HEAD' });
    check('precached file exists: ' + f, r.ok, 'HTTP ' + r.status);
  }

  console.log('\nDocument');
  const html = await (await fetch(BASE + '/index.html')).text();
  check('links the manifest', /rel="manifest"/.test(html));
  check('sets theme-color', /name="theme-color"/.test(html));
  check('has an apple-touch-icon', /rel="apple-touch-icon"/.test(html));
  check('registers the service worker', /serviceWorker/.test(
    await (await fetch(BASE + '/app.js')).text()));

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'Installable.'));
  /* Set the code rather than calling process.exit — exiting here while fetch's
   * sockets are still closing trips a libuv assertion on Windows. */
  process.exitCode = fails ? 1 : 0;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
