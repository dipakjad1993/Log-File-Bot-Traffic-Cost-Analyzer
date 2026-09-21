# 30-Second Recruiter Brief — Log File Bot Traffic Cost Analyzer

**Live:** https://log-file-bot-traffic-cost-analyzer.pages.dev · **Stack:** Vanilla JS + Web Worker, Node CLI, BigQuery/DuckDB, Cloudflare Pages · **License:** MIT

## Problem → Action → Result

| # | Problem (2026) | Action in this repo | Measured result |
|---|----------------|---------------------|-----------------|
| 1 | AI bots = 57.4% of web traffic, bills doubling | Built training vs search-index vs user-triggered split (127 sigs) | $2.61 total / $0.25 blockable on 320k-line sample; block training freely, never block search |
| 2 | 1GB logs crash browsers / leak to cloud | 8MB slices + Web Worker + .gz + multi-file, 100% client-side | 1.02GB / 3.2M lines → 320k analyzed in 6.6s read, 13.0s wall |
| 3 | Spoofed GPTBot with Chrome UA | UNVERIFIED spoof KPI + stealth score (z-score bursts, no deps) + opt-in DoH rDNS | 427 unusual checks surfaced, not hidden |
| 4 | JS sites get zero AI citations | JS-shell render-gap table (<5KB AI 200s + `/_next/data/`) | Instant GEO fix list |
| 5 | CFO won't fund SEO without $ | CFO tab: run-rate with 95% CI + real PDF download (vendored jsPDF, offline) | `cfo-bot-traffic-cost-<start>-to-<end>.pdf` with guardrails + sign-off |
| 6 | Copy-paste to production is risky | Safe edge-rule tokens (canonical `Bytespider`, never 40-char UA slice) + OAI-AdsBot revenue guard | 9 Cloudflare rules fired on 1GB run, AdsBot never blocked |

## Scale honesty (seniors love this)

Browser <500MB triage (300k sampled, stride bannered) · CLI `node tools/cli.js --exact` 500MB–50GB exact · BigQuery 50GB+. Verification counts scaled + labeled. Reproducible: `npm run gen-logs -- --seed 42 --days 30` → `sample-data/EXPECTED.md` byte-identical.

## Quality signals

- 118 asserts `npm test` (bots/traps/costs/samples/upload/.gz/CIDR/IPv6/stealth/CI/worker-parity/freshness/spoof/js-shell/anomaly/v2/p0verdict/cfo-pdf)
- Bot DB auto-fresh: `fetch-ips.yml` every Monday 2am UTC + `npm test`
- 29 screenshots from the real 1GB run, not mockups
- Deploy: Cloudflare Pages primary (never sleeps), GitHub Pages backup. Pages-only — no Render mirror.

## Roles this proves

Technical SEO · Frontend (vanilla JS, workers, perf) · Node tooling (CLI, MCP server) · Data (BQ/SQL, Parquet) · FinOps storytelling (CFO PDF).

## 90-sec walkthrough

1. Open live demo → Try 10k sample in 1 click (2s)
2. Tabs 1→4→6→10: classification → verification → cost → edge rules → CFO PDF ↓
3. Deep dive: [1GB teardown](../research/1gb-teardown.html) · [Bot DB](../BOTS.md) · [Method](../METHOD.md)
