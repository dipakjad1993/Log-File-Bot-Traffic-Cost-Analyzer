# Changelog

## Unreleased — sample-data v3 (in-app Download generator)

Enterprise-realistic downloadable samples at every size (1MB–1GB, same mix):
`genOneSample` rewrite in `js/analyzer.js` — 60+ bot categories (search
desktop/smartphone/image/video, 16 AI-training, 8 AI search-index, 5 AI
user-fetch, 8 SEO tools, 4 monitoring, 6 social, 5 generic scrapers, 2 faker
shapes), faceted-nav/pagination/sort/_next/data/cart traps, thin soft-404s,
410s, 304 revisits, 429 WAF, 500/502/503 + a fixed deploy-blip anomaly night
(2026-07-18), diurnal + weekend shape, Pareto IPs, verified-vs-spoof IP split
(66.249.x/13.107.x + residential fakers), IPv6 dual-stack, Host/vhost,
EdgeColo, content-aware cache/TLS/bytes/TTFB, cf_web_bot_auth on verified
lines, fixed 90-day window (Jun 03 → Sep 01). Scale-invariant weights:
1MB-vs-5MB tier shares within ~1%. Suite: 116 asserts, all green.

## v2.2.0 — 2026-09-17

P0 credibility pass: edge-rule threshold fix, AdsBot revenue guard, freshness 14d red, realistic fixture re-pin.

### Fixed (P0)
- `genEdgeRules` threshold `count>=10` → `count>=2 OR ≥0.5 req/min/IP` (training + suspicious). The old gate silently emitted ZERO training blocks on long windows and failed the asserted `count=3 → BLOCK` contract in `tests/costs.test.js`. GPTBot 1810 + Bytespider 1511 req windows now emit all 4 training BLOCKs; search stays 429-only, user-fetch allow-only.
- Freshness red at >14d (was 21d): pill + Module 2 + CI agree — green <7d, amber 7–14d, red stale with last-good fallback pin.
- "Start Monitoring / Interval" → "Re-analyze locally / Re-analyze locally every" (no fake live-tail implication).
- Removed the bottom site-footer block (privacy-audit line + Free/Pro upsell) and the inline "verified: no XHR/WebSocket/sendBeacon" dropzone claim from `index.html` — tool UI only, docs/audit claims in METHOD.md + SECURITY.md unchanged.

### Added
- OAI-AdsBot revenue guard: engine strips accidental block/challenge rules for OAI-AdsBot; Module 6 green guard card when AdsBot is in-window; `checkPolicyConsistency` REVENUE RISK on Disallow.
- KPI strip ingest card: origin-undercount warning + Logpush→R2 link (Module 6 keeps the origin/edge toggle).
- `tests/p0verdict.test.js`: 6 regression tests (training ≥2 fires ×4, search/user/suspicious policy, AdsBot guard, anomaly no-`Hour #167`/no-fake-z + `n>30` floor, freshness 14d red). Suite: 105 → 111 asserts, all green.
- v2.1 realistic fixture shipped: `tools/gen-logs.js` (diurnal ~3x, weekend −30%, Pareto IPs, GET 92.8%, Chrome Win 65%, 5% real 66.249.66.x Googlebot, scattered TTFB); `sample-data/sample-10k.jsonl` regenerated + `EXPECTED.md` re-pinned from measured output (10,000 records, 357.35 MB, $0.04 total, 9/4/4 rules; `--seed 42 --days 30` byte-identical, SHA256-verified).

## v2.0.0 — 2026-09-17

Enterprise-ready: all P0/P1 from the 2026 competitive review + removals.

