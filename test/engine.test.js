/* Sanity checks on the matching engine. Run: node test/engine.test.js */
const D = require('../data.js');
const E = require('../engine.js');

const deck = D.buildTasteDeck();
const photoIndex = {};
D.PHOTOGRAPHERS.forEach(p => p.photos.forEach(ph => { photoIndex[ph.id] = ph; }));

let failures = 0;
function check(label, pass, detail) {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  if (!pass) failures++;
}

/* A persona votes by how close a photo is to its own ideal axes. Votes are
 * assigned by RANK, not by absolute distance, so every persona produces the
 * same realistic mix (~20% love, ~25% like, ~55% pass) regardless of how
 * unusual its taste is. Absolute thresholds made niche personas pass almost
 * everything, which tested the thin-signal case rather than the matcher. */
function simulate(ideal) {
  const scored = deck.map(ph => {
    let dist = 0;
    D.AXIS_KEYS.forEach(k => { dist += Math.abs(ph.axes[k] - (ideal[k] || 0)); });
    return { ph, dist };
  }).sort((a, b) => a.dist - b.dist);

  const loveCut = Math.round(scored.length * 0.20);
  const likeCut = Math.round(scored.length * 0.45);
  return scored.map((x, i) => ({
    photoId: x.ph.id,
    vote: i < loveCut ? 'love' : i < likeCut ? 'like' : 'pass',
  }));
}

const personas = [
  {
    name: 'Warm film documentary bride (should land on Hanna Reeve / Ember Rowe / Wren Atwater)',
    ideal: { warmth: 0.75, light: 0.2, grain: 0.75, pose: -0.7, scale: 0.0, color: -0.4 },
    expectTop: ['hanna-reeve', 'ember-rowe', 'wren-atwater', 'tess-okafor'],
    expectNotTop: ['sage-linford', 'isla-mendoza'],
  },
  {
    name: 'Bright clean editorial bride (should land on Sage Linford / Clara Whitfield)',
    ideal: { warmth: 0.15, light: 0.8, grain: -0.6, pose: 0.7, scale: -0.1, color: 0.2 },
    expectTop: ['sage-linford', 'clara-whitfield', 'rosalind-tate', 'noelle-prather'],
    expectNotTop: ['ember-rowe', 'wren-atwater', 'marin-halliday'],
  },
  {
    name: 'Dark moody epic bride (should land on Marin Halliday / Mira Vance)',
    ideal: { warmth: -0.2, light: -0.7, grain: 0.1, pose: 0.4, scale: 0.6, color: -0.35 },
    expectTop: ['marin-halliday', 'mira-vance'],
    expectNotTop: ['noelle-prather', 'sage-linford'],
  },
];

const prefs = {
  date: '2027-06-12',
  shoots: ['engagements', 'bridals', 'weddings'],
  budgetMax: 3500,
  venues: [
    D.VENUES.find(v => v.id === 'provo-temple'),
    D.VENUES.find(v => v.id === 'bridal-veil'),
    D.VENUES.find(v => v.id === 'oak-hills'),
  ],
};

personas.forEach(persona => {
  console.log('\n' + persona.name);
  const swipes = simulate(persona.ideal);
  const profile = E.buildProfile(swipes, photoIndex);
  const ranked = E.rankMatches(profile, prefs);

  /* Two different orderings, deliberately tested apart:
   *  - styleOnly: pure aesthetic fit, what the match % means.
   *  - ranked:    what she sees, with booked/over-budget photographers sunk.
   * Conflating them hides real bugs in either one. */
  const styleOnly = D.PHOTOGRAPHERS
    .map(p => ({ id: p.id, match: E.styleMatch(profile, p.style) }))
    .sort((a, b) => b.match - a.match);
  const top3 = styleOnly.slice(0, 3).map(r => r.id);

  console.log('  profile label: ' + profile.label + '  (confidence ' + profile.confidence.toFixed(2) + ')');
  console.log('  votes: ' + ['love', 'like', 'pass'].map(v =>
    v + '=' + swipes.filter(s => s.vote === v).length).join(' '));
  console.log('  by style:  ' + styleOnly.slice(0, 4).map(r => r.id + ' ' + r.match + '%').join(', '));
  console.log('  as shown:  ' + ranked.slice(0, 4).map(r =>
    r.photographer.id + ' ' + r.match + '%' + (r.avail.state === 'booked' ? '(booked)' : '') +
    (r.overBudget ? '(+$' + r.overBudget + ')' : '')).join(', '));

  check('the best style match is in this persona\'s style family',
    persona.expectTop.includes(top3[0]), 'got ' + top3[0]);
  check('at least 2 of the top 3 style matches are in the family',
    top3.filter(id => persona.expectTop.includes(id)).length >= 2, top3.join(','));
  check('mismatched photographers are not in the top 3 style matches',
    !top3.some(id => persona.expectNotTop.includes(id)), top3.join(','));
  check('match scores span a useful range',
    styleOnly[0].match - styleOnly[styleOnly.length - 1].match > 15,
    styleOnly[0].match + '% down to ' + styleOnly[styleOnly.length - 1].match + '%');
  check('blind-like counts were recorded',
    Object.values(profile.likedBy).reduce((a, b) => a + b, 0) > 0,
    JSON.stringify(profile.likedBy));

  /* The list she scrolls must not open with someone she cannot book. */
  const firstBlocked = ranked.findIndex(r => r.avail.state === 'booked' || r.overBudget > 0);
  const lastOpen = ranked.reduce((acc, r, i) =>
    (r.avail.state !== 'booked' && r.overBudget === 0 ? i : acc), -1);
  check('bookable photographers all rank above blocked ones',
    firstBlocked === -1 || firstBlocked > lastOpen,
    'first blocked at ' + firstBlocked + ', last bookable at ' + lastOpen);
});

