/* Veil — mock data layer.
 * Everything here is fictional. Photographers, prices and booked dates are
 * invented but sized to the real Utah 2026 market range (see README).
 * Photo imagery is placeholder — swap PHOTO_SRC for real portfolios.
 */

/* ---------------------------------------------------------------- style axes
 * Every photo and every photographer is a point in this 6-axis space.
 * A bride's taste profile is also a point here, derived from blind swipes.
 */
const AXES = [
  { key: 'warmth', low: 'Cool',     high: 'Warm',      lowShort: 'cool',     highShort: 'warm' },
  { key: 'light',  low: 'Moody',    high: 'Airy',      lowShort: 'moody',    highShort: 'airy' },
  { key: 'grain',  low: 'Crisp',    high: 'Film',      lowShort: 'crisp',    highShort: 'film' },
  { key: 'pose',   low: 'Candid',   high: 'Editorial', lowShort: 'candid',   highShort: 'editorial' },
  { key: 'scale',  low: 'Intimate', high: 'Epic',      lowShort: 'intimate', highShort: 'epic' },
  { key: 'color',  low: 'Muted',    high: 'Rich',      lowShort: 'muted',    highShort: 'rich' },
];
const AXIS_KEYS = AXES.map(a => a.key);

/* Imagery.
 *
 * Placeholder photographs come from a seeded stock service, which proves out
 * layout and loading but is obviously not wedding work. To preview with real
 * portfolios, drop files at photos/<photographerId>/<shoot>-<0..4>.jpg and
 * flip USE_LOCAL_PHOTOS — nothing else changes.
 */
const USE_LOCAL_PHOTOS = false;
const PHOTO_SRC = (seed, w, h) => 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h;

function photoURL(photo, w, h) {
  if (!photo) return '';
  if (USE_LOCAL_PHOTOS) return 'photos/' + photo.photographerId + '/' + photo.shoot + '-' + photo.idx + '.jpg';
  if (photo.unsplashId) {
    return 'https://images.unsplash.com/' + photo.unsplashId +
      '?w=' + w + '&h=' + h + '&fit=crop&crop=entropy&q=80&auto=format';
  }
  return PHOTO_SRC(photo.seed, w, h);
}

/* ------------------------------------------------------------ Utah locations */
const VENUES = [
  { id: 'temple-square',   name: 'Temple Square',        city: 'Salt Lake City', coords: [40.7704, -111.8921], kind: 'ceremony' },
  { id: 'provo-temple',    name: 'Provo City Center',    city: 'Provo',          coords: [40.2340, -111.6560], kind: 'ceremony' },
  { id: 'payson-temple',   name: 'Payson Temple',        city: 'Payson',         coords: [40.0290, -111.7420], kind: 'ceremony' },
  { id: 'draper-temple',   name: 'Draper Temple',        city: 'Draper',         coords: [40.4860, -111.8580], kind: 'ceremony' },
  { id: 'bridal-veil',     name: 'Bridal Veil Falls',    city: 'Provo Canyon',   coords: [40.3520, -111.5990], kind: 'photos' },
  { id: 'sundance',        name: 'Sundance Resort',      city: 'Sundance',       coords: [40.3930, -111.5880], kind: 'photos' },
  { id: 'albion-basin',    name: 'Albion Basin',         city: 'Alta',           coords: [40.5780, -111.6220], kind: 'photos' },
  { id: 'antelope-island', name: 'Antelope Island',      city: 'Syracuse',       coords: [41.0400, -112.2400], kind: 'photos' },
  { id: 'salt-flats',      name: 'Bonneville Salt Flats',city: 'Wendover',       coords: [40.7580, -113.8530], kind: 'photos' },
  { id: 'snow-canyon',     name: 'Snow Canyon',          city: 'St. George',     coords: [37.2070, -113.6400], kind: 'photos' },
  { id: 'memory-grove',    name: 'Memory Grove',         city: 'Salt Lake City', coords: [40.7760, -111.8860], kind: 'photos' },
  { id: 'red-butte',       name: 'Red Butte Garden',     city: 'Salt Lake City', coords: [40.7660, -111.8250], kind: 'photos' },
  { id: 'thanksgiving',    name: 'Thanksgiving Point',   city: 'Lehi',           coords: [40.4290, -111.9020], kind: 'reception' },
  { id: 'wadley-farms',    name: 'Wadley Farms',         city: 'Lindon',         coords: [40.3400, -111.7100], kind: 'reception' },
  { id: 'le-jardin',       name: 'Le Jardin',            city: 'Sandy',          coords: [40.5750, -111.8600], kind: 'reception' },
  { id: 'gardner-village', name: 'The Gathering Place',  city: 'West Jordan',    coords: [40.6680, -111.9240], kind: 'reception' },
  { id: 'millcreek-inn',   name: 'Millcreek Inn',        city: 'Salt Lake City', coords: [40.6900, -111.7500], kind: 'reception' },
  { id: 'louland-falls',   name: 'Louland Falls',        city: 'Park City',      coords: [40.6300, -111.7000], kind: 'reception' },
  { id: 'oak-hills',       name: 'Oak Hills Reception',  city: 'Provo',          coords: [40.2500, -111.6400], kind: 'reception' },
  { id: 'sleepy-ridge',    name: 'Sleepy Ridge',         city: 'Orem',           coords: [40.3100, -111.7400], kind: 'reception' },
];

