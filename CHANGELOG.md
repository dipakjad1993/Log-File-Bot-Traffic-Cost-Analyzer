# Changelog

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