/* ----------------------------------------------------------- pricing checks */
console.log('\nPricing');
const hanna = D.PHOTOGRAPHERS.find(p => p.id === 'hanna-reeve');
const all3 = E.priceFor(hanna, ['engagements', 'bridals', 'weddings']);
check('full bundle beats a la carte', all3.total === 2950 && all3.saved === 350,
  'total $' + all3.total + ', saved $' + all3.saved + ', label ' + all3.label);

const two = E.priceFor(hanna, ['engagements', 'bridals']);
check('two-shoot bundle picked', two.total === 780 && two.label === 'Eng + Bridal bundle',
  'total $' + two.total + ' / ' + two.label);

const justWedding = E.priceFor(hanna, ['weddings']);
check('single shoot does not get upsold into a bundle', justWedding.total === 2400,
  'total $' + justWedding.total + ' / ' + justWedding.label);

/* ------------------------------------------------------------ travel checks */
console.log('\nTravel');
const nearby = E.travelFor(hanna, [D.VENUES.find(v => v.id === 'bridal-veil')]);
check('local venue is free for a Provo photographer', nearby.fee === 0,
  nearby.maxMiles + ' mi, $' + nearby.fee);

const faraway = E.travelFor(hanna, [D.VENUES.find(v => v.id === 'snow-canyon')]);
check('St. George charges travel + overnight from Provo',
  faraway.fee > 300, faraway.maxMiles + ' mi, $' + faraway.fee + ' — ' + faraway.note);

const stGeorgeLocal = E.travelFor(
  D.PHOTOGRAPHERS.find(p => p.id === 'brynn-castellanos'),
  [D.VENUES.find(v => v.id === 'snow-canyon')]);
check('St. George photographer shoots Snow Canyon free', stGeorgeLocal.fee === 0,
  stGeorgeLocal.maxMiles + ' mi, $' + stGeorgeLocal.fee);

/* ------------------------------------------------------ availability checks */
console.log('\nAvailability');
check('booked date is flagged',
  E.availabilityFor(hanna, '2027-06-12').state === 'booked');
check('free date is open',
  E.availabilityFor(hanna, '2027-06-13').state === 'open');
check('no date set is unknown, not open',
  E.availabilityFor(hanna, null).state === 'unknown');

/* --------------------------------------------------------- edge: no swipes */
console.log('\nEdge cases');
const empty = E.buildProfile([], photoIndex);
check('empty profile does not crash and is neutral',
  empty.label === 'Still Deciding' && E.styleMatch(empty, hanna.style) === 50);
const allPass = E.buildProfile(deck.map(p => ({ photoId: p.id, vote: 'pass' })), photoIndex);
check('all-pass profile still produces finite scores',
  Number.isFinite(E.styleMatch(allPass, hanna.style)),
  'match ' + E.styleMatch(allPass, hanna.style) + '%, label "' + allPass.label + '"');
check('unknown photo ids are ignored',
  E.buildProfile([{ photoId: 'nope', vote: 'like' }], photoIndex).swipeCount === 1);

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'All checks passed.'));
process.exit(failures ? 1 : 0);