const SHOOTS = [
  { key: 'engagements', label: 'Engagements', short: 'Eng',    blurb: 'The announcement photos' },
  { key: 'bridals',     label: 'Bridals',     short: 'Bridal', blurb: 'Just you, in the dress' },
  { key: 'weddings',    label: 'Wedding day', short: 'Wedding',blurb: 'Ceremony + reception coverage' },
];

/* --------------------------------------------------------------- the roster */
const PHOTOGRAPHERS = [
  {
    id: 'hanna-reeve', name: 'Hanna Reeve', base: 'Provo', coords: [40.2338, -111.6585],
    tagline: 'Golden-hour film for people who hate posing.',
    style: { warmth: 0.75, light: 0.30, grain: 0.65, pose: -0.55, scale: 0.10, color: -0.15 },
    consistency: 0.88, years: 6, weddings: 140, instagram: '@hannareevephoto',
    prices: { engagements: 450, bridals: 450, weddings: 2400 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 780 },
      { items: ['engagements', 'bridals', 'weddings'], price: 2950 },
    ],
    travel: { freeMiles: 40, perMile: 0.65, overnightAfter: 150, overnightFee: 250 },
    booked: ['2027-06-12', '2027-06-19', '2027-09-04'],
    turnaround: '4-6 weeks', delivers: '600+ edited images, online gallery, print release',
    secondShooter: 'Included on wedding day',
    quote: 'I would rather catch you laughing at something dumb he said than get a perfect jawline.',
  },
  {
    id: 'sage-linford', name: 'Sage Linford', studio: 'Sage & Co.', base: 'Salt Lake City', coords: [40.7608, -111.8910],
    tagline: 'Bright, clean, magazine-tidy. Every hair in place.',
    style: { warmth: 0.15, light: 0.85, grain: -0.50, pose: 0.70, scale: -0.10, color: 0.20 },
    consistency: 0.94, years: 9, weddings: 310, instagram: '@sageandcophoto',
    prices: { engagements: 600, bridals: 650, weddings: 3800 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 1100 },
      { items: ['engagements', 'bridals', 'weddings'], price: 4600 },
    ],
    travel: { freeMiles: 30, perMile: 0.80, overnightAfter: 120, overnightFee: 350 },
    booked: ['2027-06-05', '2027-06-26', '2027-07-10', '2027-08-14'],
    turnaround: '3 weeks', delivers: '800+ images, two albums, styling guide',
    secondShooter: 'Included, plus an assistant',
    quote: 'You are going to hang these on a wall for fifty years. They should look deliberate.',
  },
  {
    id: 'marin-halliday', name: 'Marin Halliday', base: 'Park City', coords: [40.6461, -111.4980],
    tagline: 'Dark, editorial, a little bit dangerous.',
    style: { warmth: -0.30, light: -0.75, grain: 0.20, pose: 0.60, scale: 0.35, color: -0.40 },
    consistency: 0.90, years: 7, weddings: 95, instagram: '@marinhalliday',
    prices: { engagements: 700, bridals: 700, weddings: 4200 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 1250 },
      { items: ['engagements', 'bridals', 'weddings'], price: 5200 },
    ],
    travel: { freeMiles: 50, perMile: 0.75, overnightAfter: 140, overnightFee: 300 },
    booked: ['2027-06-12', '2027-07-17'],
    turnaround: '6-8 weeks', delivers: '500 images, hand-graded, fine-art print box',
    secondShooter: 'Add $450',
    quote: 'Shadows are not a problem to be fixed. They are the whole point.',
  },
  {
    id: 'tess-okafor', name: 'Tess Okafor', studio: 'Olive & Birch', base: 'Orem', coords: [40.2969, -111.6946],
    tagline: 'Warm, soft, and totally unbothered by a schedule.',
    style: { warmth: 0.60, light: 0.60, grain: 0.30, pose: -0.40, scale: -0.20, color: -0.10 },
    consistency: 0.82, years: 4, weddings: 70, instagram: '@oliveandbirchphoto',
    prices: { engagements: 350, bridals: 375, weddings: 1750 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 650 },
      { items: ['engagements', 'bridals', 'weddings'], price: 2200 },
    ],
    travel: { freeMiles: 35, perMile: 0.50, overnightAfter: 160, overnightFee: 175 },
    booked: ['2027-05-29'],
    turnaround: '3-4 weeks', delivers: '400+ images, online gallery',
    secondShooter: 'Add $250',
    quote: 'My couples usually tell me they forgot I was there. That is the review I want.',
  },
  {
    id: 'brynn-castellanos', name: 'Brynn Castellanos', studio: 'Juniper Lane', base: 'St. George', coords: [37.0965, -113.5684],
    tagline: 'Red rock, big sky, deep color.',
    style: { warmth: 0.80, light: 0.10, grain: -0.10, pose: 0.10, scale: 0.85, color: 0.70 },
    consistency: 0.86, years: 8, weddings: 190, instagram: '@juniperlaneco',
    prices: { engagements: 500, bridals: 525, weddings: 2900 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 900 },
      { items: ['engagements', 'bridals', 'weddings'], price: 3500 },
    ],
    travel: { freeMiles: 60, perMile: 0.70, overnightAfter: 120, overnightFee: 275 },
    booked: ['2027-06-19', '2027-10-09'],
    turnaround: '5 weeks', delivers: '700+ images, desert location scouting included',
    secondShooter: 'Included on wedding day',
    quote: 'Give me one hour in Snow Canyon and I will ruin every other photo you own.',
  },
  {
    id: 'clara-whitfield', name: 'Clara Whitfield', base: 'Logan', coords: [41.7370, -111.8338],
    tagline: 'Classic and timeless. No trends to regret in ten years.',
    style: { warmth: 0.20, light: 0.40, grain: -0.70, pose: 0.50, scale: -0.30, color: 0.10 },
    consistency: 0.96, years: 14, weddings: 520, instagram: '@clarawhitfieldphoto',
    prices: { engagements: 400, bridals: 400, weddings: 2100 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 700 },
      { items: ['engagements', 'bridals', 'weddings'], price: 2600 },
    ],
    travel: { freeMiles: 45, perMile: 0.55, overnightAfter: 170, overnightFee: 200 },
    booked: ['2027-06-05', '2027-06-12', '2027-08-21'],
    turnaround: '2-3 weeks', delivers: '650 images, heirloom album, parent albums available',
    secondShooter: 'Included on wedding day',
    quote: 'Trends age badly. Good light does not.',
  },
  {
    id: 'ember-rowe', name: 'Ember Rowe', base: 'Heber City', coords: [40.5070, -111.4133],
    tagline: 'Real film. Grainy, dim, honest.',
    style: { warmth: 0.35, light: -0.60, grain: 0.95, pose: -0.65, scale: -0.10, color: -0.60 },
    consistency: 0.91, years: 5, weddings: 60, instagram: '@emberroweshoots',
    prices: { engagements: 550, bridals: 575, weddings: 3100 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 1000 },
      { items: ['engagements', 'bridals', 'weddings'], price: 3800 },
    ],
    travel: { freeMiles: 40, perMile: 0.70, overnightAfter: 150, overnightFee: 250 },
    booked: ['2027-07-24'],
    turnaround: '8-10 weeks (lab scans)', delivers: '300 scans, every frame I shot, no culling',
    secondShooter: 'Add $400 (digital backup shooter)',
    quote: 'I shoot 120 film. It costs more and takes longer and it is worth both.',
  },
  {
    id: 'noelle-prather', name: 'Noelle Prather', base: 'Lehi', coords: [40.3916, -111.8508],
    tagline: 'Bright and bubbly. Your mom will love me.',
    style: { warmth: 0.30, light: 0.75, grain: -0.35, pose: -0.15, scale: -0.15, color: 0.45 },
    consistency: 0.84, years: 3, weddings: 45, instagram: '@noelleprather',
    prices: { engagements: 325, bridals: 350, weddings: 1600 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 600 },
      { items: ['engagements', 'bridals', 'weddings'], price: 1950 },
    ],
    travel: { freeMiles: 30, perMile: 0.45, overnightAfter: 180, overnightFee: 150 },
    booked: [],
    turnaround: '2 weeks', delivers: '500+ images, same-day sneak peeks',
    secondShooter: 'Add $200',
    quote: 'I am newer and cheaper and I will out-work anyone on this list.',
  },
  {
    id: 'wren-atwater', name: 'Wren Atwater', base: 'Salt Lake City', coords: [40.7608, -111.8910],
    tagline: 'Documentary. I do not direct, I follow.',
    style: { warmth: 0.10, light: 0.00, grain: 0.75, pose: -0.90, scale: 0.00, color: -0.70 },
    consistency: 0.93, years: 11, weddings: 240, instagram: '@wrenatwater',
    prices: { engagements: 500, bridals: 500, weddings: 2800 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 880 },
      { items: ['engagements', 'bridals', 'weddings'], price: 3400 },
    ],
    travel: { freeMiles: 35, perMile: 0.60, overnightAfter: 150, overnightFee: 225 },
    booked: ['2027-06-26', '2027-09-11'],
    turnaround: '5-6 weeks', delivers: '900 images, unculled documentary edit',
    secondShooter: 'Included on wedding day',
    quote: 'If you want a photo of you looking at the camera, hire someone else.',
  },
  {
    id: 'isla-mendoza', name: 'Isla Mendoza', base: 'Draper', coords: [40.5247, -111.8638],
    tagline: 'Saturated, styled, straight off a mood board.',
    style: { warmth: 0.25, light: 0.35, grain: -0.40, pose: 0.90, scale: 0.20, color: 0.90 },
    consistency: 0.89, years: 6, weddings: 120, instagram: '@islamendozaphoto',
    prices: { engagements: 650, bridals: 675, weddings: 3400 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 1150 },
      { items: ['engagements', 'bridals', 'weddings'], price: 4100 },
    ],
    travel: { freeMiles: 40, perMile: 0.75, overnightAfter: 130, overnightFee: 300 },
    booked: ['2027-06-12', '2027-07-31'],
    turnaround: '4 weeks', delivers: '600 images, full styling direction, mood board call',
    secondShooter: 'Included on wedding day',
    quote: 'Send me your Pinterest board. I will actually build it.',
  },
  {
    id: 'delaney-suh', name: 'Delaney Suh', studio: 'Fern & Field', base: 'Spanish Fork', coords: [40.1150, -111.6549],
    tagline: 'Soft, muted, quiet. Nothing shouts.',
    style: { warmth: 0.05, light: 0.55, grain: 0.45, pose: -0.20, scale: -0.35, color: -0.80 },
    consistency: 0.92, years: 5, weddings: 85, instagram: '@fernandfieldco',
    prices: { engagements: 425, bridals: 450, weddings: 2300 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 760 },
      { items: ['engagements', 'bridals', 'weddings'], price: 2850 },
    ],
    travel: { freeMiles: 40, perMile: 0.55, overnightAfter: 160, overnightFee: 200 },
    booked: ['2027-08-07'],
    turnaround: '4 weeks', delivers: '550 images, muted signature edit, gallery + USB',
    secondShooter: 'Add $300',
    quote: 'My whole edit is built so the photo never competes with the people in it.',
  },
  {
    id: 'rosalind-tate', name: 'Rosalind Tate', base: 'Ogden', coords: [41.2230, -111.9738],
    tagline: 'Warm, posed, and very good at wrangling families.',
    style: { warmth: 0.55, light: 0.45, grain: -0.20, pose: 0.65, scale: -0.25, color: 0.30 },
    consistency: 0.90, years: 16, weddings: 600, instagram: '@rosalindtatephoto',
    prices: { engagements: 475, bridals: 475, weddings: 2600 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 820 },
      { items: ['engagements', 'bridals', 'weddings'], price: 3150 },
    ],
    travel: { freeMiles: 50, perMile: 0.60, overnightAfter: 150, overnightFee: 225 },
    booked: ['2027-06-05', '2027-06-19', '2027-07-03', '2027-09-25'],
    turnaround: '3 weeks', delivers: '700 images, every family combination you asked for',
    secondShooter: 'Included on wedding day',
    quote: 'I have photographed 600 weddings. Nothing that happens at yours will surprise me.',
  },
  {
    id: 'thea-brightwell', name: 'Thea Brightwell', base: 'Provo', coords: [40.2338, -111.6585],
    tagline: 'Tiny people, enormous landscapes, last light.',
    style: { warmth: 0.90, light: 0.20, grain: 0.35, pose: -0.30, scale: 0.95, color: 0.25 },
    consistency: 0.87, years: 7, weddings: 110, instagram: '@theabrightwell',
    prices: { engagements: 525, bridals: 550, weddings: 2700 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 925 },
      { items: ['engagements', 'bridals', 'weddings'], price: 3250 },
    ],
    travel: { freeMiles: 75, perMile: 0.50, overnightAfter: 180, overnightFee: 200 },
    booked: ['2027-07-17'],
    turnaround: '5 weeks', delivers: '600 images, hike-in sessions at no extra charge',
    secondShooter: 'Add $350',
    quote: 'We are going to hike twenty minutes past where everyone else stops.',
  },
  {
    id: 'mira-vance', name: 'Mira Vance', studio: 'Cove Paper Co.', base: 'Cedar City', coords: [37.6775, -113.0619],
    tagline: 'High contrast, high drama, wide open.',
    style: { warmth: -0.10, light: -0.45, grain: 0.10, pose: 0.30, scale: 0.70, color: -0.30 },
    consistency: 0.85, years: 9, weddings: 160, instagram: '@covepaperco',
    prices: { engagements: 450, bridals: 475, weddings: 2500 },
    bundles: [
      { items: ['engagements', 'bridals'], price: 800 },
      { items: ['engagements', 'bridals', 'weddings'], price: 3000 },
    ],
    travel: { freeMiles: 70, perMile: 0.60, overnightAfter: 140, overnightFee: 250 },
    booked: ['2027-06-26'],
    turnaround: '5-6 weeks', delivers: '600 images, large-format print credit',
    secondShooter: 'Add $325',
    quote: 'Bad weather is good news. Call me when the forecast turns.',
  },
];

