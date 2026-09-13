# EXPERIMENTS — hypothesis → edge rule → before/after log diff

Recruiters grep for experimentation. Run each experiment for 7 days minimum,
then re-upload the new log window and diff the KPI strip.

## E1 — Block GPTBot/CCBot at edge (training, zero citation risk)

- Hypothesis: blocking `ai_training` UAs cuts egress ≥5% with zero change in
  GSC clicks/impressions (training bots never refer).
- Rule (Module 6 → Cloudflare): `Block GPTBot`, `Block CCBot` (BLOCK).
- Before/after: compare Tab 4 Total vs Blockable, Tab 10 projected annual,
  GSC clicks for the same 7-day weekday window.
- Success: blockable $ → ~$0, clicks flat, trap bytes down.

## E2 — Rate-limit OAI-SearchBot @120/min instead of blocking (citation protection)

- Hypothesis: 429-with-Retry-After keeps citation share; hard-block drops it in 1–2 wks.
- Rule: `Rate-limit OAI-SearchBot (search-index: ALLOW)` — 120/min/IP, exceed → 429 + Retry-After: 30.
- Before/after: GEO prompt-test list (Module 6) cited yes/no before vs after;
  GSC impressions for cited URLs.
- Success: cited rate flat or up, origin P95 down.

## E3 — Kill faceted trap crawl (`?color=&price_min=` + `/filter/`)

- Hypothesis: `Disallow: /*?color=` + canonical trims param crawl ≥30%.
- Rule: robots addition + CDN cache-bypass-off for trap paths; verify in Tab 3 paramRatio.
- Before/after: Tab 3 paramRatio, trap table bandwidth, crawlBudget efficiency.
- Success: paramRatio <15%, trap bytes −50%+.

Log every run: date range, rule pasted, before KPIs, after KPIs, GSC clicks,
decision (keep / revert). One row per experiment is enough for the interview story.
