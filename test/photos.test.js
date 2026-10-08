/* Checks the real-photo assignment. Run: node test/photos.test.js
 *
 * Runs against a synthetic library so it exercises the logic whether or not
 * photos.js has been generated yet. If a real library IS present, it is
 * checked too.
 */
const D = require('../data.js');
const E = require('../engine.js');

let failures = 0;
function check(label, pass, detail) {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  if (!pass) failures++;
}

/* A stand-in corpus spread across the full style space, sized like a real
 * fetch (~120 per shoot) so assignment has genuine choice. */
function syntheticLibrary(perShoot) {
  const rnd = D.mulberry32(99);
  const lib = [];
  D.SHOOTS.forEach(shoot => {
    for (let i = 0; i < perShoot; i++) {
      const axes = {};
      D.AXIS_KEYS.forEach(k => { axes[k] = Math.round((rnd() * 2 - 1) * 1000) / 1000; });
      lib.push({
        id: 'photo-' + shoot.key + '-' + i,
        shoot: shoot.key,
        by: 'Creator ' + (i % 37),
        u: 'creator' + (i % 37),
        axes,
      });
    }
  });
  return lib;
}

console.log('Assignment against a synthetic 360-photo library');
const lib = syntheticLibrary(120);
D.assignRealPhotos(lib);

check('every photographer has 15 photos',
  D.PHOTOGRAPHERS.every(p => p.photos.length === 15),
  D.PHOTOGRAPHERS.map(p => p.photos.length).join(','));

check('every photographer has 5 per shoot',
  D.PHOTOGRAPHERS.every(p =>
    D.SHOOTS.every(s => p.photos.filter(ph => ph.shoot === s.key).length === 5)));

/* The pool is bigger than demand, so nothing should need reusing. */
const used = D.PHOTOGRAPHERS.flatMap(p => p.photos.map(ph => ph.unsplashId));
check('no photo is used twice when the pool is large enough',
  used.length === new Set(used).size,
  used.length + ' slots, ' + new Set(used).size + ' distinct');

check('photos carry their credit through assignment',
  D.PHOTOGRAPHERS.every(p => p.photos.every(ph => ph.by && ph.username)));

check('photo shoot type always matches the slot it filled',
  D.PHOTOGRAPHERS.every(p => p.photos.every(ph =>
    lib.find(l => l.id === ph.unsplashId).shoot === ph.shoot)));

/* The thing that would silently break matching: a photographer's advertised
 * style drifting away from the portfolio she actually has. */
console.log('\nStyle vector matches the real portfolio');
let worstDrift = 0, worstWho = '';
D.PHOTOGRAPHERS.forEach(p => {
  D.AXIS_KEYS.forEach(k => {
    const centroid = p.photos.reduce((a, ph) => a + ph.axes[k], 0) / p.photos.length;
    const drift = Math.abs(centroid - p.style[k]);
    if (drift > worstDrift) { worstDrift = drift; worstWho = p.id + '.' + k; }
  });
});
check('style equals the centroid of her own photos', worstDrift < 0.002,
  'worst drift ' + worstDrift.toFixed(4) + ' (' + worstWho + ')');

/* Assignment must not collapse everyone onto the same aesthetic, or the
 * taste test has nothing left to distinguish. */
console.log('\nThe roster stays distinguishable');
const spreads = D.AXIS_KEYS.map(k => {
  const vals = D.PHOTOGRAPHERS.map(p => p.style[k]);
  return { k, range: Math.max(...vals) - Math.min(...vals) };
});
spreads.forEach(s =>
  check('roster spans the ' + s.k + ' axis', s.range > 0.25, 'range ' + s.range.toFixed(2)));

const photoIndex = {};
D.PHOTOGRAPHERS.forEach(p => p.photos.forEach(ph => { photoIndex[ph.id] = ph; }));
const deck = D.buildTasteDeck(36);
check('taste deck still builds from assigned photos', deck.length === 36);
check('deck draws from many photographers',
  new Set(deck.map(p => p.photographerId)).size >= 10,
  new Set(deck.map(p => p.photographerId)).size + ' photographers in deck');