/* ------------------------------------------------- deterministic photo build
 * Each photographer's 15 photos (5 per shoot type) are jittered around their
 * house style. Higher `consistency` = less jitter. Seeds are stable, so the
 * same photo always resolves to the same image.
 */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp1 = v => Math.max(-1, Math.min(1, v));

function buildPhotos(p) {
  const out = [];
  const spread = (1 - p.consistency) * 1.6;
  SHOOTS.forEach(shoot => {
    for (let i = 0; i < 5; i++) {
      const key = p.id + '-' + shoot.key + '-' + i;
      const rnd = mulberry32(hashStr(key));
      const axes = {};
      AXIS_KEYS.forEach(k => { axes[k] = clamp1(p.style[k] + (rnd() - 0.5) * 2 * spread); });
      out.push({
        id: key,
        photographerId: p.id,
        shoot: shoot.key,
        idx: i,
        seed: 'veil' + (hashStr(key) % 100000),
        axes,
      });
    }
  });
  return out;
}

/* ------------------------------------------- real photography, when present
 * photos.js (generated by tools/fetch-photos.js) is a pool of real wedding
 * photographs whose warmth/light/grain/colour were measured from their own
 * pixels. Each photographer claims the 5 photos per shoot closest to her
 * house style, so her portfolio is genuinely coherent rather than random.
 *
 * Then — and this is the part that matters — her style vector is REPLACED by
 * the centroid of the photos she actually ended up with. Otherwise her
 * declared style and her real portfolio drift apart, and the match % would be
 * describing work she does not have.
 */
