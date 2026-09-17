# Enterprise 2026 Competitive Analysis + Research + Data Analysis (v2.0.0)

> Scope: real measured behavior from this repo (1.02GB / 3.2M-line headless-Chromium run,
> 105 asserts in `npm test`, deterministic fixtures), plus verified 2026 vendor facts
> (Screaming Frog 7.0 Apr-29-2026, JetOctopus 2026, Botify/OnCrawl/Lumar, Cloudflare AI
> Crawl Control + Pay Per Crawl 402 beta + BotBase). Directional ratios are labeled
> ranges — logs prove fetch, never citation.

## 1. What this tool actually is (system, not script)

- Engine `js/analyzer.js`: 127 signatures, bot-first order (bots beat browser
  fingerprints), longest-pattern-first (Applebot-Extended beats Applebot),
  14-step `analyze()`, 10 renderers (now thinned: short labels, Perf+Traffic merged,
  Security collapsed).
- Verification 4-layer: vendor IP JSON first (14 sources incl. BotBase taxonomy,
  full CIDRs + IPv6, ETag + last-good pin) > TLS signal > cloud ASN heuristic >
  behavior. Logs prove claim, not identity (`METHOD.md`).
- 2026 split enforced end-to-end: `ai_training` block @ 60/min (GPTBot, ClaudeBot,
  CCBot, Bytespider, DeepSeekBot, QwenBot, Firecrawl, Bright Data) · `ai_search_index`
  ALLOW @ 120/min + 429/Retry-After only (OAI-SearchBot 85:1, PerplexityBot 210:1,
  Claude-SearchBot ~5,143:1) · `ai_user_fetch` DO NOT throttle, 300/min ceiling only
  (ChatGPT-User ignores robots ~54%; OAI-AdsBot allow-listed — blocking breaks
  ChatGPT shopping revenue).
- Cost honesty: measured bytes × CDN preset. Blockable = training + suspicious ONLY
  (asserted). Origin-compute OFF by default. 95% interval ±1.96/√N. Perturbation:
  +1 GiB = +$0.09 exactly.
- Scale honesty: 8MB slices, ANALYZE_CAP 300k, stride + kept/total + ms banner.
  CLI `--exact` 500MB–50GB streaming constant-memory. BQ 50GB+. Proven: 1.02GB /
  3.2M lines — 320k kept in 6.6s read, 13.0s wall (29 screenshots).
- Tests: 105 asserts (v2): freshness + fallback pin, spoof fixtures, js-shell,
  anomaly/diff/edge/BQ/triple-join, 20.5k worker parity, +10 v2 (Sept defaults,
  PPC v2, Web Bot Auth batch, bundle, gap, dynamics, streaming, MCP, guards).

## 2. 2026 competitive matrix (verified)

### Screaming Frog Log Analyser 7.0 (Apr 29 2026, $139/yr)
Caught up: AI verification, UA groupings (All Search / All AI), custom verify via
JSON URL / rDNS / ASN / static ranges, unknown-UA discovery. Desktop Java, smart DB,
Spider→log join. Weakness: manual regex for new bots, desktop-only, slows past few M
lines, no cost layer, no training-vs-search action mapping.
We win: auto 127-sig classification, instant web UI, $ cost + CFO 1-pager,
Cloudflare/Fastly rule gen, Sept-2026 preset + BotBase sync, PPC v2, batch DoH.
We lose: brand trust, persistent projects, spider depth.

### JetOctopus (€171–383/mo, enterprise no-cap)
Beast: Log Analyzer + JS crawler (raw vs rendered) + 16mo GSC + GA4 + AI Visibility
(ChatGPT/Perplexity pick-up/ignore) + Bot Dynamics + fake-bot 40+ types + MCP +
AI Internal Linker (30% claim) + real-time Nginx/S3/Vercel, no line cap.
We win: privacy (100% client-side, audited no XHR/WebSocket), $0 instant, DPDP/RBI-safe.
We lose BAD on: historical trending, JS-at-scale, alerts, seats, 10–100M crawls.
v2 closes: Bot Dynamics + tickets + GSC overlay, gap harness, MCP server,
BQ streaming — but still triage-first, not always-on. Own that lane.