/* A bride who likes one photographer's actual photos should match her. */
console.log('\nMatching still works end to end');
let selfMatchOk = 0;
D.PHOTOGRAPHERS.forEach(target => {
  const swipes = target.photos.map(ph => ({ photoId: ph.id, vote: 'love' }));
  const idx = {};
  target.photos.forEach(ph => { idx[ph.id] = ph; });
  const prof = E.buildProfile(swipes, idx);
  const ranked = D.PHOTOGRAPHERS
    .map(p => ({ id: p.id, m: E.styleMatch(prof, p.style) }))
    .sort((a, b) => b.m - a.m);
  if (ranked[0].id === target.id) selfMatchOk++;
});
check('loving a photographer\'s whole portfolio ranks her first',
  selfMatchOk >= D.PHOTOGRAPHERS.length - 1,
  selfMatchOk + '/' + D.PHOTOGRAPHERS.length);

/* Undersized pool: should degrade by reusing, never by leaving holes. */
console.log('\nUndersized pool degrades gracefully');
D.assignRealPhotos(syntheticLibrary(20));
check('still fills 15 slots each when the pool is too small',
  D.PHOTOGRAPHERS.every(p => p.photos.length === 15));
check('no slot is left without an image',
  D.PHOTOGRAPHERS.every(p => p.photos.every(ph => !!ph.unsplashId)));

/* Each photographer's written copy makes a claim about her work. If the
 * assignment stops backing that claim up, the roster reads as nonsense even
 * though every number still validates. */
console.log('\nWritten copy still matches the assigned portfolios');
if (!D.USING_REAL_PHOTOS) {
  console.log('  (skipped - no real photo library yet)');
} else {
  D.assignRealPhotos(D.PHOTO_LIBRARY);
  const CLAIMS = [
    ['ember-rowe',        'grain',  'high', 'Real film. Grainy, dim, honest.'],
    ['clara-whitfield',   'grain',  'low',  'No trends to regret in ten years.'],
    ['sage-linford',      'light',  'high', 'Bright, clean, magazine-tidy.'],
    ['marin-halliday',    'light',  'low',  'Dark, editorial, a little bit dangerous.'],
    ['wren-atwater',      'pose',   'low',  'I do not direct, I follow.'],
    ['rosalind-tate',     'pose',   'high', 'Warm, posed, good at wrangling families.'],
    ['isla-mendoza',      'color',  'high', 'Saturated, styled, off a mood board.'],
    ['delaney-suh',       'color',  'low',  'Soft, muted, quiet. Nothing shouts.'],
    ['thea-brightwell',   'scale',  'high', 'Tiny people, enormous landscapes.'],
    ['brynn-castellanos', 'warmth', 'high', 'Red rock, big sky, deep colour.'],
    ['hanna-reeve',       'warmth', 'high', 'Golden-hour film.'],
  ];

  CLAIMS.forEach(([id, axis, dir, copy]) => {
    const vals = D.PHOTOGRAPHERS.map(p => ({ id: p.id, v: p.style[axis] }))
      .sort((a, b) => dir === 'high' ? b.v - a.v : a.v - b.v);
    const pos = vals.findIndex(x => x.id === id) + 1;
    const mine = vals.find(x => x.id === id).v;
    const leader = vals[0].v;
    /* Top 3 outright, or close enough to the leader to be in the same
     * cluster - a real corpus does not separate cleanly on every axis. */
    const ok = pos <= 3 || Math.abs(leader - mine) <= 0.12;
    check('"' + copy + '"', ok,
      id + ' is #' + pos + ' on ' + axis + ' (' + mine.toFixed(2) + ' vs leader ' + leader.toFixed(2) + ')');
  });
}

/* If a real library exists, sanity-check it as shipped. */
console.log('\nGenerated photos.js');
const real = D.PHOTO_LIBRARY || [];
if (!real.length) {
  console.log('  (none yet — run tools/fetch-photos.js with an Unsplash key)');
} else {
  const perShoot = {};
  real.forEach(p => { perShoot[p.shoot] = (perShoot[p.shoot] || 0) + 1; });
  console.log('  ' + real.length + ' photos: ' + JSON.stringify(perShoot));
  check('enough photos per shoot for the whole roster',
    D.SHOOTS.every(s => (perShoot[s.key] || 0) >= D.PHOTOGRAPHERS.length * 5),
    JSON.stringify(perShoot));
  check('every photo has a credit',
    real.every(p => p.by), 'missing on ' + real.filter(p => !p.by).length);
  check('every photo has all six axes',
    real.every(p => D.AXIS_KEYS.every(k => typeof p.axes[k] === 'number')));
  check('measured axes actually span the range',
    ['warmth', 'light', 'grain', 'color'].every(k => {
      const v = real.map(p => p.axes[k]);
      return Math.max(...v) - Math.min(...v) > 1.5;
    }));
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'All checks passed.'));
process.exitCode = failures ? 1 : 0;
