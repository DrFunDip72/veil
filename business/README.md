# Veil

*A dating-app-style marketplace where Utah brides swipe wedding photos blind — no names, no prices, no follower counts — and get matched to the photographers whose work they already chose.*

## Why this one

It came out of a real search: finding a photographer for my own engagements, bridals and wedding meant googling, opening a dozen Instagram profiles, scrolling each, and trying to hold them all in my head. The photos are never side by side. Prices are hidden behind "inquire for pricing." And the moment you see a price or a follower count you stop judging the work.

What makes it worth building rather than just complaining about:

- **Near-zero capital.** Static PWA, no backend needed for v1, hosting is free-tier.
- **The prototype already exists** (`..\` in this folder) — matching maths, travel costs and availability all work.
- **A real wedge**: blind-first discovery is something Instagram and The Knot structurally cannot do, because their entire business is selling placement.
- **I am in the target market's physical centre.** Utah County, this year.

**The honest counter-argument, up front:** the problem is genuinely solved for free by asking one married friend for a referral. The pitch is only "more options than your friend's one guy." That is a weaker wedge than it feels like at 2am, and the model section does not pretend otherwise.

## The model in one sentence

Photographers pay a monthly listing fee to appear in a style-matched swipe feed; brides use it free, swipe blind, shortlist, compare 2–3 side by side, and message the winner directly.

## Unit economics snapshot

| | |
|---|---:|
| Startup cost | **$40** (domain + first-year hosting; build time is mine) |
| Price per unit (photographer listing) | **$39/month** |
| Variable cost per unit | **~$0.60/month** (image storage + bandwidth) |
| Gross margin | **~98%** |
| Break-even | **2 photographers** |
| Time per unit | ~45 min to recruit + onboard one photographer |

Software margins, so money is not the constraint. **Time and cold-start are.** See `BUSINESS-MODEL.md`.

## ⚠️ Do this before your first paying photographer

**Get an explicit image licence in writing before a single photo goes up.** Wedding photographs are copyrighted by the photographer, and many are additionally bound by client contracts restricting commercial display. Veil's blind mechanic makes this sharper than for a normal directory: it displays work *with attribution deliberately withheld*, which is exactly the thing a standard "you may display my photos" clause may not cover.

The terms must grant: display rights, the right to display **without visible attribution during the blind phase**, and the right to derive and store style metadata. Have an actual attorney read it — this is the one item here where getting it wrong is expensive rather than merely a waste of a weekend.

Also before charging: register the business entity, and check how Utah treats sales tax on SaaS subscriptions (do not assume it is exempt — verify with the Utah State Tax Commission).

## The honest trade-off

Three things cost real money or real credibility, and all three are structural rather than execution problems:

1. **A bride is a single-use customer with zero LTV.** She books one photographer and never opens the app again. Every month starts the acquisition engine from zero. All recurring revenue has to come from the photographer side, which means photographers must see enough leads to justify the fee — and they will not, early, because there are no brides yet.

2. **Classic two-sided cold start, with a seasonal clock.** Utah's engagement season (roughly Nov–Feb, driven by holiday proposals) and shooting season (roughly May–Oct) mean there are only about two windows a year when a launch can land. Miss one and the next real shot is six months out.

3. **The blind mechanic is the whole moat, and it is thin.** The interaction is copyable in a weekend. What is not copyable in a weekend is a roster of photographers with accurately scored style axes — which today are hand-authored. Automatic style scoring from uploaded photos is the actual defensible asset and it is not built.

This is a weekend-scale experiment with a clear, cheap kill signal — not a venture to quit anything for.

## Files in this folder

- `BUSINESS-MODEL.md` — full unit economics, scenarios by effort level, risks, and what would change the numbers
- `execution-plan.md` — the phased step-by-step to get from prototype to first dollar
- `profitability-path.md` — realistic cash outlay, time budget, milestones, and pace-to-income
- `tracker.md` — working log to fill in as you actually execute

The working prototype lives one level up. See `..\README.md`.