### Botify / OnCrawl / Lumar (€49–2500/mo)
500M lines/day, segments, cloud + GDPR FTP, procurement required. Triple-join kings:
crawled-never-indexed + indexed-never-crawled + in-sitemap-never-crawled. v1.4 added
`joinTriple()`; v2 adds GSC-click overlay + ticket text. They still win on
log+crawl+conversions unified + SSO/audit.

### Cloudflare AI Crawl Control (free, 2026) — the real competitor
Post-July-2026: blocks training + agent by default on ad pages (Sept 15), allows
search-only. Categories training/search/agent. Pay Per Crawl beta: 402 +
crawler-price / exact / max-price, Web Bot Auth signing, Discovery API, dynamic
pricing via origin header or Workers. BotBase public DB. Analytics with robots
violations.
v2 maps 1:1: Sept preset + WAF + diff (`genSept2026Defaults`), PPC v2
(`genPayPerCrawlV2` + `calcPayPerCrawlRecovery`), Web Bot Auth detect + batch,
BotBase 14th source, crawlers.json bundle. Not live-synced (no backend by design).

Verdict: best $0 triage tool. Not a JetOctopus replacement for monitoring. Own it.

## 3. Moat to keep
100% client-side + audit language (SOC2-irrelevant-by-design). Training/Search/User
split + OAI-AdsBot allow-list. UNVERIFIED spoof KPI + stealth 0–100 (challenge ≥70,
never auto-block — Perplexity Aug-2025 Chrome-UA + rotating ASN story). Render Gap
3b (AI 200s <5KB + /_next/data/). Origin-vs-Edge toggle + ESTIMATE labeling.
Weekly fetch + pill (green <7d / amber <21d / red + last-good pin) + 14 sources + IPv6.

## 4. v2 additions (P0/P1 mapped)
P0-1 Sept defaults + BotBase · P0-2 PPC v2 dynamic (per-path, Worker, Discovery,
CFO $3,600/mo example) · P0-3 Web Bot Auth + batch top-20 DoH + dig bundle (Frog
verify-on-import parity) · P0-4 4-file bundle + consistency checker · P0-5 gap
harness + killers (GEO without lying) · P0-6 MCP (`tools/mcp-server.js`,
analyzeLogs/getBotPolicy/genEdgeRule, llms-full.txt grounding) · P1-7 Dynamics +
tickets + GSC overlay · P1-8 BQ streaming (Logpush→R2→Parquet COPY + daily
UNVERIFIED % scheduled query).

## 5. Removals/fixes (v2)
`server.js` → `dev-server.js` (Pages-only bold). `ai_citation` deleted
(identity + `migrateLegacyTier`). 10-tab thinned (merged + collapsed, keyboard 1–0
kept). Crawl-to-referral disclaimer ON the Matrix card (CFO-screenshot-safe).
Fallback pin + banner surfaced. Guess-mode BLOCKS edge rules.

## 6. Data analysis CNRS (how to read numbers)
- Always quote measured + interval + stride + window. Example: "$2.61 total
  ($0.25 blockable) on 320k sampled 1-in-10 of 3.2M, 95% ±$X, 2026-09 window."
- Spoof: UNVERIFIED % + top IPs + stealth ≥70 challenged, never auto-blocked.
- Render: shell count + bytes + /_next/data hits → SSR ticket, re-curl.
- WoW: summary.json weekly, `diffAnalyses` + `genBotDynamics`, correlate deploys.
- Money: blockable = training + suspicious; search/user never blockable; PPC
  recovery = training × price, ranges only.

## 7. Tracking (real-life, real-time, no backend)
Browser: Live bar re-analyzes last upload on interval (no polling). CLI: `--exact`
nightly cron → summary.json history. BQ: scheduled UNVERIFIED % query. All outputs
are files you own — no phone-home, verified by audit (no XHR/WebSocket/sendBeacon).