/* Distance from a photographer's house style to a photo, weighted by how
 * strongly she is defined by each axis.
 *
 * With equal weights, someone whose whole identity is one extreme — a film
 * shooter at grain 0.95 — ends up with photos that are close on average but
 * compromise on the only axis anyone would describe her by. Weighting an axis
 * by how far she sits from neutral on it makes her signature dominate her own
 * selection, while a generalist still matches on everything evenly. */
function photoDistance(style, axes) {
  let d = 0, w = 0;
  AXIS_KEYS.forEach(k => {
    const weight = 1 + 2 * Math.abs(style[k]);
    d += weight * Math.abs(style[k] - axes[k]);
    w += weight;
  });
  return d / w;
}

function assignRealPhotos(library) {
  /* Always match against the hand-authored style, never a centroid left over
   * from a previous call — otherwise re-running drifts the roster further
   * each time instead of landing in the same place. */
  PHOTOGRAPHERS.forEach(p => {
    p.style = p.declaredStyle || p.style;
    p.photos = [];
  });

  SHOOTS.forEach(shoot => {
    const pool = library.filter(ph => ph.shoot === shoot.key);
    if (!pool.length) return;
    const claimed = new Set();

    /* Most-extreme styles pick first.
     *
     * Rotating the pick order sounds fairer but is not: photos at the far end
     * of an axis are scarce (a corpus of real wedding work is mostly clean,
     * mid-bright, mid-warm), while middling photos are abundant. Letting a
     * generalist take a rare heavily-grained frame costs her nothing and
     * costs the film photographer her entire identity. Ordering by how far a
     * photographer sits from neutral gives the scarce frames to the only
     * people whose portfolio depends on them. */
    const order = PHOTOGRAPHERS
      .map((p, i) => ({
        i,
        extremity: Math.sqrt(AXIS_KEYS.reduce((a, k) => a + p.style[k] * p.style[k], 0)),
      }))
      .sort((a, b) => b.extremity - a.extremity)
      .map(x => x.i);

    for (let round = 0; round < 5; round++) {
      order.forEach(pi => {
        const p = PHOTOGRAPHERS[pi];
        let best = null, bestD = Infinity;
        for (let i = 0; i < pool.length; i++) {
          if (claimed.has(i)) continue;
          const d = photoDistance(p.style, pool[i].axes);
          if (d < bestD) { bestD = d; best = i; }
        }
        // Pool exhausted (fewer photos than photographers x 5) — reuse the
        // nearest rather than leaving a hole in her portfolio.
        if (best === null) {
          let fd = Infinity;
          pool.forEach((ph, i) => {
            const d = photoDistance(p.style, ph.axes);
            if (d < fd) { fd = d; best = i; }
          });
        } else {
          claimed.add(best);
        }

        const src = pool[best];
        p.photos.push({
          id: p.id + '-' + shoot.key + '-' + round,
          photographerId: p.id,
          shoot: shoot.key,
          idx: round,
          unsplashId: src.id,
          by: src.by,
          username: src.u,
          axes: src.axes,
        });
      });
    }
  });

  // Re-derive each house style from the work actually on the profile.
  PHOTOGRAPHERS.forEach(p => {
    if (!p.photos.length) return;
    const style = {};
    AXIS_KEYS.forEach(k => {
      style[k] = p.photos.reduce((a, ph) => a + ph.axes[k], 0) / p.photos.length;
      style[k] = Math.round(style[k] * 1000) / 1000;
    });
    p.declaredStyle = p.style;
    p.style = style;
  });
}

