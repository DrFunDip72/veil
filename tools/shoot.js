/* Screenshots Veil's key screens by driving headless Chrome over CDP.
 * Run:  node tools/shoot.js [baseUrl]
 * Chrome must already be listening on --remote-debugging-port=9222.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const OUT = path.join(__dirname, '..', 'screens');
fs.mkdirSync(OUT, { recursive: true });

/* Seeds a believable bride: warm / film / candid taste, Provo wedding. */
const SEED = `(() => {
  const D = window.VEIL_DATA;
  const deck = D.buildTasteDeck(36);
  const ideal = { warmth: 0.75, light: 0.2, grain: 0.7, pose: -0.7, scale: 0.0, color: -0.4 };
  const scored = deck.map(ph => ({
    ph, d: D.AXIS_KEYS.reduce((a, k) => a + Math.abs(ph.axes[k] - ideal[k]), 0)
  })).sort((a, b) => a.d - b.d);
  const rank = new Map(scored.map((x, i) => [x.ph.id, i]));
  const swipes = deck.map(ph => {
    const i = rank.get(ph.id);
    return { photoId: ph.id, vote: i < 7 ? 'love' : i < 16 ? 'like' : 'pass' };
  });
  return swipes;
})()`;

let msgId = 0;

function send(ws, method, params) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const onMsg = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (m.error) reject(new Error(method + ': ' + JSON.stringify(m.error)));
      else resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    setTimeout(() => reject(new Error(method + ' timed out')), 30000);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function evaluate(ws, expression) {
  const res = await send(ws, 'Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error('page error: ' + (res.exceptionDetails.exception
      ? res.exceptionDetails.exception.description
      : res.exceptionDetails.text));
  }
  return res.result.value;
}

/* Capture just the phone, not the whole desktop stage. */
async function shootDevice(ws, file) {
  const box = await evaluate(ws, `(() => {
    const d = document.querySelector('.device').getBoundingClientRect();
    return { x: d.x, y: d.y, width: d.width, height: d.height };
  })()`);

  const res = await send(ws, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: Math.round(box.x) - 2, y: Math.round(box.y) - 2,
      width: Math.round(box.width) + 4, height: Math.round(box.height) + 4,
      scale: 1,
    },
    captureBeyondViewport: true,
  });
  const out = path.join(OUT, file);
  fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
  console.log('  shot ' + file);
}

/* Wait until every <img> currently in the DOM has settled. */
async function imagesSettled(ws, budgetMs = 9000) {
  const started = Date.now();
  while (Date.now() - started < budgetMs) {
    const pending = await evaluate(ws, `(() => Array.from(document.images)
      .filter(i => !i.complete).length)()`);
    if (pending === 0) { await sleep(260); return; }
    await sleep(320);
  }
  console.log('  (images still loading, shooting anyway)');
}

