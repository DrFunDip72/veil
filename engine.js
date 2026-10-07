/* Veil — matching engine.
 *
 * Deliberate design choice: the headline match % is style ONLY. Budget,
 * travel and availability are shown as separate badges and used for
 * filtering, never blended into the percentage. A bride needs to know
 * "does her work look like what I want" without price contaminating it.
 */
(function (root, factory) {
  const data = typeof require !== 'undefined' && typeof window === 'undefined'
    ? require('./data.js') : root.VEIL_DATA;
  const api = factory(data);
  if (typeof window !== 'undefined') window.VEIL_ENGINE = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (D) {
  const { AXES, AXIS_KEYS, SHOOTS, PHOTOGRAPHERS, milesBetween } = D;

  const VOTE_WEIGHT = { love: 2, like: 1, pass: -1 };

  /* ------------------------------------------------------------- the profile
   * swipes: [{ photoId, vote }] where vote is love | like | pass.
   * Each axis ends up in -1..1. A passed photo pushes the profile AWAY from
   * its values, which is why disliking is as informative as liking.
   */
  function buildProfile(swipes, photoIndex) {
    const num = {}, den = {};
    AXIS_KEYS.forEach(k => { num[k] = 0; den[k] = 0; });
    const likedBy = {}, passedBy = {};

    swipes.forEach(s => {
      const photo = photoIndex[s.photoId];
      if (!photo) return;
      const w = VOTE_WEIGHT[s.vote];
      if (w === undefined) return;
      AXIS_KEYS.forEach(k => { num[k] += w * photo.axes[k]; den[k] += Math.abs(w); });
      const bucket = w > 0 ? likedBy : passedBy;
      bucket[photo.photographerId] = (bucket[photo.photographerId] || 0) + 1;
    });

    const axes = {};
    AXIS_KEYS.forEach(k => { axes[k] = den[k] ? num[k] / den[k] : 0; });

    /* Averaging +1/-1 votes regresses hard toward zero, so a raw profile sits
     * near the middle of every axis. Matching on that rewards blandness: the
     * most average photographer in the roster wins every time, and the
     * distinctive ones she actually liked rank below her. So match on the
     * SHAPE of the taste (rescaled so her strongest opinion hits full scale)
     * and keep the raw magnitude only for honest confidence reporting. */
    const peak = Math.max(...AXIS_KEYS.map(k => Math.abs(axes[k])));
    const shape = {};
    AXIS_KEYS.forEach(k => { shape[k] = peak >= 0.08 ? axes[k] / peak : 0; });

    const confidence = AXIS_KEYS.reduce((a, k) => a + Math.abs(axes[k]), 0) / AXIS_KEYS.length;

    return {
      axes, shape, likedBy, passedBy, confidence,
      swipeCount: swipes.length,
      label: styleLabel(axes),
      /* Told to her plainly rather than hidden: a thin or scattered signal
       * makes the ranking noisy, and she should know to keep swiping. */
      needsMoreSwipes: swipes.length < 15 || confidence < 0.18,
    };
  }

  /* Dominant axes, strongest first, turned into a human name. */
  function dominantAxes(axes, threshold = 0.18) {
    return AXES
      .map(a => ({ axis: a, value: axes[a.key], strength: Math.abs(axes[a.key]) }))
      .filter(x => x.strength >= threshold)
      .sort((a, b) => b.strength - a.strength);
  }

  function styleLabel(axes) {
    const top = dominantAxes(axes).slice(0, 3);
    if (!top.length) return 'Still Deciding';
    const words = top.map(x => (x.value > 0 ? x.axis.highShort : x.axis.lowShort));
    return words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }

  /* ---------------------------------------------------------- style match %
   * Weighted L1 distance. The weight on each axis is how strongly the bride
   * felt about it, so an axis she had no opinion on cannot penalise anyone.
   */
  /* Axes she felt strongly about dominate, but never to the point where an
   * axis she was lukewarm on becomes free: without this floor a warm-toned
   * photographer can win a cool-toned bride purely because warmth happened
   * not to be one of her top axes. */
  const WEIGHT_FLOOR = 0.25;

  function styleMatch(profile, photographerStyle) {
    const taste = profile.shape || profile.axes;
    /* No signal at all (nothing swiped) — everyone is a coin flip, and the
     * weight floor below would otherwise invent a ranking out of nothing. */
    if (AXIS_KEYS.every(k => taste[k] === 0)) return 50;
    let dist = 0, maxDist = 0;
    AXIS_KEYS.forEach(k => {
      const w = Math.max(Math.abs(taste[k]), WEIGHT_FLOOR);
      dist += w * Math.abs(taste[k] - photographerStyle[k]);
      maxDist += w * 2;
    });
    if (maxDist === 0) return 50;
    return Math.round(100 * (1 - dist / maxDist));
  }

  /* --------------------------------------------------------------- pricing */
  function priceFor(p, shoots) {
    const wanted = shoots.filter(s => p.prices[s] !== undefined);
    if (!wanted.length) return { total: 0, label: 'Nothing selected', alaCarte: 0, saved: 0, lines: [] };

    const alaCarte = wanted.reduce((a, s) => a + p.prices[s], 0);
    let best = { total: alaCarte, label: 'A la carte', bundle: null };

    (p.bundles || []).forEach(b => {
      const covers = wanted.every(s => b.items.includes(s));
      if (!covers) return;
      const extras = b.items.filter(s => !wanted.includes(s));
      if (b.price < best.total) {
        best = {
          total: b.price,
          label: bundleName(b.items),
          bundle: b,
          extras,
        };
      }
    });

    return {
      total: best.total,
      label: best.label,
      bundle: best.bundle,
      extras: best.extras || [],
      alaCarte,
      saved: Math.max(0, alaCarte - best.total),
      lines: wanted.map(s => ({ shoot: s, price: p.prices[s] })),
    };
  }

  function bundleName(items) {
    if (items.length === 3) return 'Full bundle';
    return items.map(i => SHOOTS.find(s => s.key === i).short).join(' + ') + ' bundle';
  }

  /* ---------------------------------------------------------------- travel */
  function travelFor(p, venues) {
    const list = (venues || []).filter(v => v && v.coords);
    if (!list.length) return { fee: 0, maxMiles: 0, note: 'Add your venues to see travel cost', unknown: true };

    const legs = list.map(v => ({ venue: v, miles: milesBetween(p.coords, v.coords) }));
    const maxMiles = Math.max(...legs.map(l => l.miles));
    const t = p.travel;
    let fee = 0;
    const reasons = [];

    if (maxMiles > t.freeMiles) {
      fee += Math.round(((maxMiles - t.freeMiles) * t.perMile) / 5) * 5;
      reasons.push(Math.round(maxMiles - t.freeMiles) + ' mi past her free radius');
    }
    if (maxMiles > t.overnightAfter) {
      fee += t.overnightFee;
      reasons.push('overnight stay required');
    }

    return {
      fee,
      maxMiles: Math.round(maxMiles),
      farthest: legs.sort((a, b) => b.miles - a.miles)[0].venue,
      freeMiles: t.freeMiles,
      note: fee === 0
        ? 'Travels to all your locations free'
        : '$' + fee + ' travel: ' + reasons.join(', '),
    };
  }

  /* ---------------------------------------------------------- availability */
  function availabilityFor(p, isoDate) {
    if (!isoDate) return { state: 'unknown', note: 'Set your date to check' };
    if ((p.booked || []).includes(isoDate)) return { state: 'booked', note: 'Already booked that day' };
    return { state: 'open', note: 'Open on your date' };
  }

  /* --------------------------------------------------------------- ranking */
  function rankMatches(profile, prefs) {
    const shoots = prefs.shoots && prefs.shoots.length ? prefs.shoots : SHOOTS.map(s => s.key);
    const venues = prefs.venues || [];
    const budgetMax = prefs.budgetMax;

    const rows = PHOTOGRAPHERS.map(p => {
      const price = priceFor(p, shoots);
      const travel = travelFor(p, venues);
      const avail = availabilityFor(p, prefs.date);
      const allIn = price.total + travel.fee;
      const match = styleMatch(profile, p.style);

      return {
        photographer: p, match, price, travel, avail, allIn,
        overBudget: budgetMax ? Math.max(0, allIn - budgetMax) : 0,
        blindLikes: profile.likedBy[p.id] || 0,
        blindPasses: profile.passedBy[p.id] || 0,
      };
    });

    /* Style match is the sort key. Hard blockers (booked, way over budget)
     * drop to the bottom but stay visible — a 97% match who is $200 over is
     * still worth seeing, and hiding her is how you lose the right answer. */
    return rows.sort((a, b) => {
      const blockA = (a.avail.state === 'booked' ? 1 : 0) + (a.overBudget > 0 ? 1 : 0);
      const blockB = (b.avail.state === 'booked' ? 1 : 0) + (b.overBudget > 0 ? 1 : 0);
      if (blockA !== blockB) return blockA - blockB;
      return b.match - a.match;
    });
  }

  /* --------------------------------------------- per-photo CSS style grading
   * Placeholder images all look alike, so each photo is colour-graded from
   * its own axis values. Keeps the three style families visually distinct.
   */
  function photoFilter(axes) {
    const warm = axes.warmth, light = axes.light, color = axes.color, grain = axes.grain;
    const sepia = Math.max(0, warm) * 0.3;
    const hue = -warm * 10 + (warm < 0 ? -8 : 0);
    const bright = 1 + light * 0.16;
    const contrast = 1 - light * 0.12 + Math.max(0, -light) * 0.14;
    const sat = 1 + color * 0.35 - Math.max(0, grain) * 0.1;
    return [
      'sepia(' + sepia.toFixed(2) + ')',
      'hue-rotate(' + hue.toFixed(1) + 'deg)',
      'brightness(' + bright.toFixed(2) + ')',
      'contrast(' + contrast.toFixed(2) + ')',
      'saturate(' + Math.max(0, sat).toFixed(2) + ')',
    ].join(' ');
  }

  function grainOpacity(axes) {
    return Math.max(0, axes.grain) * 0.38;
  }

  return {
    buildProfile, styleLabel, dominantAxes, styleMatch,
    priceFor, bundleName, travelFor, availabilityFor, rankMatches,
    photoFilter, grainOpacity, VOTE_WEIGHT,
  };
});
