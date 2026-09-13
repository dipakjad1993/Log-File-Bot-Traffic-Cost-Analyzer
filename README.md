# Log File Bot Traffic Cost Analyzer

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://log-file-bot-traffic-cost-analyzer-1.onrender.com)
[![MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![100% Client-Side](https://img.shields.io/badge/Privacy-100%25_Client--Side-purple)](https://log-file-bot-traffic-cost-analyzer-1.onrender.com)
[![Bot DB](https://img.shields.io/badge/Bot_DB-v2026.09.13-orange)](data/bot-ips.json)
[![No Upload](https://img.shields.io/badge/Upload-None_needed-success)](https://log-file-bot-traffic-cost-analyzer-1.onrender.com)
[![v1.3.0](https://img.shields.io/badge/Version-1.3.0-informational)](CHANGELOG.md)
[![CI](https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer/actions)

Drop 1M-line logs → see **GPTBot vs OAI-SearchBot cost split** → copy the Cloudflare rule.
Free, private, **$0** vs £99/yr Screaming Frog / €383/mo JetOctopus. No log leaves your machine.

**[Try Live](https://log-file-bot-traffic-cost-analyzer-1.onrender.com) · [1-click 10k demo](https://log-file-bot-traffic-cost-analyzer-1.onrender.com/?sample=10k) · [1GB proof test](#1-proven-on-a-real-102-gb--32m-line-log-file)**

> [!NOTE]
> `main` branch. v1.3.0 · Bot DB v2026.09.13 (75 signatures) · IP JSON 2026-09-13 (full CIDRs + IPv6). See [CHANGELOG.md](CHANGELOG.md).

![Upload screen](assets/screenshots/01-hero-upload.png)

---

## What's new in v1.3.0 (Bot DB v2026.09.13, 75 signatures)

- **8 new 2026 bots:** DeepSeekBot, QwenBot, Timpibot, Sidetiq, Firecrawl, Bright Data (training — block freely), MistralAI-Search (search-index, ALLOW @120/min), PetalBot (search-engine, allow). `ai_citation` legacy tier consolidated into `ai_search_index`.
- **Trap + threat coverage:** 16 traps (+cart/variant, `/_next/data/`, price sliders), 14 threats (+`.well-known`/`.svn`, `/vendor/phpunit`, Spring `/env`, GraphQL consoles, cloud-metadata SSRF).
- **Verification precision:** `fetch-bot-ips` keeps full CIDRs (`40.88.220.0/24`) + IPv6, never truncates to `/16`; worker path preserves the GSC URL set; `* Allow` robots lines carry the RFC 9309 most-specific-wins comment.
- **Polish:** repo-root `llms.txt`; `prefers-reduced-motion`; live dot pulses only while running with last-diff label; mobile 50MB upload guard.

## What's new in v1.2.0 (Bot DB v2026.09.02, 67 signatures)

- **New 2026 bots:** OAI-AdsBot (allow-listed — blocking it breaks ChatGPT shopping revenue checks), GoogleOther (+Image/Video), ImageSiftBot. Crawl-to-referral table updated: OAI 85:1, Perplexity 210:1, Claude ~5,143:1 (was 20,583:1).
- **Enterprise log plumbing:** `.gz` decompresses in-browser, multi-file rotation (`access.log + access.log.1 + access.log.2.gz`) merges in one drop, AWS ALB + Cloudflare Logpush fields mapped natively, IPv6 + CIDR verification, reverse-DNS checklist exporter.
- **Honest costs:** origin-compute is now **opt-in (OFF by default)** — no log tells SSR vs static. 10k fixture: $0.08 → **$0.04** total, all counts/tiers/threats byte-identical (see `sample-data/EXPECTED.md`).
- **New exports:** `llms.txt` generator, Cloudflare AI Crawl Control JSON, 402 pay-per-crawl example, real GSC join (Clicks/Impressions → orphan $ waste), GEO prompt-test list, `logs.csv` BigQuery/DuckDB bridge + SQL.
- **Trust fixes:** `/8` cloud prefixes removed, verification counts scaled + labeled on large files, W3C guess-mode flagged low-confidence, tarpitting advice replaced with 429/503 + Retry-After, deterministic seeded samples, mobile 50MB guard.

---

## 1. Proven on a real 1.02 GB / 3.2M-line log file

Not a toy demo. On 2026-09-11 the tool was driven end-to-end in headless Chromium against a **real 1.02 GB NDJSON log (3,200,000 lines, deterministic seed 7)** — uploaded, streamed, sampled, analyzed, and screenshotted. Every number below is measured, not written:

| Measurement | Result |
|-------------|--------|
| File uploaded | `oneGB.jsonl`, **1.02 GB**, 3,200,000 lines |
| Read + parsed + analyzed | **320,000 of 3,200,000 lines (systematic 1-in-10 sample) in 6.6 s**, 13.0 s wall total |
| Records / bandwidth (sample) | 320,000 records, **10.92 GB**, 223,878 unique IPs |
| Traffic split (sample) | **70.0% human**, 15 categories detected |
| Cost, CloudFront defaults (sample) | **$2.61 total**, **$0.25 blockable** (training only — search-index never counted) |
| Response profile (sample) | avg 799 ms, P95 1,474 ms, P99 1,535 ms |
| Threat patterns flagged | **19,272** suspicious requests |
| Verification warnings | 427 unusual checks surfaced, not hidden |
| Crawl-budget waste | 18% trap bandwidth quantified |
| 1 MB sample download (streaming generator) | `sample-logs-1MB-*.jsonl`, **2,621 valid lines**, zero errors |

The banner the tool shows on huge files (screenshot 08) states the sampling honestly — figures describe the analyzed sample and scale ~10×. All 29 screenshots below come from this exact run.

![Reading progress on the 1GB upload](assets/screenshots/04-upload-reading-progress.png)
![File info bar](assets/screenshots/05-info-bar.png)
![KPI strip from the 1GB run](assets/screenshots/06-kpi-strip.png)
![Tab counts](assets/screenshots/07-tab-counts.png)
![Sampling banner](assets/screenshots/08-sample-banner.png)

---

## 2. Why this exists (competitive position)

| Tool | Price 2026 | Scale | Bot classification | Privacy | Your edge here |
|------|-----------|-------|--------------------|---------|----------------|
| Screaming Frog Log Analyser | £99/yr | Desktop, slows past a few M lines | Manual regex list for GPTBot/Claude/Perplexity | Local desktop | Free unlimited + **auto** AI classification, no regex homework |
| JetOctopus (€171–383/mo) | 1–2M log lines | Cloud millions, crawl+logs+GSC joined | Auto, updated | Cloud upload | **$0, instant, no FTP/S3 setup** |
| OnCrawl / Botify | €49–2,500/mo | Up to 500M lines/day | Auto + segments | Cloud + GDPR FTP | No subscription or procurement cycle |
| Splunk | Custom ingest | Infinite | Build it yourself | Cloud | SEO-shaped out of the box |

**#1 differentiator:** 100% client-side. JetOctopus/OnCrawl require cloud upload; this tool is safe for DPDP/RBI-sensitive logs. Verified in this repo's audit: no `sendBeacon`/`XHR`/`WebSocket`; the only network request the app makes is loading the demo file you click.

---

## 3. The 2026 distinction: training vs search-index vs user-triggered

Senior SEOs interview on exactly this — the analyzer splits all three with different edge actions (Bot DB v2026.09.13, 75 signatures):

| Class | Examples | Action | Why |
|-------|----------|--------|-----|
| **Training** | GPTBot, ClaudeBot, CCBot, Bytespider, cohere-ai, AI2Bot, Google-Extended (robots token, not a UA) | Throttle/block freely, 60/min (20 aggressive) | Zero live citation loss |
| **Search-index** | OAI-SearchBot, PerplexityBot, Claude-SearchBot, DuckAssistBot | ALLOW, 120/min (60 aggressive), 429 + Retry-After — never hard block | Citation share drops in 1–2 weeks if blocked (OAI 85:1, Perplexity 210:1 crawl-to-referral) |
| **User-triggered** | ChatGPT-User, Perplexity-User, Claude-User, MistralAI-User, Google-Agent | Do NOT throttle (300/min abuse ceiling only) | 429 = missing live answer; robots.txt may not apply (ChatGPT-User ignores robots 54%) |

Also baked in: Cloudflare 15 Sep 2026 auto-block of Training+Agent on ad pages for new domains, Pay Per Crawl 402 beta, vendor IP JSON verification (`data/bot-ips.json`, dated — short prefixes like `3.`/`34.` are heuristic-only and labeled low-confidence, never verdicts; Anthropic has no IP list → robots.txt only).

![AI Matrix from the 1GB run — red training, cyan search-index, blue user-triggered](assets/screenshots/13-tab5-ai-matrix.png)
![AI Matrix close-up](assets/screenshots/28-ai-matrix-viewport.png)

---

## 4. The 10 analysis modules (all screenshotted from the 1GB run)

### Module 1 — Bot Classification
Bot-first signature order (bots beat browser fingerprints, documented against spoofing) over 75 signatures + 18 browser patterns, full per-category table with bandwidth, IPs, TTFB, status splits.

![Bot Classification](assets/screenshots/09-tab1-classification.png)

### Module 2 — Bot Verification (4 layers, signals not proof)
Vendor IP JSON first, TLS fingerprint, cloud-host heuristics, behavioral analysis. Unusual checks are counted on the tab (427⚠ in the 1GB run), never silently dropped.

![Bot Verification](assets/screenshots/10-tab2-verification.png)
![Verification close-up](assets/screenshots/26-verification-viewport.png)

### Module 3 — Crawl Budget & traps
Per-crawler efficiency, parameterized-URL ratios, 16 trap patterns including `gclid`/`fbclid`/`srsltid`, currency/locale variants, `/filter/` segments, cart/variant combos, `/_next/data/` routes and price-slider facets.

![Crawl Budget](assets/screenshots/11-tab3-crawl-budget.png)

### Module 4 — Cost Analysis (measured, not modeled)
Measured bytes × your CDN preset (CloudFront/Cloudflare/Fastly/GCS). $2.61 on the 1GB sample; blockable = training + suspicious only.

![Cost Analysis](assets/screenshots/12-tab4-cost.png)
![Cost close-up](assets/screenshots/27-cost-viewport.png)

### Module 6 — Edge Rules + robots.txt generator
Cloudflare/Fastly/AWS rules with copy buttons, training-vs-search robots.txt (Google-Extended handled as the token it is), Cloudflare AI Crawl Control mapping. 9 Cloudflare rules fired on the 1GB sample.

![Edge Rules](assets/screenshots/14-tab6-edge-rules.png)
![Edge Rules viewport](assets/screenshots/21-edge-rules-viewport.png)

### Module 7 — Performance
TTFB by category (bots vs humans separated — slow bots mean origin pressure, slow humans mean lost revenue), status/method distributions.

![Performance](assets/screenshots/15-tab7-performance.png)

### Module 8 — Traffic Patterns
Hourly spikes at mean + 2σ, day-of-week, top IPs/URLs/referrers.

![Traffic Patterns](assets/screenshots/16-tab8-traffic.png)

### Module 9 — Security
Traversal, `.git/HEAD`, `.aws/credentials`, actuator + Spring/env probes, `.well-known`/`.svn`/vendor exposure, GraphQL consoles, cloud-metadata SSRF, velocity anomalies. 19,272 threats surfaced in the 1GB run.

![Security](assets/screenshots/17-tab9-security.png)

### Module 10 — CFO / FinOps
Measured totals, blockable waste ($0.25 on the sample), projections, one-click CSV + print-to-PDF 1-pager.

![CFO dashboard](assets/screenshots/18-tab10-cfo.png)
![CFO close-up](assets/screenshots/29-cfo-viewport.png)

---

## 5. Workflow screens: pricing, join, dark mode, live monitor, mobile

![Pricing presets](assets/screenshots/19-pricing-panel.png)
![Crawl + GSC join finding orphans](assets/screenshots/20-crawl-gsc-join.png)
![Dark mode](assets/screenshots/22-dark-mode.png)
![Live monitor (honest local re-analysis, no fake polling)](assets/screenshots/23-live-monitor.png)
![1MB streaming sample download](assets/screenshots/24-sample-download.png)
![Mobile layout](assets/screenshots/25-mobile-hero.png)

---

## 6. About & How-To (in-app docs)

![About section](assets/screenshots/02-about.png)
![How-To section with format examples and FAQ](assets/screenshots/03-howto.png)

---

## 7. Quick start

```bash
git clone https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer.git
cd Log-File-Bot-Traffic-Cost-Analyzer
node server.js   # http://localhost:8080 (gzip + security headers, ?v= cache-busted assets)
# or: docker build -t log-analyzer . && docker run -p 8080:8080 log-analyzer
```

Accepted inputs: JSON array, JSONL/NDJSON, **Apache Combined** (tolerates `-` fields), Nginx default, W3C Extended (real `#Fields` parsing, guess-mode flagged), AWS ALB, Cloudflare Logpush, **.gz** — auto-detected per line, mixed files OK, multi-select for rotations.
Uploads stream in 8MB slices — 1GB files work (see §1); above ~300k lines a labeled systematic sample is analyzed; `500 MB+` exact totals → CLI.

```bash
npm test          # 70+ asserts: bots, traps, costs, streaming samples, upload parsing, .gz, CIDR/IPv6
npm run lint      # node --check across engine/worker/server/tools
npm run gen-logs -- --lines 10000 --bots 0.3 --seed 42 --out sample-data/sample-10k.jsonl
npm run fetch-ips # refresh data/bot-ips.json from vendor endpoints (full CIDRs + IPv6 preserved)
```

---

## 8. Method

- **Cost = measured bytes × configured pricing.** No assumed traffic. Proven by perturbation test: +1 GiB on one record moves the total exactly +$0.09.
- **Origin-compute is opt-in (OFF by default).** No log distinguishes SSR from static, so the engine adds $0 unless you enable it in Pricing.
- **Blockable = training + suspicious/unknown only.** Search-index and user-fetch are never blockable (asserted in tests).
- **Verification = vendor IP JSON first** (IPv6 + full-CIDR aware, `normalizeTier` consolidates the `ai_citation` legacy alias into `ai_search_index`), `/16`-or-longer prefix heuristics labeled low-confidence. No IP list is ever invented (Anthropic stays robots.txt-only).
- **Sampling is disclosed** on-screen with stride, counts and timing — verification counts are scaled to the full set and labeled, never silent.
- **Reproducibility:** `sample-data/EXPECTED.md` pins exact expected counts for the deterministic 10k fixture; CI re-verifies on every push.

## 9. Architecture

```
index.html                  # dashboard + 10 tabs + join UI (?v= cache-busted assets)
server.js                   # static server: gzip, CSP/nosniff/DENY, traversal guard
js/analyzer.js              # engine: 75-signature DB, 4-layer verify, 14-step analyze, 10 renderers
js/worker.js                # off-main-thread analyze() for 20k+ rows
data/bot-ips.json           # dated vendor IP JSON snapshot, full CIDRs + IPv6 (refresh: npm run fetch-ips)
tools/gen-logs.js           # deterministic batched NDJSON generator (1GB+ safe)
sample-data/                # 22-row teaching set, combined-log fixture, 10k + EXPECTED.md
tests/                      # 70+ asserts (bots/traps/costs/samples/upload/.gz/CIDR)
llms.txt                    # repo-root AI-use policy (generated per-site in Module 6)
BIGQUERY.md / EXPERIMENTS.md  # SQL + experimentation guides
assets/screenshots/         # 29 HD captures from the real 1.02GB run (this README)
```

## 10. Benchmark

See [benchmarks/MacBook-Air-100k.md](benchmarks/MacBook-Air-100k.md). Measured reference points: 130 MB blob → 399,804 lines streamed and 199,902 kept (stride 2) in ~1.2 s read in Node 24; **1.02 GB / 3.2M lines → 320,000 kept (stride 10) in 6.6 s read, 13.0 s read+analyze in headless Chromium.** Update the file with your machine — don't claim unmeasured numbers.

## Resume bullet

> Log-File Analyzer (JS, 10 tabs, 75 bot signatures) — client-side 1GB streaming uploads (.gz + multi-file), training vs search vs user split, IPv6/CIDR verification, Cloudflare/Fastly rule + llms.txt export. Proven on 3.2M-line log. Live: log-file-bot-traffic-cost-analyzer-1.onrender.com

## Contributing / Security / License

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · MIT ([LICENSE](LICENSE))
