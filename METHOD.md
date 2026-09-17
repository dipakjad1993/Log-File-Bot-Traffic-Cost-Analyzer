# METHOD.md — how numbers are computed, and what they cannot prove

v2.0.0 · Bot DB v2026.09.17 (127 signatures) · IP JSON 2026-09-17 (14 sources incl. BotBase taxonomy)

## 1. Sampling math
- Browser path streams in 8MB slices, never holds the whole file as one string.
- `ANALYZE_CAP = 300000`. Estimated lines = size/400B. Stride = ceil(est/CAP).
- Gzip path decompresses via DecompressionStream, then systematic 1-in-N.
- Multi-file rotation merges then re-strides the MERGED set.
- Banner shows stride + kept/total + read ms. Costs describe the analyzed sample; scale ~Nx to full file.
- CLI `--exact` = no sampling (streaming aggregation, constant memory). Scale rule: browser <500MB, CLI 500MB-50GB, BigQuery 50GB+.

## 2. Cost formula
- `egress = bytes/1GiB × cdnEgress`, `requests = count/10k × request10K`, `compute = 2xx/1k × ssr1K` (opt-in, default 0).
- Blockable = training + suspicious/unknown ONLY. Search-index + user-fetch never blockable (asserted in tests).
- 95% interval: ±1.96/sqrt(N) on totals (Poisson approx). N = analyzed records. Scale-up widens by stride.
- Perturbation test: +1GiB on one record = +$0.09 exactly (CloudFront default).

## 3. Verification tiers
- Authoritative: vendor IP JSON (14 sources incl. BotBase taxonomy-only, full CIDRs + IPv6, ETag + fetched-date + last-good fallback pin). `VERIFIED via IP JSON` only on CIDR match.
- Heuristic low-confidence: /16-or-longer cloud prefixes (`104.16.` etc). Single-octet /8 removed. Never a verdict.
- Anthropic: crawling policy `claude.com/crawling/bots.json` (robots-first, no bare IPs) + forward-DNS confirm.
- Spoof KPI: claimed AI/search minus verified = UNVERIFIED (top KPI). Confirm with `dig -x` + forward resolve (DoH batch "Verify top 20" in-browser opt-in, `node tools/cli.js --verify-batch ip1,ip2` / `--verify-rdns IP` server-side). Web Bot Auth header (`cf-web-bot-auth`, surfaced as `wba` by `norm()`) counts as strong positive alongside IP JSON.
- Stealth score 0-100: Chrome-UA + cloud-ASN + velocity. Challenge at ≥70, never auto-block.

## 8. v2 enterprise notes (Sept-2026)
- Cloudflare Sept-15-2026 defaults: block training + agent on ad pages for new domains, allow search-only. Module 6 preset generates the exact WAF rule + diffs it against your logs. BotBase taxonomy is the 14th source (categories only, no IPs).
- Pay Per Crawl v2: per-path pricing (/ free, /premium/* $0.05, /api/* $0.25), origin `Crawler-Price` header + Worker dynamic pricing + `cf-pay-per-crawl` handling + Discovery checklist. CFO recovery model: training hits × price (search/user never charged). Ratios are ranges, not guarantees (see AI_MATRIX_DISCLAIMER, also printed on the AI Matrix card for screenshots).
- Policy bundle: robots.txt + llms.txt + /crawlers.json + /.well-known/security.txt with consistency checker (e.g. allow-in-robots vs block-at-edge, OAI-AdsBot revenue risk).
- Citation-gap closer: `genCitationGapCommands(url)` curl harness (GPTBot vs browser byte diff) + `detectCitationKillers(html)` static checks. Browser fetch is CORS-limited by design — curl is truth.
- MCP: `tools/mcp-server.js` (stdio JSON-RPC, no deps) exposes analyzeLogs / getBotPolicy / genEdgeRule; grounding via llms-full.txt.
- Bot Dynamics: `genBotDynamics()` spike/drop vs previous summary.json + `genTicketText()` 404-cluster auto-tickets + GSC clicks overlay. BQ streaming: Logpush → R2 → Parquet via DuckDB `COPY TO` + scheduled daily UNVERIFIED % query.
- v2 removals: `server.js` → `dev-server.js` (Pages-only, never deploy); `ai_citation` deleted (normalizeTier identity + migrateLegacyTier on load); Performance + Traffic merged, Security threats collapsed; guess-mode (W3C w/o #Fields) BLOCKS edge-rule generation.

## 4. Render Gap (JS-shell)
- AI bots fetch raw HTML, no JS. 200 + <5KB on content templates = shell, zero citation chance.
- Module 3b sorts AI-bot 200s by bytes ascending, flags <5KB, crosses `/_next/data/` + SSR signals.
- Confirm: `curl -A "GPTBot/1.0" URL | wc -c` vs browser body.

## 5. Edge-blindness
- Origin logs UNDERCOUNT when CDN filters at edge. Toggle Origin vs Edge/Logpush in Module 6.
- Edge-blocked estimate is labeled ESTIMATE, never mixed into measured totals.
- Pull edge truth via Cloudflare Logpush / S3 / R2 / ALB; schedule with n8n/Workers (see guides/cloudflare-logpush-1gb-analysis-free.html).

## 6. Limitations (read before quoting)
- Logs prove FETCH, not citation. Crawled ≠ cited. Use prompt-test list (top-50) to check ChatGPT/Perplexity manually. GEO v2 semantic check is a roadmap item, not a claim.
- UA matching is spoofable. Verification = signals. Confirm search BEFORE blocking.
- W3C without #Fields = low-confidence guess mode (flagged).
- Origin-compute stays OFF unless you know SSR/Workers $/1K.
- Log proves fetch, not render, not citation. Say it on every CFO slide.

## 7. Reproducibility
- `sample-data/EXPECTED.md` pins 10k fixture. CI re-verifies. `tools/gen-logs.js` deterministic (seed).
- `summary.json` export + `diffAnalyses(A,B)` for week-over-week (local only, no server).
