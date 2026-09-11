# Log File Bot Traffic Cost Analyzer

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://log-file-bot-traffic-cost-analyzer-1.onrender.com)
[![MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![100% Client-Side](https://img.shields.io/badge/Privacy-100%25_Client--Side-purple)](https://log-file-bot-traffic-cost-analyzer-1.onrender.com)
[![Bot DB](https://img.shields.io/badge/Bot_DB-v2026.09.01-orange)](data/bot-ips.json)
[![No Upload](https://img.shields.io/badge/Upload-None_needed-success)](https://log-file-bot-traffic-cost-analyzer-1.onrender.com)
[![v1.1.0](https://img.shields.io/badge/Version-1.1.0-informational)](CHANGELOG.md)
[![CI](https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer/actions)

Drop 1M-line logs → see **GPTBot vs OAI-SearchBot cost split** → copy the Cloudflare rule.
Free, private, **$0** vs £99/yr Screaming Frog / €383/mo JetOctopus. No log leaves your machine.

**[Try Live](https://log-file-bot-traffic-cost-analyzer-1.onrender.com) · [1-click 10k demo](https://log-file-bot-traffic-cost-analyzer-1.onrender.com/?sample=10k) · [60-sec walkthrough](#demo)**

> [!NOTE]
> `main` branch. v1.1.0 · Bot DB v2026.09.01 · IP JSON 2026-09-01. See [CHANGELOG.md](CHANGELOG.md).

---

## Why this exists

| Tool | Price 2026 | Your edge here |
|------|-----------|----------------|
| Screaming Frog Log Analyser | £99/yr | Free unlimited + auto AI classification (no manual regex) |
| JetOctopus | €171–383/mo | $0, instant, no FTP/S3 setup |
| OnCrawl / Botify | €49–2500/mo | No subscription or procurement cycle |
| Splunk | custom ingest | SEO-shaped out of the box |

**#1 differentiator:** 100% client-side. JetOctopus/OnCrawl require cloud upload; this tool is safe for DPDP/RBI-sensitive logs.

## The 2026 distinction (training vs search-index vs user-triggered)

Senior SEOs interview on exactly this — the analyzer splits all three with different edge actions:

| Class | Examples | Action | Why |
|-------|----------|--------|-----|
| **Training** | GPTBot, ClaudeBot, CCBot, Bytespider, Google-Extended (robots token) | Throttle/block freely, 60/min (20 aggressive) | Zero live citation loss |
| **Search-index** | OAI-SearchBot, PerplexityBot, Claude-SearchBot | Allow, 120/min (60 aggressive), 429 + Retry-After — never hard block | Citation share drops in 1–2 weeks if blocked (OAI 85:1, Perplexity 210:1 crawl-to-referral) |
| **User-triggered** | ChatGPT-User, Perplexity-User, Claude-User, MistralAI-User, Google-Agent | Do NOT throttle (300/min abuse ceiling only) | 429 = missing live answer; robots.txt may not apply (ChatGPT-User ignores robots 54%) |

Also baked in: Cloudflare 15 Sep 2026 auto-block of Training+Agent on ad pages for new domains, Pay Per Crawl 402 beta, vendor IP JSON verification (`data/bot-ips.json`, dated — short prefixes like `3.`/`34.` are heuristic-only, labeled low-confidence).

## Demo

1. Open the [live demo](https://log-file-bot-traffic-cost-analyzer-1.onrender.com/?sample=10k) — 10k deterministic rows load in one click.
2. KPI strip → AI Matrix (red = training, cyan = search-index, blue = user-triggered) → Edge Rules → Copy.
3. `sample-data/EXPECTED.md` lists exact expected counts so a reviewer verifies without thinking.

GIF: record once (drag 10k sample → KPIs → copy rule, 800px, <3MB) and drop at `assets/demo.gif`.

## Quick start

```bash
git clone https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer.git
cd Log-File-Bot-Traffic-Cost-Analyzer
node server.js   # http://localhost:8080 (gzip + security headers)
# or: docker compose up / docker run -p 8080:8080 <image>
```

Accepted inputs: JSON array, JSONL/NDJSON, **Apache Combined**, Nginx default, W3C Extended (with `#Fields` header), Cloudflare text.
Uploads stream in 8MB slices — 1GB files work; above ~300k lines a labeled systematic sample is analyzed (`500 MB+` exact totals → CLI).
Sample downloads (1 MB–1 GB) stream in 20k-row Blob chunks with live progress — no "Invalid string length" failure; `>100 MB` confirms first and suggests the CLI.

```bash
npm test          # 32 asserts: bots, traps, costs
npm run lint      # node --check across engine/worker/server/tools
npm run gen-logs -- --lines 10000 --bots 0.3 --seed 42 --out sample-data/sample-10k.jsonl
npm run fetch-ips # refresh data/bot-ips.json from vendor endpoints
```

## What it does (10 tabs)

Bot Classification (with counts) · Verification (4 layers, signals-not-proof) · Crawl Budget + traps · Cost (measured bytes × your CDN preset) · AI Matrix (3-color) · Edge Rules + **robots.txt generator** + Cloudflare AI Crawl Control mapping · Performance · Traffic Patterns · Security · CFO/FinOps 1-pager (CSV + print-to-PDF export).

Plus: Crawl + GSC join MVP (crawled-never-indexed / indexed-never-crawled), dark mode, Web Worker for 20k+ rows.

## Method (so a hiring manager trusts the numbers)

- Cost = measured bytes × configured pricing (CloudFront/Cloudflare/Fastly/GCS presets). No assumed traffic.
- Blockable = training + suspicious/unknown only. Search-index and user-fetch are never blockable.
- Verification = vendor IP JSON first, prefix heuristics labeled low-confidence. Anthropic has no IP list → robots.txt only.

## Benchmark

See [benchmarks/MacBook-Air-100k.md](benchmarks/MacBook-Air-100k.md). 100k deterministic rows (`--seed 42`): ~4–7 s in worker on M1 Air. Update the file with your machine — don't claim unmeasured numbers.

## Resume bullet

> Log-File Analyzer (JS, 10 tabs, 64 bot signatures) — client-side 100k-line parsing, training vs search vs user split, Cloudflare/Fastly rule export. Live: log-file-bot-traffic-cost-analyzer-1.onrender.com

## Contributing / Security / License

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · MIT ([LICENSE](LICENSE))
