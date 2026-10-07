# Business Model & Economics — Veil

*Written 2026-10-06. All figures are estimates with stated assumptions — check them against your first real photographers and revise this file.*

---

## The one-paragraph summary

This is a **~98% gross margin** software business with a **~$40 startup cost** that breaks even on its **second paying photographer**. It has no capital problem and never will. Its constraint is not money, not hosting, not even build time — the prototype already works. The constraint is **a two-sided cold start on a seasonal clock**: photographers pay for leads that do not exist until brides arrive, brides arrive only if photographers are already listed, and Utah gives you roughly two launch windows a year to break that loop. Every dollar of upside comes from one number: **leads delivered per photographer per month.** If that number is above ~2, the fee is trivially worth paying and churn goes to near zero. If it is 0, no amount of product polish saves it.

---

## What we know and what we don't

### Known
- Utah has an unusually high marriage rate for its population, and Utah County specifically concentrates a large volume of young weddings (BYU/UVU). The raw market is thousands of weddings a year, not hundreds.
- Utah wedding photography prices cluster roughly **$1,600–$4,200 for wedding-day coverage** and **$325–$700 per engagement or bridal session**, based on public pricing pages. The prototype's roster is sized to this range.
- Hosting, domain and image storage for a v1 at this scale cost **under $10/month**. This is verifiable today.
- The product works. The matching maths, travel-cost calculation and availability checks are built and tested.
- Utah's wedding season is strongly seasonal — shooting concentrates roughly May–October, booking happens months ahead of that.

### Unknown — and these are what the first ten conversations must answer
- **Will a photographer pay a monthly fee before seeing a single lead?** This is the single most important unknown in the entire file. Everything else is arithmetic.
- **Will a bride trust a style match enough to message someone she has not vetted on Instagram?** Or does she swipe, then go Instagram-stalk anyway — making Veil a discovery toy rather than a booking funnel?
- Actual leads-per-photographer-per-month at any realistic bride volume.
- Whether photographers will hand over 15 photos and real prices. **Published pricing is the ask they are most likely to refuse** — "inquire for pricing" is deliberate on their part, and Veil's comparison screen destroys it.
- Churn rate once the novelty wears off.
- Whether the exact number of marriages in the target counties supports the Tier 2 numbers below. **Verify against Utah Department of Health vital statistics before relying on any of this.**

> Nothing in the Tier tables below is measured. They are arithmetic on guesses, and they are here to show which guess matters most — not to forecast income.

---

## 1. Unit economics

### Variable cost per photographer listing, per month

| Item | Cost | Basis |
|---|---:|---|
| Image storage (15 photos, ~2 MB each, object storage) | $0.01 | ~30 MB at commodity object-storage rates |
| Bandwidth / image delivery | $0.40 | Estimate at a few thousand image loads/month |
| Payment processing (2.9% + $0.30 on $39) | $1.43 | Stripe published rate |
| **Total variable cost** | **~$1.84** | |

### Contribution per listing

| Price point | Revenue | Var. cost | **Gross profit** | Margin |
|---|---:|---:|---:|---:|
| $39/month listing | $39.00 | $1.84 | **$37.16** | **95%** |
| $49/month (featured) | $49.00 | $1.99 | **$47.01** | **96%** |

*(The 98% headline in the summary excludes payment processing; 95% is the honest number including it. Use 95%.)*

### Startup / fixed costs (one time)

| Item | Cost |
|---|---:|
| Domain (`veilphoto.app` or similar, 1 yr) | $15 |
| Hosting (Vercel free tier) | $0 |
| Object storage (free tier at this scale) | $0 |
| Business entity registration (Utah LLC) | $54 |
| **Total** | **~$69** |
| Legal review of the image licence (see below) | $300–800 |

**Break-even excluding legal: 2 photographers. Including a $500 legal review: ~16 photographers.**

The legal review is not optional padding — see the ⚠️ section in `README.md`. Budget it.

---

## 2. Constraints and timing

Three, in order of how likely each is to kill it:

1. **Cold start.** Neither side is worth anything without the other. The only way through is to make one side free and manually stuffed: recruit photographers at $0 for the first season, so brides land on a full app. Revenue starts only after leads are provably flowing.

2. **Seasonality.** Engagement season (holiday proposals, roughly Nov–Feb) feeds the booking rush. That makes **November 2026 the next real launch window** and May 2027 the one after. There is no third option this year.

3. **Your hours.** Recruiting a photographer takes ~45 minutes end to end — find her, DM her, answer her questions, onboard 15 photos and prices. Forty photographers is thirty hours of unglamorous outreach. That is the actual job, and it is not the part that is fun.

Money is not on this list and never will be.

---

## 3. Scenarios by effort level

### Tier 1 — Current scale, executed well

*Launch Utah County only. Recruit 30 photographers free for the first season in exchange for honest feedback. Charge nothing. Measure one number: leads delivered per photographer.*

"Discipline" here means: a written outreach script, a tracked list in `tracker.md`, a hard rule that every photographer is asked the same three questions, and a willingness to kill it in week 8 on the evidence.

- **Time investment:** 6–8 hrs/week for 8 weeks, then ~2 hrs/week
- **Realistic pace:** 4–5 photographers onboarded/week

