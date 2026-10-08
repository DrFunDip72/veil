/* Veil — app shell, screens and interactions.
 * No framework by design: this matches the rest of the portfolio and keeps
 * the whole thing installable from a static host with no build step.
 */
(function () {
  'use strict';

  const D = window.VEIL_DATA;
  const E = window.VEIL_ENGINE;
  const KEY = 'veil.state.v1';

  /* ------------------------------------------------------------------ state */
  const DEFAULT_STATE = {
    onboarded: false,
    prefs: { date: '', regionId: '', shoots: ['engagements', 'bridals', 'weddings'], budgetMax: 3000 },
    swipes: [],          // [{ photoId, vote }]
    tasteDone: false,
    seen: {},            // photographerId -> 'shortlist' | 'pass'
    shortlist: [],       // photographerId[], newest first
    compareSel: [],
    threads: {},         // photographerId -> [{ from, text, at }]
  };

  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      return Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(raw));
    } catch (err) {
      return structuredClone(DEFAULT_STATE);
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (err) { /* private mode */ }
  }

  /* ----------------------------------------------------------- derived data */
  const photoIndex = {};
  D.PHOTOGRAPHERS.forEach(p => p.photos.forEach(ph => { photoIndex[ph.id] = ph; }));
  const DECK = D.buildTasteDeck(36);
  const byId = id => D.PHOTOGRAPHERS.find(p => p.id === id);

  function profile() { return E.buildProfile(S.swipes, photoIndex); }
  function prefsForEngine() {
    return {
      date: S.prefs.date,
      shoots: S.prefs.shoots,
      budgetMax: S.prefs.budgetMax,
      venues: weddingPlaces(),
    };
  }
  function ranked() { return E.rankMatches(profile(), prefsForEngine()); }

  /* The engine takes a list of places to compute travel against. That used to
   * be up to three hand-picked venues; it is now the one region she chose.
   * Anything saved under the old shape still resolves, so nobody's stored
   * setup breaks on upgrade. */
  function weddingPlaces() {
    const region = D.REGIONS.find(r => r.id === S.prefs.regionId);
    if (region) return [region];
    if (S.prefs.venueIds && S.prefs.venueIds.length) {
      return S.prefs.venueIds.map(id => D.VENUES.find(v => v.id === id)).filter(Boolean);
    }
    return [];
  }

  function regionName() {
    const places = weddingPlaces();
    if (!places.length) return 'Not set';
    return places.map(v => v.name).join(', ');
  }

  /* --------------------------------------------------------------- helpers */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Math.round(n).toLocaleString('en-US');

  function fmtDate(iso, long) {
    if (!iso) return 'No date set';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', long
      ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function displayName(p) { return p.studio || p.name; }

  function photoHTML(photo, w, h, cls) {
    if (!photo) return '<div class="photo"></div>';
    const grain = E.grainOpacity(photo.axes);
    return '<div class="photo ' + (cls || '') + '">' +
      '<img src="' + D.photoURL(photo, w, h) + '" alt="" loading="lazy" decoding="async" ' +
      'style="filter:' + E.photoFilter(photo.axes) + '">' +
      (grain > 0.02 ? '<div class="grainlayer" style="opacity:' + grain.toFixed(2) + '"></div>' : '') +
      '</div>';
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* --------------------------------------------------------------- routing */
  let route = { name: 'welcome', params: {} };
  const NAV_SCREENS = ['taste', 'matches', 'shortlist', 'messages', 'me'];

  function go(name, params) {
    route = { name, params: params || {} };
    render();
    const v = $('.view');
    if (v) v.scrollTop = 0;
  }
  window.veilGo = go; // handy in the console while prototyping

  /* ================================================================ screens */
  const screens = {};

  /* ---------------------------------------------------------------- welcome */
  screens.welcome = () => ({
    nav: false,
    html:
      '<div class="view-pad fade-in" style="padding-top:46px">' +
        '<div style="width:62px;height:62px;border-radius:17px;overflow:hidden;margin-bottom:24px">' +
          '<img src="icon.svg" alt="" style="width:100%;height:100%;display:block">' +
        '</div>' +
        '<h1 class="display">Find the photographer<br>who already shoots<br><em>your wedding.</em></h1>' +
        '<p class="lede">You will swipe through photos with no names, no prices and no follower counts attached. ' +
        'Thirty seconds later Veil tells you which Utah photographers actually shoot the way you like.</p>' +
        '<div style="margin-top:30px"><button class="btn" data-go="setup">Start swiping</button></div>' +
        '<div style="text-align:center;margin-top:10px">' +
          '<button class="linkbtn" data-go="pro">I\'m a photographer</button>' +
        '</div>' +
        '<div class="note" style="margin-top:34px"><b>Why blind?</b> Once you see a price or a follower count ' +
        'you stop judging the photos. Veil hides everything until your taste is on record.</div>' +
      '</div>',
  });

  /* ------------------------------------------------------------------ setup */
  let setupStep = 0;

  /* ------------------------------------------------------------- calendar
   * A real month grid rather than <input type="date">. The native control
   * renders as a different ugly box on every platform, which is the one
   * thing a wedding app cannot afford on its first screen.
   */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  let calView = null; // { y, m } — the month on screen

  const isoOf = (y, m, d) =>
    y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');

  function calendarHTML() {
    const today = new Date();
    const todayISO = isoOf(today.getFullYear(), today.getMonth(), today.getDate());

    if (!calView) {
      const sel = S.prefs.date ? S.prefs.date.split('-').map(Number) : null;
      calView = sel
        ? { y: sel[0], m: sel[1] - 1 }
        : { y: today.getFullYear(), m: today.getMonth() };
    }

    const { y, m } = calView;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    // Can she still go back a month, or is that entirely in the past?
    const atFloor = y < today.getFullYear() ||
      (y === today.getFullYear() && m <= today.getMonth());

    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span class="cal-pad"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = isoOf(y, m, d);
      const past = iso < todayISO;
      const cls = ['cal-day'];
      if (iso === S.prefs.date) cls.push('on');
      if (iso === todayISO) cls.push('today');
      if (past) cls.push('off');
      cells += '<button class="' + cls.join(' ') + '"' +
        (past ? ' disabled' : ' data-day="' + iso + '"') + '>' + d + '</button>';
    }

    return '<div class="cal">' +
      '<div class="cal-head">' +
        '<button class="cal-nav" data-month="-1"' + (atFloor ? ' disabled' : '') +
          ' aria-label="Previous month">&#8249;</button>' +
        '<span class="cal-title">' + MONTHS[m] + ' ' + y + '</span>' +
        '<button class="cal-nav" data-month="1" aria-label="Next month">&#8250;</button>' +
      '</div>' +
      '<div class="cal-dow">' +
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => '<span>' + d + '</span>').join('') +
      '</div>' +
      '<div class="cal-grid">' + cells + '</div>' +
    '</div>';
  }

  function wireCalendar(onPick) {
    $$('[data-month]').forEach(b => b.addEventListener('click', () => {
      const step = Number(b.dataset.month);
      let { y, m } = calView;
      m += step;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      calView = { y, m };
      render();
    }));

    $$('[data-day]').forEach(b => b.addEventListener('click', () => {
      S.prefs.date = b.dataset.day;
      save();
      render();
      if (onPick) onPick();
    }));
  }

  screens.setup = () => {
    const p = S.prefs;

    const regionChips = D.REGIONS.map(r =>
      '<button class="chip' + (p.regionId === r.id ? ' on' : '') + '" data-region="' + r.id + '">' +
        esc(r.name) + '<small>' + esc(r.hint) + '</small></button>').join('');

    const shootChips = D.SHOOTS.map(sh =>
      '<button class="chip chip--wide' + (p.shoots.includes(sh.key) ? ' on' : '') +
        '" data-shoot="' + sh.key + '">' +
        esc(sh.label) + '<small>' + esc(sh.blurb) + '</small></button>').join('');

    /* Two steps, not three. The date gets a screen of its own because it is
     * the only hard blocker — a booked photographer cannot be hired at any
     * price. Everything else is one gesture each, so it shares a screen. */
    const panes = [
      '<p class="eyebrow">Step one</p>' +
      '<h2 class="display" style="font-size:32px">When is the<br><em>wedding?</em></h2>' +
      calendarHTML() +
      (p.date
        ? '<p class="cal-picked">' + esc(fmtDate(p.date, true)) + '</p>'
        : '<p class="cal-picked cal-picked--empty">Pick a day to continue</p>'),

      '<p class="eyebrow">Step two</p>' +
      '<h2 class="display" style="font-size:32px">A couple of<br><em>details.</em></h2>' +

      '<label class="field-label">Where are you getting married?</label>' +
      '<div class="chips">' + regionChips + '</div>' +

      '<label class="field-label" style="margin-top:22px">What do you need shot?</label>' +
      '<div class="chips">' + shootChips + '</div>' +

      '<div class="field" style="margin-top:22px">' +
        '<label>Total photography budget &mdash; <b id="budget-label">' + money(p.budgetMax) + '</b></label>' +
        '<input type="range" id="f-budget" min="800" max="6000" step="100" value="' + p.budgetMax + '">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-faint)">' +
          '<span>$800</span><span>$6,000+</span></div>' +
      '</div>',
    ];

    const canNext = [
      () => !!p.date,
      () => !!p.regionId && p.shoots.length > 0,
    ];

    return {
      nav: false,
      topbar:
        '<button class="iconbtn" data-setup-back>&#8249;</button>' +
        '<div class="topbar-spacer"></div>' +
        '<button class="linkbtn" data-skip-setup>Skip</button>',
      html:
        '<div class="view-pad fade-in">' +
          '<div class="steps">' + [0, 1].map(i =>
            '<i class="' + (i <= setupStep ? 'on' : '') + '"></i>').join('') + '</div>' +
          panes[setupStep] +
          '<div style="margin-top:24px"><button class="btn" id="setup-next">' +
            (setupStep === 1 ? 'Start the taste test' : 'Continue') + '</button></div>' +
        '</div>',
      mount() {
        const next = $('#setup-next');
        const sync = () => { next.disabled = !canNext[setupStep](); };
        sync();

        wireCalendar();

        $$('[data-region]').forEach(b => b.addEventListener('click', () => {
          S.prefs.regionId = b.dataset.region;
          save(); render();
        }));

        $$('[data-shoot]').forEach(b => b.addEventListener('click', () => {
          const k = b.dataset.shoot;
          const i = S.prefs.shoots.indexOf(k);
          if (i >= 0) S.prefs.shoots.splice(i, 1); else S.prefs.shoots.push(k);
          b.classList.toggle('on');
          save(); sync();
        }));

        const budget = $('#f-budget');
        if (budget) budget.addEventListener('input', () => {
          S.prefs.budgetMax = Number(budget.value);
          $('#budget-label').textContent = money(S.prefs.budgetMax);
          save();
        });

        next.addEventListener('click', () => {
          if (setupStep < 1) { setupStep++; render(); }
          else { S.onboarded = true; save(); setupStep = 0; go('taste'); }
        });

        $('[data-setup-back]').addEventListener('click', () => {
          if (setupStep > 0) { setupStep--; render(); } else go('welcome');
        });

        $('[data-skip-setup]').addEventListener('click', () => {
          if (!S.prefs.date) {
            const d = new Date();
            d.setMonth(d.getMonth() + 9);
            S.prefs.date = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
          }
          if (!S.prefs.regionId) S.prefs.regionId = 'utah-county';
          S.onboarded = true; save(); setupStep = 0; go('taste');
        });
      },
    };
  };

  /* ------------------------------------------------- blind taste test swipe */
  screens.taste = () => {
    const i = S.swipes.length;
    const done = i >= DECK.length;
    if (done) return screens.reveal();

    const upcoming = DECK.slice(i, i + 3).reverse(); // last in array renders on top

    return {
      nav: true,
      locked: true,
      topbar:
        '<div><h1>Taste test</h1><div class="sub">No names. No prices. Just the photo.</div></div>' +
        '<div class="topbar-spacer"></div>' +
        (i > 0 ? '<button class="iconbtn" data-undo title="Undo last swipe">&#8630;</button>' : ''),
      html:
        '<div class="taste-head">' +
          '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-faint)">' +
            '<span>' + (i + 1) + ' of ' + DECK.length + '</span>' +
            '<span>' + S.swipes.filter(s => s.vote !== 'pass').length + ' saved to your taste</span>' +
          '</div>' +
          '<div class="progress"><i style="width:' + Math.round((i / DECK.length) * 100) + '%"></i></div>' +
        '</div>' +
        '<div class="deck" id="deck">' +
          upcoming.map((ph, idx) => {
            const depth = upcoming.length - 1 - idx; // 0 = top card
            return '<div class="swipecard" data-photo="' + ph.id + '" ' +
              'style="transform:scale(' + (1 - depth * 0.03) + ') translateY(' + (depth * -8) + 'px);' +
              'z-index:' + (10 - depth) + '">' +
              photoHTML(ph, 800, 1100) +
              '<div class="shade"></div>' +
              '<div class="stamp stamp--yes">My style</div>' +
              '<div class="stamp stamp--no">Not me</div>' +
              '<div class="stamp stamp--love">Obsessed</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="swipe-actions">' +
          '<button class="sa-no" data-vote="pass" aria-label="Not my style">&#10005;</button>' +
          '<button class="sa-love" data-vote="love" aria-label="Love it">&#9829;</button>' +
          '<button class="sa-yes" data-vote="like" aria-label="My style">&#10003;</button>' +
        '</div>' +
        '<div class="swipe-hint">Swipe &middot; or use &#8592; &#8594; &#8593;</div>',
      mount() {
        const top = $('#deck .swipecard:last-child');
        if (top) attachSwipe(top, vote);

        $$('[data-vote]').forEach(b => b.addEventListener('click', () => flyOut(vote, b.dataset.vote)));

        const undo = $('[data-undo]');
        if (undo) undo.addEventListener('click', () => { S.swipes.pop(); save(); render(); });

        keyHandler = ev => {
          if (ev.key === 'ArrowLeft') flyOut(vote, 'pass');
          else if (ev.key === 'ArrowRight') flyOut(vote, 'like');
          else if (ev.key === 'ArrowUp') flyOut(vote, 'love');
        };
      },
    };

    function vote(v) {
      const photo = DECK[S.swipes.length];
      if (!photo) return; // deck already exhausted
      S.swipes.push({ photoId: photo.id, vote: v });
      save();
      if (S.swipes.length >= DECK.length) { S.tasteDone = true; save(); go('reveal'); }
      else render();
    }
  };

  /* Only one swipe may be in flight at a time.
   *
   * Every commit path is deferred behind a ~230ms exit animation. Without a
   * latch, a second tap inside that window commits twice against the same
   * card: on the last card that runs off the end of the deck and throws, and
   * mid-deck it silently records a vote for a photo she never saw — which
   * quietly corrupts the taste profile with no visible symptom. Cleared on
   * every render, because a render means the next card is up. */
  let swipeBusy = false;

  function commitSwipe(commit, v, delay) {
    if (swipeBusy) return false;
    swipeBusy = true;
    setTimeout(() => commit(v), delay);
    return true;
  }

  /* Animate the top card off-screen, then commit the vote. */
  function flyOut(commit, v) {
    if (swipeBusy) return;
    const top = $('#deck .swipecard:last-child');
    if (!top) { commit(v); return; }
    const dir = v === 'pass' ? -1 : 1;
    top.style.transition = 'transform 0.26s ease-in, opacity 0.26s ease-in';
    top.style.transform = v === 'love'
      ? 'translateY(-700px) rotate(-6deg)'
      : 'translateX(' + dir * 520 + 'px) rotate(' + dir * 18 + 'deg)';
    top.style.opacity = '0';
    commitSwipe(commit, v, 230);
  }

  /* Pointer-drag swiping, shared by both decks. */
  function attachSwipe(card, commit) {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, moved = false;
    const yes = $('.stamp--yes', card), no = $('.stamp--no', card), love = $('.stamp--love', card);

    card.addEventListener('pointerdown', ev => {
      if (ev.target.closest('button')) return;
      dragging = true; moved = false;
      startX = ev.clientX; startY = ev.clientY;
      card.setPointerCapture(ev.pointerId);
      card.style.transition = 'none';
    });

    card.addEventListener('pointermove', ev => {
      if (!dragging) return;
      dx = ev.clientX - startX;
      dy = ev.clientY - startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + dx / 22 + 'deg)';
      const up = dy < -60 && Math.abs(dy) > Math.abs(dx);
      if (yes) yes.style.opacity = up ? 0 : Math.max(0, Math.min(1, dx / 90));
      if (no) no.style.opacity = up ? 0 : Math.max(0, Math.min(1, -dx / 90));
      if (love) love.style.opacity = up ? Math.max(0, Math.min(1, -dy / 110)) : 0;
    });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      card.style.transition = 'transform 0.26s cubic-bezier(.2,.8,.2,1), opacity 0.26s ease';

      const upSwipe = dy < -110 && Math.abs(dy) > Math.abs(dx);
      if (upSwipe && love) {
        card.style.transform = 'translateY(-700px) rotate(-6deg)';
        card.style.opacity = '0';
        commitSwipe(commit, 'love', 200);
        return;
      }
      if (Math.abs(dx) > 95) {
        const dir = dx > 0 ? 1 : -1;
        card.style.transform = 'translateX(' + dir * 560 + 'px) rotate(' + dir * 20 + 'deg)';
        card.style.opacity = '0';
        commitSwipe(commit, dir > 0 ? 'like' : 'pass', 200);
        return;
      }
      card.style.transform = '';
      if (yes) yes.style.opacity = 0;
      if (no) no.style.opacity = 0;
      if (love) love.style.opacity = 0;
      dx = 0; dy = 0;
    };

    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('click', ev => { if (moved) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  }

  /* ----------------------------------------------------------- style reveal */
  function axisBarsHTML(pr) {
    const dom = E.dominantAxes(pr.axes).slice(0, 4);
    if (!dom.length) return '';
    return '<div style="margin-top:12px">' + dom.map(x => {
      const pct = Math.min(100, Math.abs(x.value) * 100);
      const left = x.value < 0 ? 50 - pct / 2 : 50;
      const low = x.value < 0 ? '<b>' + esc(x.axis.low) + '</b>' : esc(x.axis.low);
      const high = x.value > 0 ? '<b>' + esc(x.axis.high) + '</b>' : esc(x.axis.high);
      return '<div class="axis">' +
        '<div class="axis-row"><span>' + low + '</span><span>' + high + '</span></div>' +
        '<div class="axis-track"><div class="axis-fill" style="left:' + left +
          '%;width:' + pct / 2 + '%"></div></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  screens.reveal = () => {
    const pr = profile();
    const dom = E.dominantAxes(pr.axes).slice(0, 4);
    const rank = ranked();

    const top = rank.slice(0, 3);

    return {
      /* Keep the nav here: this screen is also what the Taste tab shows once
       * the deck is finished, and hiding the bar would strand her on it. */
      nav: true,
      topbar:
        '<div><h1>Your matches</h1><div class="sub">From ' + S.swipes.length +
        ' blind swipes &middot; ' + esc(pr.label) + '</div></div>',
      html:
        '<div class="view-pad fade-in">' +
          '<p class="lede" style="margin-top:2px">' + esc(describeTaste(dom)) + '</p>' +

          /* Straight to the answer. The axis chart and the full style
           * breakdown moved to the You tab: at this moment the only thing
           * she wants is who she matched with and a way to open them. */
          '<h3 class="section-title">Your closest three</h3>' +
          top.map(r => matchCardHTML(r)).join('') +

          '<div style="margin-top:6px">' +
            '<button class="btn" data-go="matches">See all ' + rank.length + ' matches</button>' +
          '</div>' +
        '</div>',
      mount() { wireMatchCards(); },
    };
  };

  function describeTaste(dom) {
    if (!dom.length) return 'You have not swiped enough yet for a clear read.';
    const parts = dom.slice(0, 3).map(x => (x.value > 0 ? x.axis.high : x.axis.low).toLowerCase());
    return 'You kept choosing photos that were ' + parts.slice(0, -1).join(', ') +
      (parts.length > 1 ? ' and ' : '') + parts[parts.length - 1] + '.';
  }

  /* ---------------------------------------------------------- match swiping */
  const galleryState = {}; // photographerId -> { shoot, index }

  screens.matches = () => {
    if (!S.tasteDone && S.swipes.length < 8) {
      return emptyScreen('Matches', '✦', 'Take the taste test first',
        'Veil needs to see what you like before it can rank anyone. It takes about a minute.',
        'Start swiping', 'taste');
    }

    /* A ranked list, not a second swipe deck.
     *
     * The taste test already did the sorting — making her swipe through all
     * fourteen photographers afterwards re-does the work she just did, forces
     * it in a fixed order, and means she cannot jump back to the one she
     * liked two cards ago. Swiping belongs to the photos; matches are a list,
     * the same way a dating app swipes on people and then lists your matches.
     */
    const all = ranked();
    const hidden = all.filter(r => S.seen[r.photographer.id] === 'pass');
    const visible = all.filter(r => S.seen[r.photographer.id] !== 'pass');

    return {
      nav: true,
      topbar:
        '<div><h1>Your matches</h1><div class="sub">' + visible.length +
        ' photographers &middot; closest fit first</div></div>',
      html:
        '<div class="view-pad fade-in" style="padding-top:0">' +
          (visible.length
            ? visible.map(r => matchCardHTML(r)).join('')
            : '<div class="empty"><div class="mark">&#9633;</div>' +
              '<h3>You hid everyone</h3><p>Bring some back to keep looking.</p></div>') +

          (hidden.length
            ? '<div class="hidden-note">' + hidden.length + ' hidden &middot; ' +
              '<button class="linkbtn" data-unhide>bring them back</button></div>'
            : '') +
        '</div>',
      mount() {
        wireMatchCards();
        const un = $('[data-unhide]');
        if (un) un.addEventListener('click', () => {
          hidden.forEach(r => { delete S.seen[r.photographer.id]; });
          save(); render();
        });
      },
    };
  };

  /* One card, used by both the reveal screen and the matches list. */
  function matchCardHTML(r) {
    const p = r.photographer;
    const saved = S.shortlist.includes(p.id);
    const hero = p.photos.filter(ph => ph.shoot === (S.prefs.shoots[0] || 'engagements'))[0] || p.photos[0];

    return '<div class="mcard" data-work="' + p.id + '">' +
      '<div class="mcard-photo">' +
        photoHTML(hero, 760, 570) +
        '<span class="mcard-pct">' + r.match + '% match</span>' +
        '<button class="mcard-save' + (saved ? ' on' : '') + '" data-save="' + p.id + '" ' +
          'aria-label="' + (saved ? 'Saved' : 'Save') + '">' + (saved ? '&#9829;' : '&#9825;') + '</button>' +
      '</div>' +
      '<div class="mcard-body">' +
        '<h3 class="mcard-name">' + esc(displayName(p)) +
          '<small>' + esc(p.base.toUpperCase()) + '</small></h3>' +
        '<p class="mcard-tagline">' + esc(p.tagline) + '</p>' +
        (r.blindLikes >= 2
          ? '<p class="mc-blind">&#9829; You picked <b>' + r.blindLikes + '</b> of her photos blind</p>'
          : '') +
        blockersHTML(r) +
      '</div>' +
    '</div>';
  }

  function wireMatchCards() {
    $$('[data-save]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const id = b.dataset.save;
      const i = S.shortlist.indexOf(id);
      if (i >= 0) { S.shortlist.splice(i, 1); delete S.seen[id]; toast('Removed'); }
      else { S.shortlist.unshift(id); S.seen[id] = 'shortlist'; toast('Saved'); }
      save(); render();
    }));

    $$('.mcard[data-work]').forEach(c => c.addEventListener('click', () =>
      go('work', { id: c.dataset.work })));
  }

  /* The swipe card asks one question: do you like her work. Price, travel and
   * availability cannot be acted on until Saved and Compare, so showing
   * them here only competes with the photo — and re-contaminates the style
   * judgement the blind test exists to protect. Blockers still show, because
   * "she is booked that day" genuinely changes whether shortlisting her is
   * worth it. Reassurances ("in budget", "no travel fee") do not. */
  function blockersHTML(r) {
    const out = [];
    if (r.avail.state === 'booked') out.push('<span class="badge-pill warn">Booked your date</span>');
    if (r.overBudget > 0) out.push('<span class="badge-pill warn">' + money(r.overBudget) + ' over budget</span>');
    return out.length ? '<div class="badges">' + out.join('') + '</div>' : '';
  }

  function badgesHTML(r) {
    const out = [];
    out.push('<span class="badge-pill">' + money(r.allIn) + ' all in</span>');
    if (r.overBudget > 0) out.push('<span class="badge-pill warn">' + money(r.overBudget) + ' over budget</span>');
    else out.push('<span class="badge-pill good">In budget</span>');

    if (r.avail.state === 'booked') out.push('<span class="badge-pill warn">Booked your date</span>');
    else if (r.avail.state === 'open') out.push('<span class="badge-pill good">Free ' + fmtDate(S.prefs.date) + '</span>');

    if (r.travel.fee > 0) out.push('<span class="badge-pill flat">+' + money(r.travel.fee) + ' travel</span>');
    else if (!r.travel.unknown) out.push('<span class="badge-pill flat">No travel fee</span>');

    return '<div class="badges">' + out.join('') + '</div>';
  }

  /* ----------------------------------------------------------- lightbox
   * Full-screen single photo, overlaid rather than routed, so closing it
   * returns to the exact scroll position in her grid instead of rebuilding
   * the screen underneath.
   */
  function openLightbox(photos, start) {
    let i = start;
    const host = $('.screen');
    const box = document.createElement('div');
    box.className = 'lightbox';
    host.appendChild(box);

    const draw = () => {
      const ph = photos[i];
      box.innerHTML =
        '<button class="lb-close" aria-label="Close">&#10005;</button>' +
        '<div class="lb-stage">' + photoHTML(ph, 1000, 1250) + '</div>' +
        '<div class="lb-bar">' +
          '<button class="lb-nav" data-step="-1" aria-label="Previous">&#8249;</button>' +
          '<span class="lb-count">' + (i + 1) + ' / ' + photos.length + '</span>' +
          '<button class="lb-nav" data-step="1" aria-label="Next">&#8250;</button>' +
        '</div>' +
        (creditLine(ph) ? '<p class="lb-credit">' + creditLine(ph) + '</p>' : '');

      $('.lb-close', box).addEventListener('click', close);
      $$('.lb-nav', box).forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        i = (i + Number(b.dataset.step) + photos.length) % photos.length;
        draw();
      }));
    };

    const onKey = ev => {
      if (ev.key === 'Escape') close();
      else if (ev.key === 'ArrowLeft') { i = (i - 1 + photos.length) % photos.length; draw(); }
      else if (ev.key === 'ArrowRight') { i = (i + 1) % photos.length; draw(); }
    };

    function close() {
      document.removeEventListener('keydown', onKey);
      box.remove();
    }

    // Tapping the backdrop closes; taps on the photo or controls do not.
    box.addEventListener('click', ev => { if (ev.target === box) close(); });
    document.addEventListener('keydown', onKey);
    draw();
  }

  /* --------------------------------------------------------- her work only
   * Reached by tapping the photo on a match card. Deliberately NOT the full
   * profile: at this point the only question is whether her work is the kind
   * of work you want, so this is photographs and nothing else, and you can
   * decide from here without ever losing your place in the queue.
   */
  screens.work = () => {
    const p = byId(route.params.id);
    if (!p) return screens.matches();
    const r = ranked().find(x => x.photographer.id === p.id);
    const shortlisted = S.shortlist.includes(p.id);

    const sections = D.SHOOTS.map(s => {
      const photos = p.photos.filter(ph => ph.shoot === s.key);
      if (!photos.length) return '';
      return '<h3 class="work-head">' + esc(s.label) +
        '<small>' + photos.length + ' photos</small></h3>' +
        '<div class="work-grid">' + photos.map((ph, i) =>
          '<button class="work-cell" data-full="' + s.key + ':' + i + '" ' +
          'aria-label="View full screen">' + photoHTML(ph, 500, 620) + '</button>').join('') + '</div>';
    }).join('');

    return {
      nav: false,
      locked: true,
      topbar:
        '<button class="iconbtn" data-go="matches">&#8249;</button>' +
        '<div><h1 style="font-size:21px">' + esc(displayName(p)) + '</h1>' +
          '<div class="sub">' + r.match + '% style match &middot; ' + esc(p.base) + '</div></div>',
      html:
        '<div class="work-scroll fade-in">' +
          '<p class="mc-tagline" style="margin:0 0 14px">' + esc(p.tagline) + '</p>' +
          (r.blindLikes >= 2
            ? '<div class="blind-flag" style="margin:0 0 16px">You swiped right on <b>' +
              r.blindLikes + ' of these</b> in the blind test, before you knew her name.</div>'
            : '') +
          sections +
          '<div style="margin-top:20px">' +
            '<button class="btn btn--paper" data-detail="' + p.id + '">' +
              'Pricing, travel &amp; availability &rsaquo;</button>' +
          '</div>' +
        '</div>' +

        '<div class="work-actions">' +
          '<button class="btn btn--ghost" data-decide="pass">&#10005;&nbsp; Pass</button>' +
          '<button class="btn" data-decide="like">' +
            (shortlisted ? '&#9829;&nbsp; Saved' : '&#9825;&nbsp; Save her') + '</button>' +
        '</div>',
      mount() {
        $$('[data-full]').forEach(b => b.addEventListener('click', () => {
          const [shoot, i] = b.dataset.full.split(':');
          openLightbox(p.photos.filter(ph => ph.shoot === shoot), Number(i));
        }));

        $('[data-detail]').addEventListener('click', () =>
          go('detail', { id: p.id, from: 'work', workId: p.id }));

        $$('[data-decide]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.decide === 'pass') {
            S.seen[p.id] = 'pass';
            const i = S.shortlist.indexOf(p.id);
            if (i >= 0) S.shortlist.splice(i, 1);
            toast('Passed');
          } else {
            S.seen[p.id] = 'shortlist';
            if (!S.shortlist.includes(p.id)) S.shortlist.unshift(p.id);
            toast('Saved');
          }
          save();
          go('matches');
        }));
      },
    };
  };

  /* ---------------------------------------------------------- full profile */
  screens.detail = () => {
    const p = byId(route.params.id);
    if (!p) return emptyScreen('Not found', '?', 'That photographer is gone', '', 'Back', 'matches');

    const r = ranked().find(x => x.photographer.id === p.id);
    const g = galleryState[p.id] || (galleryState[p.id] = { shoot: S.prefs.shoots[0] || 'engagements', index: 0 });
    const photos = p.photos.filter(ph => ph.shoot === g.shoot);
    const hero = photos[g.index % photos.length];
    const shortlisted = S.shortlist.includes(p.id);

    const priceRows = r.price.lines.map(l =>
      '<div class="pr"><span>' + esc(D.SHOOTS.find(s => s.key === l.shoot).label) + '</span>' +
      '<b>' + money(l.price) + '</b></div>').join('');

    const bundleRows = (p.bundles || []).map(b =>
      '<div class="pr"><span>' + esc(E.bundleName(b.items)) +
      '<br><small>' + b.items.map(i => D.SHOOTS.find(s => s.key === i).short).join(' + ') + '</small></span>' +
      '<b>' + money(b.price) + '</b></div>').join('');

    return {
      nav: false,
      html:
        '<div class="view-pad fade-in" style="padding-top:0">' +
          '<div class="hero">' + photoHTML(hero, 900, 1125) +
            '<button class="back" data-back>&#8249;</button></div>' +
          (creditLine(hero)
            ? '<p style="font-size:10.5px;color:var(--ink-faint);margin:7px 0 0;text-align:right">' +
              creditLine(hero) + '</p>'
            : '') +

          '<div class="shoot-switch">' + D.SHOOTS.map(s =>
            '<button data-dshoot="' + s.key + '" class="' + (s.key === g.shoot ? 'on' : '') + '">' +
            esc(s.label) + '</button>').join('') + '</div>' +

          '<div class="gallery-strip">' + photos.map((ph, i) =>
            '<div class="g ' + (i === g.index % photos.length ? 'on' : '') + '" data-pick="' + i + '">' +
            '<img src="' + D.photoURL(ph, 220, 290) + '" alt="" loading="lazy" ' +
            'style="filter:' + E.photoFilter(ph.axes) + '"></div>').join('') + '</div>' +

          '<h2 class="display" style="font-size:33px;margin-top:20px">' + esc(displayName(p)) + '</h2>' +
          '<p style="font-size:12px;color:var(--ink-faint);margin:5px 0 0;letter-spacing:0.3px">' +
            esc(p.base.toUpperCase()) + ' &middot; ' + p.years + ' YEARS &middot; ' +
            p.weddings + ' WEDDINGS &middot; ' + esc(p.instagram) + '</p>' +
          '<p class="lede">' + esc(p.tagline) + '</p>' +
          badgesHTML(r) +

          '<div class="quote">&ldquo;' + esc(p.quote) + '&rdquo;</div>' +

          '<h3 class="section-title">Style match &mdash; ' + r.match + '%</h3>' +
          matchBreakdownHTML(r) +

          '<h3 class="section-title">Pricing</h3>' +
          '<div class="card" style="padding:4px 16px">' +
            priceRows + bundleRows +
            '<div class="pr total"><span>Your ' + S.prefs.shoots.length + ' shoots' +
              (r.price.saved > 0 ? '<br><small>' + esc(r.price.label) + ', saves ' + money(r.price.saved) + '</small>' : '') +
              '</span><b>' + money(r.price.total) + '</b></div>' +
            (r.travel.fee > 0
              ? '<div class="pr"><span>Travel<br><small>' + esc(r.travel.note) + '</small></span>' +
                '<b>' + money(r.travel.fee) + '</b></div>'
              : '') +
            '<div class="pr total"><span>All in</span><b>' + money(r.allIn) + '</b></div>' +
          '</div>' +

          '<h3 class="section-title">The details</h3>' +
          '<div class="card" style="padding:4px 16px">' +
            detailRow('Your date', r.avail.note) +
            detailRow('Travel', r.travel.unknown ? r.travel.note :
              r.travel.maxMiles + ' mi from ' + esc(r.photographer.base) + ' to ' + esc(regionName())) +
            detailRow('Turnaround', p.turnaround) +
            detailRow('You get', p.delivers) +
            detailRow('Second shooter', p.secondShooter) +
          '</div>' +

          '<div class="sticky-actions">' +
            '<button class="btn ' + (shortlisted ? 'btn--paper' : 'btn--ghost') + '" data-shortlist>' +
              (shortlisted ? '&#9829; Saved' : '&#9825; Save her') + '</button>' +
            '<button class="btn" data-message>Message</button>' +
          '</div>' +
        '</div>',
      mount() {
        $('[data-back]').addEventListener('click', () => {
          const from = route.params.from || 'matches';
          // "work" needs to know which photographer to go back to.
          go(from, from === 'work' ? { id: route.params.workId || p.id } : {});
        });
        $$('[data-dshoot]').forEach(b => b.addEventListener('click', () => {
          g.shoot = b.dataset.dshoot; g.index = 0; render();
        }));
        $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
          g.index = Number(b.dataset.pick); render();
        }));
        $('[data-shortlist]').addEventListener('click', () => {
          const i = S.shortlist.indexOf(p.id);
          if (i >= 0) { S.shortlist.splice(i, 1); delete S.seen[p.id]; toast('Removed'); }
          else { S.shortlist.unshift(p.id); S.seen[p.id] = 'shortlist'; toast('Saved'); }
          save(); render();
        });
        $('[data-message]').addEventListener('click', () => openThread(p.id));
      },
    };
  };

  function detailRow(k, v) {
    return '<div class="pr"><span style="color:var(--ink-soft)">' + esc(k) + '</span>' +
      '<span style="text-align:right;max-width:62%;font-size:13px">' + esc(v) + '</span></div>';
  }

  function matchBreakdownHTML(r) {
    const pr = profile();
    const dom = E.dominantAxes(pr.axes).slice(0, 4);
    if (!dom.length) return '<p class="lede">Swipe through the taste test to see this.</p>';

    return '<div class="card" style="padding:14px 16px">' + dom.map(x => {
      const want = x.value > 0 ? x.axis.high : x.axis.low;
      const hers = r.photographer.style[x.axis.key];
      const agree = Math.sign(hers) === Math.sign(x.value) && Math.abs(hers) > 0.15;
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;' +
        'padding:7px 0;font-size:13px">' +
        '<span>You want <b>' + esc(want.toLowerCase()) + '</b></span>' +
        '<span style="color:' + (agree ? 'var(--sage)' : 'var(--ink-faint)') + ';font-weight:600;font-size:12px">' +
          (agree ? 'she shoots ' + esc(want.toLowerCase()) : 'she leans ' +
            esc((hers > 0 ? x.axis.high : x.axis.low).toLowerCase())) +
        '</span></div>';
    }).join('') + '</div>';
  }

  /* -------------------------------------------------------------- shortlist */
  screens.shortlist = () => {
    if (!S.shortlist.length) {
      return emptyScreen('Saved', '♡', 'Nothing saved yet',
        'Tap the heart on a match to keep her here. Nobody gets contacted until you say so.',
        'Find matches', 'matches', true);
    }

    const rows = ranked().filter(r => S.shortlist.includes(r.photographer.id));
    const sel = S.compareSel.filter(id => S.shortlist.includes(id));

    return {
      nav: true,
      topbar:
        '<div><h1>Saved</h1><div class="sub">' + S.shortlist.length + ' saved &middot; pick 2 or 3 to compare</div></div>',
      html:
        '<div class="view-pad fade-in">' +
          rows.map(r => {
            const p = r.photographer;
            const on = sel.includes(p.id);
            const thumb = p.photos.find(ph => ph.shoot === (S.prefs.shoots[0] || 'engagements'));
            return '<div class="slrow card">' +
              '<div class="thumb" data-open="' + p.id + '">' +
                '<img src="' + D.photoURL(thumb, 200, 250) + '" alt="" loading="lazy" ' +
                'style="filter:' + E.photoFilter(thumb.axes) + '"></div>' +
              '<div class="meta" data-open="' + p.id + '">' +
                '<h3>' + esc(displayName(p)) + '</h3>' +
                '<div class="line"><b>' + r.match + '% match</b> &middot; ' + money(r.allIn) + ' all in</div>' +
                '<div class="line" style="color:' +
                  (r.avail.state === 'booked' ? 'var(--alert)' : 'var(--ink-faint)') + '">' +
                  esc(r.avail.note) + (r.overBudget ? ' &middot; ' + money(r.overBudget) + ' over' : '') + '</div>' +
              '</div>' +
              '<button class="pick' + (on ? ' on' : '') + '" data-sel="' + p.id + '">&#10003;</button>' +
            '</div>';
          }).join('') +

          '<div class="note">Swiping was for finding your style. This is where you decide. ' +
          'Veil caps comparison at three on purpose &mdash; past three, nobody picks.</div>' +

          '<div class="comparebar">' +
            '<button class="btn" data-compare ' + (sel.length < 2 ? 'disabled' : '') + '>' +
              (sel.length < 2 ? 'Select 2 or 3 to compare' : 'Compare these ' + sel.length) + '</button>' +
          '</div>' +
        '</div>',
      mount() {
        $$('[data-sel]').forEach(b => b.addEventListener('click', () => {
          const id = b.dataset.sel;
          const i = S.compareSel.indexOf(id);
          if (i >= 0) S.compareSel.splice(i, 1);
          else if (S.compareSel.length >= 3) { toast('Three is the limit — drop one first'); return; }
          else S.compareSel.push(id);
          save(); render();
        }));
        $$('[data-open]').forEach(b => b.addEventListener('click', () => go('detail', { id: b.dataset.open, from: 'shortlist' })));
        $('[data-compare]').addEventListener('click', () => go('compare'));
      },
    };
  };

  /* ---------------------------------------------------------------- compare */
  let compareShoot = null;

  screens.compare = () => {
    const ids = S.compareSel.filter(id => S.shortlist.includes(id));
    if (ids.length < 2) return screens.shortlist();

    const rows = ranked().filter(r => ids.includes(r.photographer.id));
    const shoot = compareShoot || S.prefs.shoots[0] || 'engagements';
    const bestMatch = Math.max(...rows.map(r => r.match));
    const bestPrice = Math.min(...rows.map(r => r.allIn));

    const cols = 'grid-template-columns:64px repeat(' + rows.length + ',minmax(104px,1fr));';

    const row = (label, cells) =>
      '<div class="cmp-label">' + label + '</div>' + cells.join('');

    const photoCells = rows.map(r => {
      const ph = r.photographer.photos.filter(x => x.shoot === shoot)[0];
      return '<div class="cmp-photorow"><div class="ph">' +
        '<img src="' + D.photoURL(ph, 300, 400) + '" alt="" loading="lazy" ' +
        'style="filter:' + E.photoFilter(ph.axes) + '"></div></div>';
    });

    return {
      nav: false,
      topbar:
        '<button class="iconbtn" data-go="shortlist">&#8249;</button>' +
        '<div><h1>Compare</h1><div class="sub">Same shoot, side by side</div></div>',
      html:
        '<div class="view-pad fade-in">' +
          '<div class="shoot-switch">' + D.SHOOTS.map(s =>
            '<button data-cshoot="' + s.key + '" class="' + (s.key === shoot ? 'on' : '') + '">' +
            esc(s.label) + '</button>').join('') + '</div>' +

          '<div class="cmp-wrap"><div class="cmp-scroll"><div class="cmp" style="' + cols + '">' +
            '<div class="cmp-label" style="border-bottom:0"></div>' +
            rows.map(r => {
              const p = r.photographer;
              const ph = p.photos.filter(x => x.shoot === shoot)[1] || p.photos[0];
              return '<div class="cmp-head">' +
                '<div class="ph"><img src="' + D.photoURL(ph, 300, 400) + '" alt="" loading="lazy" ' +
                  'style="filter:' + E.photoFilter(ph.axes) + '"></div>' +
                '<h3>' + esc(displayName(p)) + '</h3>' +
                '<div class="pct">' + r.match + '% match</div>' +
              '</div>';
            }).join('') +

            row('Their work', photoCells) +

            row('Style fit', rows.map(r =>
              '<div class="cmp-cell' + (r.match === bestMatch ? ' best' : '') + '">' +
              '<span class="big">' + r.match + '%</span></div>')) +

            row('All in', rows.map(r =>
              '<div class="cmp-cell' + (r.allIn === bestPrice ? ' best' : '') + '">' +
              '<span class="big">' + money(r.allIn) + '</span>' +
              (r.overBudget ? '<small style="color:var(--alert)">' + money(r.overBudget) + ' over</small>' : '<small>in budget</small>') +
              '</div>')) +

            row('Package', rows.map(r =>
              '<div class="cmp-cell">' + esc(r.price.label) +
              (r.price.saved > 0 ? '<small>saves ' + money(r.price.saved) + '</small>' : '') + '</div>')) +

            row('Travel', rows.map(r =>
              '<div class="cmp-cell">' + (r.travel.fee ? money(r.travel.fee) : 'Free') +
              '<small>' + r.travel.maxMiles + ' mi away</small></div>')) +

            row('Your date', rows.map(r =>
              '<div class="cmp-cell' + (r.avail.state === 'booked' ? ' bad' : '') + '">' +
              (r.avail.state === 'booked' ? 'Booked' : r.avail.state === 'open' ? 'Free' : 'Unknown') + '</div>')) +

            row('Blind picks', rows.map(r =>
              '<div class="cmp-cell"><span class="big">' + r.blindLikes + '</span>' +
              '<small>of her photos</small></div>')) +

            row('Turnaround', rows.map(r =>
              '<div class="cmp-cell">' + esc(r.photographer.turnaround) + '</div>')) +

            row('2nd shooter', rows.map(r =>
              '<div class="cmp-cell">' + esc(r.photographer.secondShooter) + '</div>')) +

            row('Experience', rows.map(r =>
              '<div class="cmp-cell">' + r.photographer.weddings + '<small>weddings</small></div>')) +

            row('', rows.map(r =>
              '<div class="cmp-cell" style="border-bottom:0">' +
              '<button class="btn btn--sm" data-pick="' + r.photographer.id + '" ' +
              'style="width:100%;padding:9px 6px;font-size:11.5px">Message her</button></div>')) +
          '</div></div></div>' +

          '<div class="note">Green marks the best number in each row. It is not telling you who to pick &mdash; ' +
          'the cheapest and the best fit are usually different people, and that is the actual decision.</div>' +
        '</div>',
      mount() {
        $$('[data-cshoot]').forEach(b => b.addEventListener('click', () => {
          compareShoot = b.dataset.cshoot; render();
        }));
        $$('[data-pick]').forEach(b => b.addEventListener('click', () => openThread(b.dataset.pick)));
      },
    };
  };

  /* --------------------------------------------------------------- messages */
  /* "a, b and c" — not "a and b and c", which is what a plain join gives. */
  function listJoin(items) {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function draftInquiry(p) {
    const shoots = S.prefs.shoots.map(k => D.SHOOTS.find(s => s.key === k).label.toLowerCase());
    const venues = weddingPlaces();
    const r = ranked().find(x => x.photographer.id === p.id);

    return 'Hi ' + p.name.split(' ')[0] + '! I found you on Veil — we came out at a ' + r.match +
      '% style match.\n\nWe are getting married ' + fmtDate(S.prefs.date, true) +
      (venues.length ? ' in ' + listJoin(venues.map(v => v.name)) : '') + '.\n\n' +
      'I am looking for ' + listJoin(shoots) + '. Your ' + r.price.label.toLowerCase() +
      ' comes to ' + money(r.allIn) + ' all in for us' +
      (r.travel.fee ? ' (including ' + money(r.travel.fee) + ' travel)' : '') +
      '.\n\nAre you still available that day?';
  }

  function openThread(id) {
    if (!S.threads[id]) {
      S.threads[id] = [{ from: 'draft', text: draftInquiry(byId(id)), at: Date.now() }];
      save();
    }
    go('thread', { id });
  }

  screens.messages = () => {
    const ids = Object.keys(S.threads);
    if (!ids.length) {
      return emptyScreen('Messages', '✉', 'No conversations yet',
        'When you are ready, Veil writes the first message for you — your date, your venues, ' +
        'and her actual price for your package already filled in.',
        'Go to saved', 'shortlist', true);
    }

    return {
      nav: true,
      topbar: '<div><h1>Messages</h1><div class="sub">' + ids.length + ' conversation' + (ids.length > 1 ? 's' : '') + '</div></div>',
      html:
        '<div class="view-pad fade-in">' +
          ids.map(id => {
            const p = byId(id);
            const msgs = S.threads[id];
            const last = msgs[msgs.length - 1];
            const thumb = p.photos[0];
            return '<div class="thread-row" data-thread="' + id + '">' +
              '<div class="av"><img src="' + D.photoURL(thumb, 120, 120) + '" alt="" loading="lazy" ' +
              'style="filter:' + E.photoFilter(thumb.axes) + '"></div>' +
              '<div class="tx"><h3>' + esc(displayName(p)) + '</h3>' +
              '<p>' + (last.from === 'draft' ? 'Draft: ' : last.from === 'them' ? '' : 'You: ') +
              esc(last.text.replace(/\n+/g, ' ')) + '</p></div>' +
            '</div>';
          }).join('') +
        '</div>',
      mount() {
        $$('[data-thread]').forEach(b => b.addEventListener('click', () => go('thread', { id: b.dataset.thread })));
      },
    };
  };

  screens.thread = () => {
    const p = byId(route.params.id);
    const msgs = S.threads[p.id] || [];
    const draft = msgs.find(m => m.from === 'draft');
    const sent = msgs.filter(m => m.from !== 'draft');

    return {
      nav: false,
      /* Locked so the composer docks to the bottom of the screen. A sticky
       * composer only sticks once the thread overflows, which left it
       * floating mid-screen on a brand-new conversation. */
      locked: true,
      topbar:
        '<button class="iconbtn" data-go="messages">&#8249;</button>' +
        '<div><h1 style="font-size:21px">' + esc(displayName(p)) + '</h1>' +
        '<div class="sub">' + esc(p.base) + ' &middot; ' + esc(p.instagram) + '</div></div>',
      html:
        '<div class="thread-scroll fade-in">' +
          (draft ? '<div class="note" style="margin-top:0"><b>Veil drafted this for you.</b> ' +
            'Edit anything before you send — it is your enquiry, not ours.</div>' : '') +

          (sent.length ? '<div class="bubbles">' + sent.map(m =>
            '<div class="bub ' + (m.from === 'you' ? 'you' : 'them') + '">' + esc(m.text) +
            '<span class="t">' + new Date(m.at).toLocaleString('en-US',
              { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</span></div>').join('') +
            '</div>' : '') +
        '</div>' +

        '<div class="composer">' +
          '<textarea id="composer" rows="3" placeholder="Write a message…">' +
            esc(draft ? draft.text : '') + '</textarea>' +
          '<button data-send aria-label="Send">&#10148;</button>' +
        '</div>',
      mount() {
        const ta = $('#composer');
        /* The first message is a long pre-filled enquiry, not a chat reply, so
         * the box has to be tall enough to read it without scrolling inside. */
        const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(210, ta.scrollHeight + 2) + 'px'; };
        ta.addEventListener('input', grow); grow();
        const scroller = $('.thread-scroll');
        if (scroller) scroller.scrollTop = scroller.scrollHeight;

        $('[data-send]').addEventListener('click', () => {
          const text = ta.value.trim();
          if (!text) return;
          S.threads[p.id] = sent.concat([{ from: 'you', text, at: Date.now() }]);
          save();
          render();
          toast('Sent to ' + p.name.split(' ')[0]);

          /* Prototype only: she replies so the flow is visible end to end. */
          setTimeout(() => {
            const avail = E.availabilityFor(p, S.prefs.date);
            S.threads[p.id].push({
              from: 'them',
              at: Date.now(),
              text: avail.state === 'booked'
                ? 'Hi! I am so sorry — I am already booked that date. If your timeline is at all flexible I would love to work something out.'
                : 'Hi! Yes, I have that date open. I would love to shoot for you — want to hop on a call this week?',
            });
            save();
            if (route.name === 'thread' && route.params.id === p.id) render();
          }, 1800);
        });
      },
    };
  };

  /* --------------------------------------------------------------------- me */
  screens.me = () => {
    const pr = profile();
    const venues = weddingPlaces();

    return {
      nav: true,
      topbar: '<div><h1>You</h1><div class="sub">' + fmtDate(S.prefs.date) + '</div></div>',
      html:
        '<div class="view-pad fade-in">' +
          /* The full style breakdown lives here rather than on the results
           * screen. It is reference material — interesting to look back at,
           * but not what anyone wants in the moment they finish swiping. */
          '<div class="card" style="padding:16px">' +
            '<p class="eyebrow" style="margin-bottom:4px">Your style</p>' +
            '<h2 style="font-family:var(--serif);font-size:27px;font-weight:500;margin:0;color:var(--plum)">' +
              esc(pr.label) + '</h2>' +
            '<p style="font-size:12.5px;color:var(--ink-soft);margin:7px 0 2px">' +
              S.swipes.length + ' photos swiped &middot; ' +
              S.swipes.filter(s => s.vote !== 'pass').length + ' liked</p>' +
            axisBarsHTML(pr) +
            (pr.needsMoreSwipes
              ? '<p style="font-size:11.5px;color:var(--ink-faint);margin:10px 0 0;line-height:1.5">' +
                'Your swipes were spread fairly evenly, so this read is soft. ' +
                'Retaking the taste test would sharpen it.</p>'
              : '') +
          '</div>' +

          '<h3 class="section-title">Your wedding</h3>' +
          '<div class="card" style="padding:4px 16px">' +
            detailRow('Date', fmtDate(S.prefs.date, true)) +
            detailRow('Area', regionName()) +
            detailRow('Shoots', S.prefs.shoots.map(k => D.SHOOTS.find(s => s.key === k).label).join(', ')) +
            detailRow('Budget', money(S.prefs.budgetMax)) +
          '</div>' +

          '<div style="margin-top:18px;display:flex;flex-direction:column;gap:9px">' +
            '<button class="btn btn--paper" data-edit>Edit my details</button>' +
            '<button class="btn btn--paper" data-retake>Retake the taste test</button>' +
            '<button class="btn btn--paper" data-go="pro">I\'m a photographer</button>' +
            '<button class="btn btn--paper" data-go="credits">Photo credits</button>' +
            '<button class="btn btn--paper" id="install-btn" style="display:none">Add Veil to my home screen</button>' +
            '<button class="btn btn--danger" data-reset>Reset everything</button>' +
          '</div>' +

          '<div class="note">Prototype build. The studios, prices and calendars are invented. ' +
          (D.USING_REAL_PHOTOS
            ? 'The photographs are real work by real photographers &mdash; see Photo credits.'
            : 'The photographs are placeholder stock, not wedding work.') +
          ' The matching maths, travel costs and availability checks are real.</div>' +
        '</div>',
      mount() {
        $('[data-edit]').addEventListener('click', () => { setupStep = 0; go('setup'); });
        $('[data-retake]').addEventListener('click', () => {
          S.swipes = []; S.tasteDone = false; save(); go('taste');
        });
        $('[data-reset]').addEventListener('click', () => {
          S = structuredClone(DEFAULT_STATE);
          save(); setupStep = 0; go('welcome');
        });
        wireInstallButton();
      },
    };
  };

  /* ------------------------------------------------------------- credits
   * Unsplash's API Terms require crediting the photographer and Unsplash.
   * The blind phase shows no metadata about anyone by design, so the credit
   * lives here and on each revealed profile rather than over the swipe deck.
   */
  const UTM = '?utm_source=veil&utm_medium=referral';

  function creditLine(photo) {
    if (!photo || !photo.by) return '';
    const who = photo.username
      ? '<a href="https://unsplash.com/@' + esc(photo.username) + UTM + '" target="_blank" rel="noopener">' +
        esc(photo.by) + '</a>'
      : esc(photo.by);
    return 'Photo by ' + who +
      ' on <a href="https://unsplash.com/' + UTM + '" target="_blank" rel="noopener">Unsplash</a>';
  }

  screens.credits = () => {
    const lib = D.PHOTO_LIBRARY || [];
    const byCreator = {};
    lib.forEach(ph => {
      const key = ph.u || ph.by;
      if (!byCreator[key]) byCreator[key] = { by: ph.by, u: ph.u, n: 0 };
      byCreator[key].n++;
    });
    const creators = Object.values(byCreator).sort((a, b) => b.n - a.n);

    return {
      nav: false,
      topbar:
        '<button class="iconbtn" data-go="me">&#8249;</button>' +
        '<div><h1>Photo credits</h1><div class="sub">' +
          (creators.length ? creators.length + ' photographers' : 'Placeholder imagery') +
        '</div></div>',
      html:
        '<div class="view-pad fade-in">' +
          (D.USING_REAL_PHOTOS
            ? '<p class="lede" style="margin-top:0">Every photograph in Veil is real work by a real ' +
              'photographer, used under the Unsplash License. <b>The studios in this app are ' +
              'fictional</b> &mdash; the names, prices and calendars are demo data, and no photographer ' +
              'below is connected to them.</p>' +
              '<p class="lede">Photos on <a href="https://unsplash.com/' + UTM + '" target="_blank" ' +
              'rel="noopener">Unsplash</a> by:</p>' +
              '<div class="card" style="padding:4px 16px;margin-top:14px">' +
                creators.map(c =>
                  '<div class="pr"><span>' +
                    (c.u ? '<a href="https://unsplash.com/@' + esc(c.u) + UTM + '" target="_blank" ' +
                      'rel="noopener">' + esc(c.by) + '</a>' : esc(c.by)) +
                  '</span><small>' + c.n + ' photo' + (c.n === 1 ? '' : 's') + '</small></div>').join('') +
              '</div>'
            : '<p class="lede" style="margin-top:0">This build is running on placeholder stock ' +
              'imagery, not wedding photography. Run <code>tools/fetch-photos.js</code> with an ' +
              'Unsplash access key to load the real library.</p>') +
        '</div>',
    };
  };

  /* ---------------------------------------------- photographer side (stub) */
  screens.pro = () => ({
    nav: false,
    topbar:
      '<button class="iconbtn" data-go="welcome">&#8249;</button>' +
      '<div><h1>For photographers</h1><div class="sub">What your side looks like</div></div>',
    html:
      '<div class="view-pad fade-in">' +
        '<h2 class="display" style="font-size:31px">Five photos.<br>Three prices.<br><em>That is the whole<br>listing.</em></h2>' +
        '<p class="lede">No bio to write, no SEO, no blog. Brides never see your name until your work has ' +
        'already won them over.</p>' +

        '<h3 class="section-title">Your portfolio</h3>' +
        D.SHOOTS.map(s =>
          '<div class="card" style="padding:14px 16px;margin-bottom:10px">' +
            '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
              '<b style="font-size:14px">' + esc(s.label) + '</b>' +
              '<small style="color:var(--ink-faint);font-size:11px">5 photos required</small></div>' +
            '<div class="gallery-strip" style="margin-top:9px">' +
              [0, 1, 2, 3, 4].map(() =>
                '<div class="g" style="display:grid;place-items:center;background:var(--blush-soft);' +
                'border:1px dashed var(--blush);color:var(--plum);font-size:17px">+</div>').join('') +
            '</div>' +
            '<div class="field" style="margin-top:12px">' +
              '<label>Your price for ' + esc(s.label.toLowerCase()) + '</label>' +
              '<input type="number" placeholder="450" inputmode="numeric"></div>' +
          '</div>').join('') +

        '<h3 class="section-title">Where you work</h3>' +
        '<div class="card" style="padding:14px 16px">' +
          '<div class="field" style="margin-top:0"><label>Home base</label>' +
            '<input type="text" placeholder="Provo, UT"></div>' +
          '<div class="field"><label>Free travel radius (miles)</label>' +
            '<input type="number" placeholder="40" inputmode="numeric"></div>' +
          '<div class="field"><label>Per mile after that</label>' +
            '<input type="text" placeholder="$0.65"></div>' +
        '</div>' +

        '<div class="note">Veil scores your work on six style axes from the photos themselves. ' +
        'You cannot tag your way to the top of a list &mdash; you get matched to the brides who ' +
        'already chose your photos blind.</div>' +

        '<div style="margin-top:22px"><button class="btn" data-go="welcome">Back to the bride side</button></div>' +
      '</div>',
  });

  /* ------------------------------------------------------------ empty state */
  function emptyScreen(title, mark, head, body, cta, target, nav) {
    return {
      nav: nav !== false,
      topbar: '<div><h1>' + esc(title) + '</h1></div>',
      html:
        '<div class="empty fade-in">' +
          '<div class="mark">' + mark + '</div>' +
          '<h3>' + esc(head) + '</h3>' +
          (body ? '<p>' + esc(body) + '</p>' : '') +
          '<div style="max-width:230px;margin:0 auto">' +
            '<button class="btn" data-go="' + target + '">' + esc(cta) + '</button></div>' +
        '</div>',
    };
  }

  /* =================================================================== render */
  let keyHandler = null;

  function render() {
    keyHandler = null;
    swipeBusy = false;
    const def = screens[route.name]();

    const navHTML = def.nav === false ? '' : navBar();
    const topbarHTML = def.topbar ? '<div class="topbar">' + def.topbar + '</div>' : '';

    $('#app').innerHTML =
      topbarHTML +
      '<div class="view' + (def.locked ? ' view--locked' : '') + '">' + def.html + '</div>' +
      navHTML;

    $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    $$('.nav button[data-tab]').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
    if (def.mount) def.mount();
  }

  function navBar() {
    const tabs = [
      { key: 'taste', ico: '✦', label: 'Taste' },
      { key: 'matches', ico: '◇', label: 'Matches' },
      { key: 'shortlist', ico: '♡', label: 'Saved', badge: S.shortlist.length },
      { key: 'messages', ico: '✉', label: 'Messages', badge: Object.keys(S.threads).length },
      { key: 'me', ico: '○', label: 'You' },
    ];
    return '<div class="nav">' + tabs.map(t =>
      '<button data-tab="' + t.key + '" class="' + (route.name === t.key ? 'on' : '') + '">' +
        '<span class="ico">' + t.ico + '</span>' + t.label +
        (t.badge ? '<span class="badge">' + t.badge + '</span>' : '') +
      '</button>').join('') + '</div>';
  }

  document.addEventListener('keydown', ev => { if (keyHandler) keyHandler(ev); });

  /* -------------------------------------------------------- install prompt */
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    installEvent = ev;
    wireInstallButton();
  });

  function wireInstallButton() {
    const btn = document.getElementById('install-btn');
    if (!btn) return;
    if (!installEvent) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    btn.onclick = async () => {
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      btn.style.display = 'none';
    };
  }

  /* ------------------------------------------------------------ status bar */
  function tickClock() {
    const el = document.getElementById('sb-time');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US',
      { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '');
  }
  tickClock();
  setInterval(tickClock, 20000);

  /* ------------------------------------------------------------------ boot */
  if (S.onboarded) go(S.tasteDone ? 'matches' : 'taste');
  else go('welcome');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