### Added (P0)
- P0-1 Cloudflare Sept-15-2026 defaults: `genSept2026Defaults()` exact WAF rule + diff vs logs; BotBase taxonomy as 14th source (`BOTBASE_TAXONOMY`, `data/bot-ips.json`, `BOTS.md`, `fetch-bot-ips.js` taxonomy-only).
- P0-2 Pay Per Crawl v2: `genPayPerCrawlV2()` per-path pricing (/ free, /premium/* $0.05, /api/* $0.25), origin `Crawler-Price` header, dynamic Worker, `cf-pay-per-crawl` handling, Discovery checklist; `calcPayPerCrawlRecovery()` CFO model ("$0.02 × 180k = $3,600/mo").
- P0-3 Web Bot Auth + batch verify: `norm()` surfaces `wba`, `detectWebBotAuth()`, one-click "Verify top 20 UNVERIFIED" batch (`verifyTopUnverifiedBatch()` DoH) + `genBatchVerifyCommands()` dig bundle; CLI `--verify-batch`.
- P0-4 Policy bundle: `genCrawlersJson()` + `genSecurityTxt()` + `genPolicyBundle()` (robots + llms + crawlers.json + security.txt) + `checkPolicyConsistency()` (robots-vs-edge, OAI-AdsBot revenue risk); CLI `--bundle-dir`.
- P0-5 Citation-gap closer: `genCitationGapCommands()` curl harness + `detectCitationKillers()` + `fetchCitationGap()` (CORS-honest); Module 5 card + wiring.
- P0-6 MCP server: `tools/mcp-server.js` stdio JSON-RPC (analyzeLogs, getBotPolicy, genEdgeRule), grounding via llms-full.txt.
- P1-7 Bot Dynamics: `genBotDynamics()` + `genTicketText()` 404 auto-tickets + `overlayGscClicks()`; Module 8 rewrite.
- P1-8 BQ streaming: `genBQStreamingPack()` Logpush → R2 → Parquet `COPY TO` + scheduled daily UNVERIFIED %; CLI `--bq-streaming`.

### Removed / Fixed
- `server.js` → `dev-server.js` (Pages-only banner, package/Dockerfile/CI/README updated). Never deploy to Pages.
- `ai_citation` DELETED (v2): `normalizeTier()` is now identity; `migrateLegacyTier()` rewrites pre-v1.3 exports on load with a log. Tests + CI updated.
- Thinned tabs: short labels (Bots/Verification/Costs/AI Matrix/Edge + Policy Bundle/Performance + Traffic/Dynamics/CFO), Performance + Traffic merged, Security threats collapsed behind `<details>`.
- AI Matrix disclaimer (`AI_MATRIX_DISCLAIMER`) printed ON the card (screenshot-safe), not just METHOD.md.
- Freshness-or-death: `getFreshnessStatus()` + `FALLBACK_PIN` last-good banner (green <7d/amber <21d/red stale), surfaced in Module 2 + pill.
- Guess-mode guard: `isGuessMode()` + `guardEdgeRules()` — W3C without #Fields BLOCKS edge-rule generation (Module 6 refuses with notice).

## v1.4.0 — 2026-09-17

Enterprise pass: 127 signatures, JS-shell render gap, UNVERIFIED spoof KPI, anomaly ML-lite, CLI exact mode, BQ native pack, Origin-vs-Edge toggle, A/B diff.

### Added
- Bot DB v2026.09.17 (127 signatures): +52 incl. ByteDance/Douyin/TikTok, Copilot, Meta-AI, NotebookLM, Gemini-Deep-Research, Claude-Web, DataForSEO, Tollbit, Quillbot, Lumar/Sitebulb/ContentKing, Barkrowler/Mojeek, aiohttp/axios/node-fetch.
- Module 3b Render Gap: AI-bot 200s <5KB sorted ascending + /_next/data/ signals (GEO zero-citation hunt).
- UNVERIFIED spoof KPI (Module 2): claimed minus verified AI/search, post-Aug-2025 Chrome-UA shape.
- Anomaly ML-lite (Module 8): per-bot bursts (z≥3), 404-clusters, Slack digest + summary.json A/B diff.
- `tools/cli.js --exact`: 500MB-50GB streaming exact (constant memory) + --logs-csv + --bq-sql + --verify-rdns forward-DNS. Scale: browser <500MB, CLI 500MB-50GB, BQ 50GB+.
- `genBQPack()`: partitioned DDL + 7 waste queries + Download .sql. Parquet via DuckDB COPY (see BIGQUERY.md).
- Origin vs Edge toggle (Module 6) + edge-blocked ESTIMATE (never mixed into measured).
- `METHOD.md` (sampling/cost/verify/limits), `llms-full.txt` (127-sig grounding dump), sitemap lastmod automation.
- Header freshness pill (green <7d/amber <21d/red stale), SOC2-irrelevant language, keyboard 1-0 tabs, focus-trapped Pricing, lazy-render tabs 2-10, sticky dropzone + pre-drop mobile guard.
- Pro $49 pre-order live (Gumroad) — no more vaporware; CLI ships in v1.4.

### Fixed
- `fetch-bot-ips.js`: 11 endpoints (OpenAI x3, Perplexity x3, Anthropic policy, Google x2, Bing) + ETag/fetched-date/fallback. `bot-ips.json` 13 sources dated 2026-09-17.
- Anthropic copy updated: `claude.com/crawling/bots.json` robots-first (was "no IP list").
- `ai_citation` hidden from UI (code alias only in normalizeTier for pre-v1.3 exports).
- Render mirror removed (Pages-only). Version single-sourced (BOT_DB_VERSION → UI/README/bots/llms).
- `server.js` prod confusion: `npm run dev` vs `preview:pages` + NEVER-DEPLOY header.

## v1.3.0 — 2026-09-13

Bot DB v2026.09.13 (75 signatures) + verification precision + 2026 trap/threat coverage.

### Added
- 8 new 2026 signatures: DeepSeekBot, QwenBot (Alibaba), Timpibot, Sidetiq, Firecrawl, Bright Data (all `ai_training`, block freely), MistralAI-Search (`ai_search_index`, ALLOW @120/min), PetalBot/Huawei (`search_engine`, allow).
- 3 crawl traps (16 total): cart/variant combos (`add-to-cart`, `variant=`), Next.js `/_next/data/` routes, price-slider facets (`price_min/max`, `facet=`).
- 5 threat patterns (14 total): `.well-known`/`.svn` VCS probes, `/vendor/phpunit` + Laravel exposure, Spring `/env` endpoints, GraphQL/debug consoles, cloud-metadata SSRF (`169.254.169.254`).
- `normalizeTier()`: `ai_citation` legacy alias consolidated into `ai_search_index` everywhere (RATE_POLICY, crawlBudget, aiMatrix, edge rules, CF JSON, badges). Old exports still render.
- Repo-root `llms.txt` + Module 6 export card.
- A11y: `prefers-reduced-motion` disables pulse/transitions; live dot pulses ONLY while monitoring + shows last diff (`0 new (static snapshot)` vs changed).
- Mobile 50MB upload guard with CLI hint (sample-gen cap already existed).

### Fixed
- `tools/fetch-bot-ips.js`: `prefixesOf()` no longer truncates to `/16` via `split('.').slice(0,2)` — keeps full CIDRs (`40.88.220.0/24`) + IPv6 (`2603:1030::/36`), up to 200 entries.
- `data/bot-ips.json`: refreshed to 2026-09-13 in full-CIDR form; `verifyBot()` prints `source||url` + CIDR count instead of `undefined`.
- `tests/costs.test.js`: fixed nested-test structure (llms test was declared inside the edge-rules callback).
- Worker path: no longer wipes `_urlSet` with an empty Set (GSC join broke on 20k+ files); preserves full deduped URL set + shows W3C guess warning on worker path too.
- `robots.txt` + generated robots: trailing `User-agent: * Allow: /` now carries an RFC 9309 most-specific-wins comment so juniors don't misread it.
- Version consistency: package 1.3.0, sidebar v1.3.0, analyzer `?v=1.3.0`, worker `v=1.3.0`, BOT_DB v2026.09.13, IP JSON 2026-09-13 everywhere.

## v1.2.1 — 2026-09-13

- Fix: 1GB upload `Maximum call stack size exceeded` — the multi-file merge used `all.push(...r.records)`, spreading ~320k records as function arguments. Replaced with a plain loop + 300k-line regression test (`tests/upload.test.js`).
- Cache-bust bump (`analyzer.js?v=1.2.1`, worker) so browsers/CDN fetch the fixed bundle instead of the cached pre-fix one. If you still see the error: hard-refresh (Ctrl+Shift+R) — you are running old JS.

## v1.2.0 — 2026-09-13

Bot DB v2026.09.02 (67 signatures) + enterprise log plumbing + honest-cost fixes.

### Added
- New 2026 signatures: OAI-AdsBot (allow-listed — ChatGPT shopping revenue checks, never block on ecommerce), GoogleOther (+Image/Video, training), ImageSiftBot (training).
- Longest-pattern-first classification (Applebot-Extended now beats Applebot; whole class of prefix-shadowing bugs closed).
- IPv6 + CIDR matcher (`normalizeIP`/`ipInCidr`/`ipMatchesAny`): `40.88.0.0/16` ranges and `2600:` addresses verify correctly; vendor-IP-JSON checks use CIDR.
- Reverse-DNS checklist exporter (`dig -x` + forward-confirm commands for every claimed search/AI-search IP).
- `.gz` in-browser decompression (DecompressionStream, line-streamed) + multi-file rotation (`access.log + access.log.1 + access.log.2.gz` merge with re-striding).
- AWS ALB space-delimited parser + Cloudflare Logpush / ALB JSON field maps in `norm()`.
- `llms.txt` generator, Cloudflare AI Crawl Control JSON exporter, 402 Payment-Required / pay-per-crawl example (training pays, search/user bypass).
- Real GSC join: Pages CSV with Clicks/Impressions parsed, orphans priced with measured $/req, uncrawled sorted by clicks.
- GEO add-on: top-50 prompt-test list exporter (closes crawl-vs-citation gap).
- BigQuery/DuckDB bridge: `logs.csv` export (100k rows, bot+tier labeled) + sample SQL.
- 2026 crawl-to-referral table (OAI 85:1, Perplexity 210:1, Claude ~5,143:1 improved from 20,583:1).
- Deterministic in-browser sample generator (seeded mulberry32, default seed 20260901 — same bytes every run).
- Mobile 50MB sample cap with CLI hint; `aria-live` progress; `.gz` MIME in server.js.

### Fixed
- Removed single-octet `/8` cloud prefixes (`3.`/`34.`/`35.`/`18.`/`52.`/`54.`) — only `/16`-or-longer kept, still labeled low-confidence heuristics.
- Origin-compute cost is now opt-in (default $0, OFF): no log tells SSR vs static. Old `$0.005/1K` lives on as the "CloudFront + Lambda@Edge SSR (opt-in)" preset. 10k fixture: $0.08→$0.04 total.
- Verification counts on >50k files are scaled to the full set and labeled with the sampled base (no more 10k-reported-as-global).
- `_urlSet` is now the full deduped log-URL set (100k cap), built in `analyze()` — the GSC join never silently runs on a 20k slice.
- W3C without `#Fields` parses in flagged low-confidence guess mode with an on-screen warning (fail closed, not silent).
- Deleted tarpitting / poison-pill advice (DoS liability) — replaced with 429/503 + Retry-After + allowlist pattern.
- "50+ signatures" copy now renders the real count; sidebar badge v1.1.0→v1.2.0; OG image points at a real screenshot; `ai_citation` marked legacy alias.

## v1.1.1 — 2026-09-11

- Asset cache-bust (`analyzer.js?v=1.1.1`, worker + importScripts) so browsers fetch the streaming-upload code instead of a cached pre-fix bundle.

## v1.1.0 — 2026-09-11

Bot DB v2026.09: the 2026 interview split lands.

### Added
- Bot DB v2026.09.01: 64 signatures. New: Claude-SearchBot, Claude-User, Perplexity-User, ChatGPT-User policy, MistralAI-User, DuckAssistBot, cohere-ai, AI2Bot, Google-Agent, Meta-ExternalFetcher, `Google-Extended` robots-token entry.
- Three AI tiers with 2026 rate table: `ai_training` (60/min, 20 aggressive — block freely), `ai_search_index` (120/min, 60 aggressive — allow, citation loss in 1–2 wks if blocked), `ai_user_fetch` (no throttle, 300/min abuse ceiling — 429 = missing live answer).
- `data/bot-ips.json` (dated 2026-09-01) + `npm run fetch-ips` refresher (OpenAI gptbot/searchbot, Perplexity; Anthropic intentionally robots.txt-only).
- Apache Combined / Nginx default / W3C Extended / Cloudflare text parsing + `parseTime()` (apache timestamp, epoch sec/ms, W3C, ISO).
- `js/worker.js` Web Worker path for 20k+ rows; 50 MB browser guard with CLI fallback message.
- robots.txt generator (training Disallow vs search Allow + user-agent edge note) + Cloudflare AI Crawl Control mapping + 15 Sep 2026 auto-block warning.
- Copy buttons on all edge rules; Download CSV; CFO 1-pager (print-to-PDF, client-side, no deps).
- Crawl + GSC join MVP (orphan crawled-not-indexed / indexed-never-crawled).
- SEO: title/meta/OG/JSON-LD, `robots.txt` (dogfoods Allow for OAI-SearchBot), `404.html`.
- Dark mode, tab counts, keyboard-focus styles, mobile table scroll.
- `tools/gen-logs.js` deterministic generator (`npm run gen-logs -- --lines 10000 --seed 42`), `sample-data/sample-10k.jsonl` + `EXPECTED.md`, `sample-combined.log` fixture.
- Tests (`npm test`, 40+ asserts), GitHub Actions CI, Dockerfile, security headers + gzip in `server.js`.
- Streaming uploads: 8MB slices (no whole-file `readAsText`, so 1GB files load), systematic sampling capped at 300k records with an honest banner, resilient Combined regex (`-` request/bytes tolerated), real W3C `#Fields` parsing, cache-busted `analyzer.js?v=1.1.0`.

### Fixed
- Removed `3.`/`34.`-style short-prefix false positives: prefix matches relabeled heuristic (low confidence); verification verdicts require vendor IP JSON.
- Removed `REAL_BROWSERS` UA-length heuristic; documented bot-first classification order.
- Edge-rule thresholds were arbitrary (>50/>30, nothing for the 22-row demo): now ≥2 for training/search/suspicious, ≥1 for user-fetch (observe-only).
- Verification samples full data under 50k rows (was always capped at 10k).
- Live-monitor bar no longer implies backend polling: it re-analyzes the last upload locally on an interval.
- Pricing panel wired (presets for CloudFront/Cloudflare/Fastly/GCS + apply/reset actually re-analyze).

### Changed
- `?sample=10k` one-click demo autoload.
- Cost engine: blockable = training + suspicious/unknown only; search-index and user-fetch never blockable.
