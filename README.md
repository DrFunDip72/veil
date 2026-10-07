# Veil

*One-line pitch: a dating-app-style PWA where brides swipe wedding photos **blind** — no names, no prices, no follower counts — and then get shown the Utah photographers whose work they already picked.*

**Live:** <https://veilphoto.vercel.app>
**Repo:** <https://github.com/DrFunDip72/veil> — pushes to `main` auto-deploy to production.

**Status:** working prototype, 2026-10-07. Installable PWA, runs entirely client-side, no backend.

> The exact name `veil.vercel.app` was already taken by an unrelated app, so production
> is `veilphoto.vercel.app`. `veilweddings`, `veilco` and `veilutah` were also free at
> the time of writing if you'd rather switch — it's one domain change in the Vercel
> project settings, no code change.

---

## The problem it solves

Finding a wedding photographer in Utah today means googling, opening fifteen Instagram profiles, scrolling each one, and trying to hold them all in your head at once. The photos are never side by side. Prices are hidden behind "inquire for pricing." And the moment you see a price or a follower count, you stop judging the work.

Veil inverts it: **taste first, everything else second.**

## How it works

1. **Setup (3 taps)** — wedding date, venues, budget, which shoots you need.
2. **Blind taste test** — 36 photos, one at a time, no metadata at all. Swipe right (my style), left (not me), up (obsessed).
3. **Your style** — a named aesthetic ("Candid Film Muted"), the axes you actually chose on, and the payoff line: *"You swiped right on 3 of Hanna Reeve's photos before you knew her name."*
4. **Matches** — photographer cards ranked by style fit, with 15 photos each across Engagements / Bridals / Wedding day, plus price, travel cost to *your* venues, and whether she is free on *your* date.
5. **Shortlist** — swiping right only saves. Nobody is contacted.
6. **Compare** — 2 or 3 side by side, same shoot type, best value in each row marked.
7. **Message** — a pre-written enquiry with your date, venues and her actual price for your package already filled in.

### The decision model (the thing you asked about)

Swipe → Shortlist → Compare → Message, and each step means exactly one thing:

| Step | What it commits you to |
|---|---|
| Swipe right | Nothing. It saves her. |
| Shortlist | A set to decide between. |
| Compare | 2–3 max, side by side. **Capped on purpose** — past three, nobody picks. |
| Message | The only step that contacts anyone. |

Swiping is for *discovery*. Compare is for *deciding*. Keeping those separate is why the funnel ends in a booking instead of an infinite scroll.

---

## Design decisions worth knowing

**Match % is style only.** Budget, travel and availability never touch the number. They are shown as badges and used to sink blocked photographers to the bottom of the list — but a 97% match who is $200 over budget still appears, because hiding her is how you lose the right answer.

**Match is computed on taste *shape*, not magnitude.** Averaging +1/−1 swipes regresses hard toward the middle of every axis. Matching on raw averages made the most *average* photographer in the roster win every single time, and buried the distinctive ones the bride actually liked. The profile is rescaled so her strongest opinion hits full scale, and raw magnitude is kept only to report confidence honestly.

**Every axis carries a weight floor.** Axes she felt strongly about dominate — but never so much that an axis she was lukewarm on becomes free. Without the floor, a warm-toned photographer could win a cool-toned bride purely because warmth was not one of her top three axes.

**Disliking is as informative as liking.** A passed photo pushes the profile *away* from its values.

**Low confidence is said out loud.** If the swipes were scattered, the reveal screen says so rather than presenting a noisy ranking as a verdict.

---

## Running it

```powershell
.\serve.ps1            # http://localhost:8123
.\serve.ps1 -Port 9000
```

A PWA needs a real origin — opening `index.html` off the filesystem gives no service worker and no install prompt.

**Install:** Chrome address bar › *Install app*. On iPhone: Share › *Add to Home Screen*.

On a desktop browser the app is deliberately drawn inside a phone frame. The frame disappears on a real phone and once installed.

### Tests

```bash
node test/engine.test.js                          # matching, pricing, travel, availability, edge cases
node tools/check-pwa.js https://veilphoto.vercel.app   # installability: manifest, icons, precache
node tools/smoke.js      https://veilphoto.vercel.app   # drives a real browser against a live origin
```

Three simulated personas (warm-film-documentary, bright-clean-editorial, dark-moody-epic) must each rank a photographer from their own style family first.

### Tooling

```bash
node tools/gen-icons.js      # regenerates the PNG icons from scratch, no deps
node tools/shoot.js          # screenshots every screen into screens/
```

`shoot.js` and `smoke.js` need Chrome already running with `--remote-debugging-port=9222`:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new `
  --remote-debugging-port=9222 --user-data-dir="$env:TEMP\veil-chrome" --window-size=1180,1050
```

`smoke.js` checks what only breaks on a real origin: service worker activation, offline
replay from cache, a full swipe-to-message run, and a regression test that hammers the
swipe button faster than the exit animation to prove votes are never double-committed.

---

## Files

| File | What it is |
|---|---|
| `data.js` | 14 fictional Utah photographers, 15 photos each, venues, style axes |
| `engine.js` | Matching, pricing, travel and availability maths. No DOM. |
| `app.js` | Screens, routing, swipe gestures |
| `styles.css` | Design system + the desktop phone frame |
| `sw.js` | Service worker — shell network-first, photos cache-first in a separate capped cache |
| `test/engine.test.js` | Engine checks |

## What is real and what is placeholder

**Real:** the matching maths, haversine travel-cost calculation against actual Utah venue coordinates, bundle-vs-à-la-carte pricing logic, availability checks, the whole interaction model.

**Placeholder:** the 14 photographers are invented (prices are sized to the real Utah 2026 range, but they are not quotes). **The photos are random stock images, not wedding photography** — they prove out layout and loading, nothing more. To preview with real portfolios, drop files at `photos/<photographerId>/<shoot>-<0..4>.jpg` and flip `USE_LOCAL_PHOTOS` in `data.js`. Nothing else changes.

## Not built yet

- Any backend — everything lives in `localStorage`
- Real photographer accounts and uploads (the "I'm a photographer" screen is a visual stub)
- Real messaging (she auto-replies after 1.8s so the flow is visible end to end)
- Automatic style-axis scoring from uploaded photos — today each photographer's axes are hand-authored. In production this is the hard technical problem and the actual moat.
