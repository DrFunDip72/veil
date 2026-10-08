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

1. **Setup (2 steps)** — the date on a real calendar, then area, shoots and budget. The date gets a screen to itself because it is the only *hard* blocker: a booked photographer cannot be hired at any price. Location is one **region**, not a venue list — a bride has a date long before she has booked a hall, and travel cost barely moves between venues in the same county.
2. **Blind taste test** — 36 photos, one at a time, no metadata at all. Swipe right (my style), left (not me), up (obsessed).
3. **Your matches** — straight to the answer: your closest three, tappable, with the payoff line *"You picked 2 of her photos blind."* The style name is one line; the full axis breakdown lives in **You**, because it is reference material, not what anyone wants the second they stop swiping.
4. **Matches** — a ranked list, best fit first. Tap any card for her whole body of work; tap any photo there for full screen. Save with the heart, or from inside her work.
5. **Saved** — nobody is contacted until you message them.
6. **Compare** — 2 or 3 side by side, same shoot type, best value in each row marked.
7. **Message** — a pre-written enquiry with your date, venues and her actual price for your package already filled in.

### The decision model (the thing you asked about)

Swipe → Shortlist → Compare → Message, and each step means exactly one thing:

| Step | What it commits you to |
|---|---|
| Swiping photos | Nothing about any person. It builds your taste. |
| Save | A set to decide between. |
| Compare | 2–3 max, side by side. **Capped on purpose** — past three, nobody picks. |
| Message | The only step that contacts anyone. |

**Swiping belongs to the photos, not the photographers.** Matches is a list, not a second deck — the taste test already did the sorting, so swiping through all fourteen afterwards would re-do the work you just did, in a fixed order, with no way back to the one you liked two cards ago. A dating app swipes on people and then lists your matches; Veil swipes on photos, so the same rule applies one level down.

Swiping is for *discovery*. Compare is for *deciding*. Keeping those separate is why the funnel ends in a booking instead of an infinite scroll.

---

## Design decisions worth knowing

**The swipe card is about her work and nothing else.** Price, travel and availability cannot be acted on until Shortlist and Compare, so putting them on the swipe card only competes with the photograph — and re-contaminates exactly the style judgement the blind test exists to protect. Blockers still show ("booked your date", "$300 over") because those change whether shortlisting her is worth it; reassurances ("in budget", "no travel fee") are noise and are gone.

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
node test/photos.test.js                          # photo assignment, style-drift guard, credits
node tools/check-setup.js http://localhost:8123        # calendar, region picker, downstream copy
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
| `data.js` | 14 fictional Utah photographers, venues, style axes, photo assignment |
| `photos.js` | Generated photo library with measured style values (see Photography) |
| `engine.js` | Matching, pricing, travel and availability maths. No DOM. |
| `app.js` | Screens, routing, swipe gestures |
| `styles.css` | Design system + the desktop phone frame |
| `sw.js` | Service worker — shell network-first, photos cache-first in a separate capped cache |
| `test/engine.test.js` | Engine checks |

## What is real and what is placeholder

**Real:** the matching maths, haversine travel-cost calculation against actual Utah venue coordinates, bundle-vs-à-la-carte pricing logic, availability checks, the whole interaction model.

**Placeholder:** the 14 photographers are invented (prices are sized to the real Utah 2026 range, but they are not quotes).

## Photography

`photos.js` ships with **446 real wedding photographs** (144 engagement / 142 bridal / 160 wedding day) from 204 photographers. To regenerate or expand it:

```powershell
# 1. https://unsplash.com/developers -> Your apps -> New Application -> copy the Access Key
# 2. Chrome must be running with --remote-debugging-port=9222 (it decodes the images)
$env:UNSPLASH_ACCESS_KEY = "..."
node tools/fetch-photos.js
```

Fetches across 16 deliberately-chosen search buckets and writes `photos.js`; `data.js` picks it up automatically. The API results are cached to `tools/.photo-cache.json` before the slow measuring step, so a crash costs minutes rather than an hour of the 50-calls/hour demo quota. `--pages=N` controls depth, `--fresh` ignores the cache.

**The photos are measured, not labelled.** Veil's blind taste test only means anything if a photo's recorded style matches what the photo actually looks like. Dropping in real images with invented axis values would leave a bright airy shot tagged "moody film" and the matching would be theatre. So `warmth`, `light`, `grain` and `color` are computed from each photo's own pixels (mean channel balance, luminance, saturation, high-frequency energy and shadow lift) in a headless Chrome canvas, then rank-normalised across the corpus so the axes actually span −1..1. `pose` and `scale` are not recoverable from pixels without a model, so they come from the search bucket each photo was found in.

Each photographer then claims the five photos per shoot closest to her house style, with two deliberate tilts: **the most extreme styles pick first** (photos at the far end of an axis are scarce, and a generalist taking a rare heavily-grained frame costs her nothing while costing the film photographer her identity), and **each photographer's distance is weighted by how far she sits from neutral on each axis**, so her signature dominates her own selection — and **her style vector is replaced by the centroid of the photos she actually ended up with**, so the match % always describes the portfolio on screen rather than a declared style that drifted away from it. `test/photos.test.js` guards that, and also asserts each photographer's *written copy* still matches the portfolio she ended up with — "Real film. Grainy, dim, honest." has to stay near the top of the grain axis or the roster reads as nonsense while every number still validates.

**Licensing.** Only photo IDs and credits are committed; no image is redistributed. The app hotlinks `images.unsplash.com`, which is what the Unsplash License is built for. Their *API Terms* additionally require crediting the photographer and Unsplash — hence the credits screen under **You › Photo credits**, the credit under each revealed profile, and the explicit note that the studios are fictional and unconnected to the real photographers.

For your own wedding decision you can instead point it at portfolios of photographers you are actually considering: drop files at `photos/<photographerId>/<shoot>-<0..4>.jpg` and flip `USE_LOCAL_PHOTOS` in `data.js`. That is copyrighted work, so keep that build local — never deploy it.

## Not built yet

- Any backend — everything lives in `localStorage`
- Real photographer accounts and uploads (the "I'm a photographer" screen is a visual stub)
- Real messaging (she auto-replies after 1.8s so the flow is visible end to end)
- Automatic style-axis scoring from uploaded photos — today each photographer's axes are hand-authored. In production this is the hard technical problem and the actual moat.
