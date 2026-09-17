# Open Bot DB — 127 signatures, training vs search-index vs user-triggered (v2026.09.17)

Machine-readable snapshot: [`data/bot-ips.json`](data/bot-ips.json) (dated 2026-09-17, 14 sources incl. BotBase taxonomy, full CIDRs + IPv6, ETag + fetched-date, refreshed weekly by GitHub Actions, last-good pin fallback). Engine: `js/analyzer.js` (`BOTS`, 127 entries).

## Rule of thumb

| Class | Examples | Edge action |
|-------|----------|-------------|
| **Training — block freely** | GPTBot, ClaudeBot, CCBot, Bytespider, cohere-ai, AI2Bot, Google-Extended (token), GoogleOther (+Image/Video), ImageSiftBot, DeepSeekBot, QwenBot, Timpibot, Sidetiq, Firecrawl, Bright Data, ByteDance, DataForSEO* | 60/min (20 aggressive), challenge/block |
| **Search-index — ALLOW** | OAI-SearchBot (85:1), PerplexityBot (210:1), Claude-SearchBot (~5,143:1), DuckAssistBot, YouBot, BraveBot, Amazonbot, MistralAI-Search, Copilot, Meta-AI | 120/min (60 aggressive), 429 + Retry-After only — never hard block |
| **User-triggered — DO NOT throttle** | ChatGPT-User, Perplexity-User, Claude-User, Claude-Web, MistralAI-User, Google-Agent, NotebookLM, Gemini-Deep-Research | No throttle (300/min abuse ceiling only); ChatGPT-User ignores robots ~54% |
| **Allow-listed specials** | OAI-AdsBot (ChatGPT shopping checks), PetalBot, Barkrowler, Mojeek | Allow — blocking breaks revenue/crawl |

*DataForSEO/Ahrefs/Semrush = SEO tools: rate-limit, allowlist paying seats.

## 2026 edge cases

- **OAI-AdsBot:** allow or you break ChatGPT shopping surfaces.
- **ChatGPT-User:** user-triggered live browse — 429 = missing live answer.
- **ClaudeBot / Claude-SearchBot:** Anthropic crawling policy at `claude.com/crawling/bots.json` (robots-first, no bare IPs) + forward-DNS confirm.
- **Perplexity Aug 2025:** Chrome-UA + rotating ASNs after robots block — see UNVERIFIED spoof KPI + stealth score.
- **Verification:** vendor-IP-JSON match = VERIFIED; `/16`-or-longer prefix = heuristic low-confidence; single-octet `/8` never used.

Refresh: `npm run fetch-ips` (OpenAI x3, Perplexity x3, Anthropic policy, Google x2, Bing; Apple/Meta/ByteDance robots/ASN-only by design; BotBase taxonomy-only).

## Cloudflare BotBase mapping (Sept 2026)

| BotBase category | Our tier | Edge action |
|------------------|----------|-------------|
| AI Training | `ai_training` | Block freely @ 60/min (20 aggressive) |
| AI Search / Retrieval | `ai_search_index` | ALLOW @ 120/min, 429 + Retry-After only |
| AI Agent / Assistant fetch | `ai_user_fetch` | DO NOT throttle, 300/min abuse ceiling only |
| Search Engine | `search_engine` | Allow |
| SEO Tool | `seo_tool` | Rate-limit 60/min, allowlist paying seats |

## Cloudflare Sept-15-2026 defaults

New domains auto-block Training + Agent on ad pages, allow Search-only. In the app: Module 6 → "Apply Cloudflare Sept-2026 defaults" generates the exact WAF rule + diffs it against your current logs (training hits that would 403 vs search kept).