| | |
|---|---:|
| Photographers listed | 30 |
| Paying | 0 |
| Revenue | $0 |
| Costs | ~$70 one-time |
| **Monthly net** | **−$10** |

**This tier makes no money on purpose.** It buys the only thing that matters: a measured leads-per-photographer number. If that number comes back at zero, you have spent ~$70 and eight weeks instead of a year.

### Tier 2 — Putting more work into it

*Only enter this tier if Tier 1 produced ≥2 leads/photographer/month. Convert the free roster to paid, expand to the Wasatch Front, add the photographer self-serve upload flow.*

- **Time investment:** 12–15 hrs/week
- **Realistic pace:** 8–10 new photographers/month, assume 60% of the free roster converts to paid

| | |
|---|---:|
| Photographers listed | 90 |
| Paying at $39 | 55 |
| Revenue | $2,145 |
| Variable costs | $101 |
| **Monthly net** | **~$2,044** |

The fragile assumption is the 60% conversion. If it is 25%, this tier is $890/month for fifteen hours a week — a bad trade against almost anything else in the portfolio.

### Tier 3 — What this looks like at real scale (context, not a plan)

Statewide, then Idaho/Arizona. 400+ paying photographers at $49 is roughly $19,600/month gross. Reaching it requires: automatic style-axis scoring from uploaded photos (currently hand-authored, and the only real moat), a real backend with auth and payments, someone doing photographer success full time, and paid bride acquisition. That is a funded company with employees, not a weekend project. **Noted so the ceiling is known — not proposed.**

---

## 4. Subscription unit economics

| Metric | Target | Note |
|---|---|---|
| ARPA | $39/month | |
| Gross margin | 95% | |
| CAC (cash + labour at $25/hr notional) | ~$19 | 45 min of outreach, no ad spend |
| Monthly churn | **5%?** | **Pure guess. The number that decides everything.** |
| Gross-margin LTV | $39 × 0.95 ÷ 0.05 = **$741** | |
| Payback period | **< 1 month** | |

An LTV:CAC of ~39:1 looks spectacular, and it is — *conditional entirely on 5% churn being real*. At 20% monthly churn (very plausible for a lead-gen tool that is not delivering leads) LTV collapses to $185 and the business becomes a treadmill of replacing photographers who quit. **Do not quote the 39:1 number to anyone, including yourself, until churn is measured.**

---

## 5. Structural realities to price in

- **Zero bride LTV.** She uses it once. This is permanent and unfixable, and it means bride acquisition is a cost you pay forever with no compounding.
- **The interaction is copyable in a weekend.** Blind swiping is not defensible. The defensible asset is accurately scored style axes across a real roster, which is also the one thing not yet built.
- **Photographers will resist published pricing.** "Inquire for pricing" exists so they can quote by job and read the client first. Veil's compare screen takes that away. Expect this to be the top objection, not the fee.
- **Reputational single point of failure.** One photographer who no-shows a wedding found through Veil is a brand-ending story in a community this tight and this well-networked. Decide early whether you vet or merely list — and say which, visibly.
- **Platform dependency on image hosting and the app stores** is low (PWA, self-hosted) — a genuine structural advantage worth keeping.
- **Your actual moat, if any:** being physically inside the target market during its peak season, with a working product, before anyone else bothers. That is a timing advantage, not a durable one.

---

## 6. Sensitivity — what actually moves the number

| Change | Monthly impact (at Tier 2) | Free? |
|---|---:|---|
| Leads/photographer/month 0 → 2 | Decides whether revenue is $0 or $2,000 | Yes — it is a product + bride-acquisition problem |
| Free→paid conversion 25% → 60% | +$1,150 | Yes — depends entirely on demonstrated lead flow |
| Monthly churn 20% → 5% | +$556 LTV per photographer | Yes |
| Price $39 → $49 | +$550 | Yes, but raises churn risk |
| Launching Nov vs. missing to May | Six months of calendar | Yes — purely a scheduling decision |

Every single lever is free. This is a business whose outcome is decided by sequencing and evidence, not spending.

---

## 7. Bottom line

| Scenario | Your hrs/wk | Monthly net |
|---|---:|---:|
| **Tier 1** (measure only) | 6–8 | −$10 |
| **Tier 2** (if Tier 1 clears the bar) | 12–15 | ~$2,044 |
| **Tier 3** (context only) | full-time + staff | ~$19,600 gross |

**The call:** run **Tier 1 only**, launched into the November 2026 engagement season, with no revenue goal whatsoever. The entire purpose is to measure leads-per-photographer-per-month on a real roster. Do not build the backend, do not build self-serve uploads, do not take a dollar until that number exists. The prototype is already good enough to recruit on.

**What to verify against reality first:**
1. Leads delivered per photographer per month *(the whole business)*
2. Will a photographer pay $39/mo before seeing leads? *(ask all 30 directly)*
3. Will photographers publish real prices? *(expect the loudest "no")*
4. Do brides message through Veil, or swipe and then leave for Instagram? *(instrument this)*
5. Actual marriage counts in the target counties *(Utah Dept. of Health vital statistics — currently assumed, not checked)*

Track all five in `tracker.md` and rewrite this file once you have them.