async function main() {
  const list = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no debuggable page — is Chrome running with --remote-debugging-port=9222?');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');

  const errors = [];
  ws.addEventListener('message', ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.exception
        ? m.params.exceptionDetails.exception.description
        : m.params.exceptionDetails.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  const load = url => new Promise(async resolve => {
    const onMsg = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
    };
    ws.addEventListener('message', onMsg);
    await send(ws, 'Page.navigate', { url });
    setTimeout(resolve, 12000);
  });

  /* ---------------------------------------------------- 1. first run */
  console.log('welcome');
  await load(BASE);
  await evaluate(ws, `localStorage.clear()`);
  await load(BASE);
  await imagesSettled(ws);
  await shootDevice(ws, '1-welcome.png');

  /* ---------------------------------------------------- 2. setup */
  console.log('setup');
  await evaluate(ws, `document.querySelector('[data-go="setup"]').click()`);
  await sleep(300);
  await evaluate(ws, `(() => {
    const d = document.querySelector('#f-date');
    d.value = '2027-06-12';
    d.dispatchEvent(new Event('change'));
    document.querySelector('#setup-next').click();
  })()`);
  await sleep(350);
  await shootDevice(ws, '2-setup-venues.png');

  /* ---------------------------------------------------- 3. taste test */
  console.log('taste test');
  await evaluate(ws, `(() => {
    ['provo-temple','bridal-veil','oak-hills'].forEach(id =>
      document.querySelector('[data-venue="' + id + '"]').click());
    document.querySelector('#setup-next').click();
  })()`);
  await sleep(300);
  await evaluate(ws, `document.querySelector('#setup-next').click()`);
  await sleep(600);
  await imagesSettled(ws);
  await shootDevice(ws, '3-taste-blind.png');

  /* ---------------------------------------------------- 4. style reveal */
  console.log('reveal + matches');
  const seeded = await evaluate(ws, `(() => {
    const swipes = ${SEED};
    const raw = JSON.parse(localStorage.getItem('veil.state.v1'));
    raw.swipes = swipes;
    raw.tasteDone = true;
    raw.onboarded = true;
    raw.prefs.budgetMax = 3200;
    localStorage.setItem('veil.state.v1', JSON.stringify(raw));
    return swipes.length;
  })()`);
  console.log('  seeded ' + seeded + ' swipes');
  await load(BASE);
  await evaluate(ws, `window.veilGo('reveal')`);
  await sleep(400);
  await imagesSettled(ws);
  await shootDevice(ws, '4-your-style.png');

  /* ---------------------------------------------------- 5. matches */
  await evaluate(ws, `window.veilGo('matches')`);
  await sleep(400);
  await imagesSettled(ws);
  await shootDevice(ws, '5-matches.png');

  /* ---------------------------------------------------- 6. full profile */
  console.log('profile');
  // Only the top card of the deck is wired up; the one behind it is inert.
  await evaluate(ws, `document.querySelector('#deck .matchcard:last-child [data-open]').click()`);
  await sleep(500);
  await imagesSettled(ws);
  await shootDevice(ws, '6-profile.png');

  /* ---------------------------------------------------- 7. shortlist */
  console.log('shortlist + compare');
  const picked = await evaluate(ws, `(() => {
    const raw = JSON.parse(localStorage.getItem('veil.state.v1'));
    const rank = VEIL_ENGINE.rankMatches(
      VEIL_ENGINE.buildProfile(raw.swipes, (() => {
        const idx = {};
        VEIL_DATA.PHOTOGRAPHERS.forEach(p => p.photos.forEach(ph => idx[ph.id] = ph));
        return idx;
      })()),
      { date: raw.prefs.date, shoots: raw.prefs.shoots, budgetMax: raw.prefs.budgetMax,
        venues: raw.prefs.venueIds.map(id => VEIL_DATA.VENUES.find(v => v.id === id)) }
    );
    const top = rank.slice(0, 4).map(r => r.photographer.id);
    raw.shortlist = top;
    top.forEach(id => raw.seen[id] = 'shortlist');
    raw.compareSel = top.slice(0, 3);
    localStorage.setItem('veil.state.v1', JSON.stringify(raw));
    return top;
  })()`);
  console.log('  shortlisted ' + picked.join(', '));

  await load(BASE);
  await evaluate(ws, `window.veilGo('shortlist')`);
  await sleep(400);
  await imagesSettled(ws);
  await shootDevice(ws, '7-shortlist.png');

  /* ---------------------------------------------------- 8. compare */
  await evaluate(ws, `window.veilGo('compare')`);
  await sleep(450);
  await imagesSettled(ws);
  await shootDevice(ws, '8-compare.png');

  /* ---------------------------------------------------- 9. message */
  console.log('message');
  await evaluate(ws, `document.querySelector('[data-pick]').click()`);
  await sleep(500);
  await imagesSettled(ws);
  await shootDevice(ws, '9-message.png');

  console.log('credits');
  await evaluate(ws, `window.veilGo('credits')`);
  await sleep(400);
  await shootDevice(ws, '11-credits.png');

  /* ---------------------------------------------------- 10. pro side */
  console.log('photographer side');
  await evaluate(ws, `window.veilGo('pro')`);
  await sleep(400);
  await shootDevice(ws, '10-photographer.png');

  if (errors.length) {
    console.log('\nPAGE ERRORS:');
    [...new Set(errors)].forEach(e => console.log('  ' + e));
  } else {
    console.log('\nNo page errors.');
  }
  ws.close();
}

main().catch(err => { console.error(err); process.exit(1); });
