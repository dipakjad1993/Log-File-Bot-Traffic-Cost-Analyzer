# Open Bot DB — 75 signatures, training vs search-index vs user-triggered (v2026.09.13)

Machine-readable snapshot: [`data/bot-ips.json`](data/bot-ips.json) (dated 2026-09-13, full CIDRs + IPv6, refreshed weekly by GitHub Actions). Engine: `js/analyzer.js` (`BOTS`, 75 entries).

## Rule of thumb

| Class | Examples | Edge action |
|-------|----------|-------------|
| **Training — block freely** | GPTBot, ClaudeBot, CCBot, Bytespider, cohere-ai, AI2Bot, Google-Extended (token), GoogleOther, ImageSiftBot, DeepSeekBot, QwenBot, Timpibot, Sidetiq, Firecrawl, Bright Data | 60/min (20 aggressive), challenge/block |
| **Search-index — ALLOW** | OAI-SearchBot (85:1), PerplexityBot (210:1), Claude-SearchBot (~5,143:1), DuckAssistBot, YouBot, BraveBot, Amazonbot, MistralAI-Search | 120/min (60 aggressive), 429 + Retry-After only — never hard block |
| **User-triggered — DO NOT throttle** | ChatGPT-User, Perplexity-User, Claude-User, MistralAI-User, Google-Agent | No throttle (300/min abuse ceiling only); ChatGPT-User ignores robots ~54% |
| **Allow-listed specials** | OAI-AdsBot (ChatGPT shopping checks), PetalBot | Allow — blocking breaks revenue/crawl |

## 2026 edge cases

- **OAI-AdsBot:** allow or you break ChatGPT shopping surfaces.
- **ChatGPT-User:** user-triggered live browse — 429 = missing live answer.
- **ClaudeBot / Claude-SearchBot:** Anthropic publishes no IP list → robots.txt only, never IP verdicts.
- **Verification:** vendor-IP-JSON match = VERIFIED; `/16`-or-longer prefix = heuristic low-confidence; single-octet `/8` never used.

Refresh: `npm run fetch-ips` (OpenAI gptbot/searchbot, Perplexity; Anthropic intentionally robots-only).