function loadPhotoLibrary() {
  if (typeof window !== 'undefined' && window.VEIL_PHOTO_LIBRARY) return window.VEIL_PHOTO_LIBRARY;
  if (typeof require !== 'undefined') {
    try { return require('./photos.js'); } catch (err) { return null; }
  }
  return null;
}

const PHOTO_LIBRARY = loadPhotoLibrary();
const USING_REAL_PHOTOS = !!(PHOTO_LIBRARY && PHOTO_LIBRARY.length >= PHOTOGRAPHERS.length * 5);

if (USING_REAL_PHOTOS) assignRealPhotos(PHOTO_LIBRARY);
else PHOTOGRAPHERS.forEach(p => { p.photos = buildPhotos(p); });

/* ------------------------------------------------------------- taste deck
 * Round-robin across photographers so no single style dominates the early
 * swipes and the reveal counts stay meaningful.
 */
function buildTasteDeck(size = 36) {
  const pools = PHOTOGRAPHERS.map(p => {
    const rnd = mulberry32(hashStr(p.id + '-deck'));
    return p.photos.map(ph => ({ ph, k: rnd() })).sort((a, b) => a.k - b.k).map(x => x.ph);
  });
  const deck = [];
  for (let round = 0; round < 15 && deck.length < size; round++) {
    const order = PHOTOGRAPHERS.map((_, i) => i)
      .map(i => ({ i, k: hashStr(round + '-' + i) }))
      .sort((a, b) => a.k - b.k)
      .map(x => x.i);
    for (const i of order) {
      if (deck.length >= size) break;
      if (pools[i][round]) deck.push(pools[i][round]);
    }
  }
  return deck;
}

/* ------------------------------------------------------------------ helpers */
function milesBetween(a, b) {
  const R = 3958.8, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const VEIL_DATA = {
  AXES, AXIS_KEYS, VENUES, SHOOTS, PHOTOGRAPHERS, PHOTO_SRC, photoURL, USE_LOCAL_PHOTOS,
  PHOTO_LIBRARY, USING_REAL_PHOTOS, assignRealPhotos, buildPhotos,
  buildTasteDeck, milesBetween, hashStr, mulberry32,
};
if (typeof window !== 'undefined') window.VEIL_DATA = VEIL_DATA;
if (typeof module !== 'undefined') module.exports = VEIL_DATA;
