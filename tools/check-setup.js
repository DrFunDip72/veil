/* Verifies the two-step setup: real calendar, region picker, no dead ends.
 * Run: node tools/check-setup.js [baseUrl]
 */
const fs = require('fs');
const path = require('path');
const { connect, navigate, evaluate, send, sleep } = require('./cdp.js');

const BASE = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const OUT = path.join(__dirname, '..', 'screens');

let fails = 0;
const check = (label, pass, detail) => {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  if (!pass) fails++;
};

(async () => {
  const ws = await connect();
  const errors = [];
  ws.addEventListener('message', ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push(d.exception ? d.exception.description : d.text);
    }
  });

  const shot = async name => {
    const box = await evaluate(ws, `(() => {
      const d = document.querySelector('.device').getBoundingClientRect();
      return { x: d.x, y: d.y, width: d.width, height: d.height };
    })()`);
    const res = await send(ws, 'Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: {
        x: Math.round(box.x) - 2, y: Math.round(box.y) - 2,
        width: Math.round(box.width) + 4, height: Math.round(box.height) + 4, scale: 1,
      },
    });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'));
    console.log('  (shot ' + name + ')');
  };

  await navigate(ws, BASE, 10000);
  await evaluate(ws, `localStorage.clear()`);
  await navigate(ws, BASE, 10000);
  await sleep(700);
  await evaluate(ws, `document.querySelector('[data-go="setup"]').click()`);
  await sleep(600);

  console.log('Step one: the date');
  check('a real month grid, not a native date input',
    await evaluate(ws, `!!document.querySelector('.cal-grid') && !document.querySelector('input[type=date]')`) === true);
  const days = await evaluate(ws, `document.querySelectorAll('.cal-day').length`);
  check('the month is fully drawn', days >= 28 && days <= 31, days + ' day cells');
  check('past days are not selectable',
    await evaluate(ws, `[...document.querySelectorAll('.cal-day.off')].every(b => b.disabled)`) === true);
  check('cannot page back before this month',
    await evaluate(ws, `document.querySelector('.cal-nav[data-month="-1"]').disabled`) === true);
  check('continue is blocked until a day is chosen',
    await evaluate(ws, `document.querySelector('#setup-next').disabled`) === true);
  await shot('setup-1-calendar.png');

  await evaluate(ws, `document.querySelector('.cal-nav[data-month="1"]').click()`);
  await sleep(450);
  const title = await evaluate(ws, `document.querySelector('.cal-title').textContent`);
  check('next month advances the grid', !!title, title);

  await evaluate(ws, `(() => {
    const d = [...document.querySelectorAll('[data-day]')];
    d[Math.min(17, d.length - 1)].click();
  })()`);
  await sleep(600);
  const picked = await evaluate(ws, `JSON.parse(localStorage.getItem('veil.state.v1')).prefs.date`);
  check('picking a day stores it', /^\d{4}-\d{2}-\d{2}$/.test(picked || ''), picked);
  check('the chosen date is spelled out',
    await evaluate(ws, `!!document.querySelector('.cal-picked') &&
      !document.querySelector('.cal-picked--empty')`) === true);
  check('continue unlocks', await evaluate(ws, `!document.querySelector('#setup-next').disabled`) === true);
  await shot('setup-2-picked.png');

  console.log('\nStep two: the details');
  await evaluate(ws, `document.querySelector('#setup-next').click()`);
  await sleep(600);
  const regions = await evaluate(ws, `document.querySelectorAll('[data-region]').length`);
  check('one region picker replaces the venue list', regions === 6, regions + ' regions');
  check('no twenty-venue chip wall',
    await evaluate(ws, `document.querySelectorAll('[data-venue]').length`) === 0);
  check('budget slider is still here',
    await evaluate(ws, `!!document.querySelector('#f-budget')`) === true);
  check('the budget disclaimer is gone',
    await evaluate(ws, `!/never change|only flags who is over/i.test(document.body.textContent)`) === true);
  check('continue is blocked until a region is chosen',
    await evaluate(ws, `document.querySelector('#setup-next').disabled`) === true);

  await evaluate(ws, `document.querySelector('[data-region="utah-county"]').click()`);
  await sleep(500);
  check('choosing a region unlocks the finish',
    await evaluate(ws, `!document.querySelector('#setup-next').disabled`) === true);
  await shot('setup-3-details.png');

  console.log('\nSetup is two steps, not three');
  check('only two progress pips',
    await evaluate(ws, `document.querySelectorAll('.steps i').length`) === 2);
  await evaluate(ws, `document.querySelector('#setup-next').click()`);
  await sleep(800);
  check('finishing lands on the taste test',
    await evaluate(ws, `!!document.querySelector('#deck .swipecard')`) === true);

  console.log('\nTravel still computes from the region');
  const travel = await evaluate(ws, `(() => {
    const raw = JSON.parse(localStorage.getItem('veil.state.v1'));
    const region = VEIL_DATA.REGIONS.find(r => r.id === raw.prefs.regionId);
    const far = VEIL_DATA.PHOTOGRAPHERS.find(p => p.id === 'brynn-castellanos');
    const near = VEIL_DATA.PHOTOGRAPHERS.find(p => p.id === 'hanna-reeve');
    return {
      near: VEIL_ENGINE.travelFor(near, [region]).fee,
      far: VEIL_ENGINE.travelFor(far, [region]).fee,
    };
  })()`);
  check('a local photographer is free', travel.near === 0, '$' + travel.near);
  check('a St. George photographer charges to come north', travel.far > 100, '$' + travel.far);

  /* The region has to read naturally everywhere it surfaces, or swapping
   * venues for a region just moved the clunkiness somewhere less visible. */
  console.log('\nThe region reads naturally downstream');
  await evaluate(ws, `window.veilGo('me')`);
  await sleep(500);
  const meRows = await evaluate(ws,
    `[...document.querySelectorAll('.card .pr')].map(r => r.innerText.split(String.fromCharCode(10)).join(' = '))`);
  const areaRow = meRows.find(r => r.indexOf('Area') === 0) || '';
  check('the You tab names the area', areaRow.indexOf('Utah County') > -1, areaRow || meRows.join(' | '));

  const travelNote = await evaluate(ws, `(() => {
    const r = VEIL_ENGINE.travelFor(
      VEIL_DATA.PHOTOGRAPHERS.find(p => p.id === 'brynn-castellanos'),
      [VEIL_DATA.REGIONS.find(x => x.id === 'utah-county')]);
    return r.note;
  })()`);
  check('travel still explains itself', !!travelNote, travelNote);

  /* Matches needs a finished taste test to rank anything, so fill one in
   * rather than clicking 36 cards just to reach the downstream copy. */
  await evaluate(ws, `(() => {
    const deck = VEIL_DATA.buildTasteDeck(36);
    const raw = JSON.parse(localStorage.getItem('veil.state.v1'));
    raw.swipes = deck.map((ph, i) => ({ photoId: ph.id, vote: i % 3 === 0 ? 'love' : i % 3 === 1 ? 'like' : 'pass' }));
    raw.tasteDone = true;
    localStorage.setItem('veil.state.v1', JSON.stringify(raw));
  })()`);
  await navigate(ws, BASE, 10000);
  await sleep(800);

  await evaluate(ws, `window.veilGo('matches')`);
  await sleep(1400);
  await evaluate(ws, `document.querySelector('.mcard').click()`);
  await sleep(1100);
  await evaluate(ws, `document.querySelector('[data-decide="like"]').click()`);
  await sleep(900);
  await evaluate(ws, `window.veilGo('shortlist')`);
  await sleep(700);
  await evaluate(ws, `document.querySelector('.slrow .meta').click()`);
  await sleep(1000);
  await evaluate(ws, `document.querySelector('[data-message]').click()`);
  await sleep(900);
  const draft = await evaluate(ws, `document.querySelector('#composer') && document.querySelector('#composer').value`);
  check('the drafted enquiry names the area, not three venues',
    !!draft && draft.indexOf('in Utah County') > -1,
    (draft || '').split(String.fromCharCode(10)).filter(Boolean)[1] || '(no draft)');

  console.log('\nConsole');
  const real = [...new Set(errors)].filter(e => !/favicon/i.test(e));
  check('no page errors', real.length === 0, real.join(' | ') || 'clean');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'Setup works.'));
  process.exitCode = fails ? 1 : 0;
  ws.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
