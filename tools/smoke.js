/* End-to-end smoke test against a live origin.
 * Run:  node tools/smoke.js https://veilphoto.vercel.app
 * Chrome must already be listening on --remote-debugging-port=9222.
 *
 * Checks the things that can only fail on a real origin: service worker
 * activation, offline replay from cache, and a full swipe-to-message run.
 */
const BASE = (process.argv[2] || 'https://veilphoto.vercel.app').replace(/\/$/, '');

let msgId = 0, fails = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = (label, pass, detail) => {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  if (!pass) fails++;
};

function send(ws, method, params, timeoutMs) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const onMsg = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    setTimeout(() => reject(new Error(method + ' timed out')), timeoutMs || 30000);
  });
}

async function evaluate(ws, expression, timeoutMs) {
  const res = await send(ws, 'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (res.exceptionDetails) {
    throw new Error('page error: ' + (res.exceptionDetails.exception
      ? res.exceptionDetails.exception.description : res.exceptionDetails.text));
  }
  return res.result.value;
}

async function main() {
  const list = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no debuggable page — start Chrome with --remote-debugging-port=9222');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  await send(ws, 'Network.enable');

  const errors = [];
  ws.addEventListener('message', ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push(d.exception ? d.exception.description : d.text);
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
    setTimeout(resolve, 20000);
  });

  console.log('Loading ' + BASE);
  await load(BASE + '/');
  await evaluate(ws, `localStorage.clear()`);
  await load(BASE + '/');

  console.log('\nApp boots');
  /* What actually matters for a PWA is a secure context, which https and
   * localhost both satisfy — so this passes against a local server too. */
  const ctx = await evaluate(ws, `({ secure: isSecureContext, proto: location.protocol })`);
  check('secure context (required for the service worker)', ctx.secure === true, ctx.proto);
  check('data layer loaded', await evaluate(ws, `!!window.VEIL_DATA && VEIL_DATA.PHOTOGRAPHERS.length`) === 14);
  check('engine loaded', await evaluate(ws, `typeof VEIL_ENGINE.rankMatches`) === 'function');
  check('welcome screen rendered',
    (await evaluate(ws, `document.querySelector('.display').textContent`)).includes('photographer'));

  console.log('\nService worker');
  /* skipWaiting() + clients.claim() mean the worker is briefly 'activating'
   * immediately after registration, so poll instead of sampling once. */
  const swState = await evaluate(ws, `(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 25; i++) {
      if (reg.active && reg.active.state === 'activated') break;
      await new Promise(r => setTimeout(r, 200));
    }
    return { scope: reg.scope, active: !!reg.active, state: reg.active && reg.active.state };
  })()`);
  check('service worker reaches activated', swState.active && swState.state === 'activated',
    swState.state + ' @ ' + swState.scope);

  const caches = await evaluate(ws, `caches.keys()`);
  check('shell cache created', caches.some(c => c.includes('shell')), caches.join(', '));

  const cached = await evaluate(ws, `(async () => {
    const c = await caches.open((await caches.keys()).find(k => k.includes('shell')));
    const keys = await c.keys();
    return keys.map(r => new URL(r.url).pathname);
  })()`);
  ['/app.js', '/data.js', '/engine.js', '/styles.css'].forEach(f =>
    check('precached ' + f, cached.includes(f)));

  console.log('\nOffline');
  await send(ws, 'Network.emulateNetworkConditions',
    { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await load(BASE + '/');
  const offlineOK = await evaluate(ws, `!!window.VEIL_DATA && !!document.querySelector('.display')`);
  check('app still loads with the network cut', offlineOK === true);
  await send(ws, 'Network.emulateNetworkConditions',
    { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  console.log('\nFull run: setup -> taste -> match -> shortlist -> compare -> message');
  await load(BASE + '/');
  await evaluate(ws, `document.querySelector('[data-go="setup"]').click()`);
  await sleep(250);
  await evaluate(ws, `document.querySelector('[data-skip-setup]').click()`);
  await sleep(400);
  check('taste deck rendered', await evaluate(ws, `!!document.querySelector('#deck .swipecard')`) === true);

  /* Swipe the whole deck through the real UI buttons, not by seeding state.
   * Pace above the 230ms exit animation — the swipe latch deliberately drops
   * anything faster, so a tighter loop would never reach the end of the deck. */
  await evaluate(ws, `(async () => {
    for (let i = 0; i < 60; i++) {
      if (document.body.textContent.includes('Your style')) break;
      const btn = document.querySelector('[data-vote="like"]') || document.querySelector('[data-vote]');
      if (!btn) break;
      btn.click();
      await new Promise(r => setTimeout(r, 300));
    }
  })()`, 60000);
  await sleep(1200);
  check('reveal screen reached after swiping the deck',
    (await evaluate(ws, `document.body.textContent`)).includes('Your style'));
  check('a style label was produced',
    (await evaluate(ws, `VEIL_ENGINE.buildProfile(
      JSON.parse(localStorage.getItem('veil.state.v1')).swipes,
      (() => { const i = {}; VEIL_DATA.PHOTOGRAPHERS.forEach(p => p.photos.forEach(x => i[x.id] = x)); return i; })()
    ).label`)) !== 'Still Deciding');

  await evaluate(ws, `window.veilGo('matches')`);
  await sleep(500);
  check('match card rendered', await evaluate(ws, `!!document.querySelector('.matchcard')`) === true);
  const pct = await evaluate(ws, `document.querySelector('.mc-ring span').textContent`);
  check('match percentage shown', /\d/.test(pct), pct);

  /* The decision path a real user takes: judge the work before committing.
   * This is the flow that was broken - one photo behind an invisible tap
   * target, and the only way to see more was leaving the queue. */
  console.log('\nJudging her work before deciding');
  const thumbs = await evaluate(ws,
    `document.querySelectorAll('#deck .matchcard:last-child .mc-thumb').length`);
  check('every photo of the shoot is visible on the card', thumbs === 5, thumbs + ' thumbnails');

  await evaluate(ws, `document.querySelectorAll('#deck .matchcard:last-child .mc-thumb')[3].click()`);
  await sleep(500);
  check('tapping a thumbnail swaps the main photo',
    await evaluate(ws, `!!document.querySelector('#deck .matchcard:last-child .mc-thumb:nth-child(4).on')`) === true);

  check('no price or budget pill competes with the photo',
    await evaluate(ws, `(() => {
      const c = document.querySelector('#deck .matchcard:last-child .mc-body');
      return !/all in|in budget|No travel/i.test(c.textContent);
    })()`) === true);

  await evaluate(ws, `document.querySelector('#deck .matchcard:last-child .mc-opener').click()`);
  await sleep(1200);
  const cells = await evaluate(ws, `document.querySelectorAll('.work-cell').length`);
  check('her whole body of work is one tap away', cells === 15, cells + ' photos');
  check('all three shoot types are shown together',
    await evaluate(ws, `['Engagements','Bridals','Wedding day']
      .every(t => document.body.textContent.includes(t))`) === true);
  check('she can be decided on without leaving for the profile',
    await evaluate(ws, `!!document.querySelector('[data-decide="like"]')`) === true);

  await evaluate(ws, `document.querySelector('[data-decide="pass"]').click()`);
  await sleep(900);
  check('deciding returns to the queue with the next photographer up',
    await evaluate(ws, `!!document.querySelector('#deck .matchcard')`) === true);

  // Shortlist three via the real swipe buttons.
  for (let i = 0; i < 3; i++) {
    await evaluate(ws, `document.querySelector('[data-vote="like"]').click()`);
    await sleep(450);
  }
  await evaluate(ws, `window.veilGo('shortlist')`);
  await sleep(400);
  const slCount = await evaluate(ws, `document.querySelectorAll('.slrow').length`);
  check('three photographers shortlisted', slCount === 3, slCount + ' rows');

  await evaluate(ws, `document.querySelectorAll('[data-sel]').forEach((b, i) => { if (i < 3) b.click(); })`);
  await sleep(500);
  await evaluate(ws, `document.querySelector('[data-compare]').click()`);
  await sleep(600);
  const cols = await evaluate(ws, `document.querySelectorAll('.cmp-head').length`);
  check('compare shows three columns', cols === 3, cols + ' columns');

  await evaluate(ws, `document.querySelector('[data-pick]').click()`);
  await sleep(600);
  const draft = await evaluate(ws, `document.querySelector('#composer') && document.querySelector('#composer').value`);
  check('message draft pre-filled', !!draft && draft.length > 80, (draft || '').slice(0, 60) + '…');

  console.log('\nRegression: rapid tapping must not double-commit a swipe');
  await evaluate(ws, `localStorage.clear()`);
  await load(BASE + '/');
  await evaluate(ws, `document.querySelector('[data-go="setup"]').click()`);
  await sleep(250);
  await evaluate(ws, `document.querySelector('[data-skip-setup]').click()`);
  await sleep(400);
  const deckSize = await evaluate(ws, `VEIL_DATA.buildTasteDeck(36).length`);
  // Hammer the button far faster than the 230ms exit animation.
  await evaluate(ws, `(async () => {
    for (let i = 0; i < 160; i++) {
      const b = document.querySelector('[data-vote="like"]');
      if (b) b.click();
      await new Promise(r => setTimeout(r, 15));
    }
  })()`);
  await sleep(900);
  const swipeCount = await evaluate(ws,
    `JSON.parse(localStorage.getItem('veil.state.v1')).swipes.length`);
  check('swipe count never exceeds the deck', swipeCount <= deckSize,
    swipeCount + ' swipes recorded for a ' + deckSize + '-card deck');
  const dupes = await evaluate(ws, `(() => {
    const v = JSON.parse(localStorage.getItem('veil.state.v1')).swipes.map(x => x.photoId);
    return v.length - new Set(v).size;
  })()`);
  check('no photo was voted on twice', dupes === 0, dupes + ' duplicate votes');


  console.log('\nConsole');
  const real = [...new Set(errors)].filter(e => !/favicon/i.test(e));
  check('no page errors', real.length === 0, real.join(' | ') || 'clean');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'Live site works end to end.'));
  process.exitCode = fails ? 1 : 0;
  ws.close();
}

main().catch(e => { console.error(e); process.exitCode = 1; });
