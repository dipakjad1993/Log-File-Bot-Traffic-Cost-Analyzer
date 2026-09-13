# Changelog

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
