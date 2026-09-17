# EXPECTED — sample-10k.jsonl (seed 42, 10,000 lines, 30% bots, 30-day window)

Regenerate: `node tools/gen-logs.js --lines 10000 --bots 0.3 --seed 42 --days 30 --out sample-data/sample-10k.jsonl`
(byte-identical: same SHA256 on re-run — verified 2026-09-17)
Engine: v2.2.0 · Bot DB v2026.09.17 (127 signatures) · IP JSON 2026-09-17 (full CIDRs + IPv6)

- Records: 10000
- Bytes: 357.35 MB
- Human: 69.9% | Bot: 30.1%
- Tiers: human=6993, search_engine=616, ai_training=1210, ai_search_index=673, ai_user_fetch=324, seo_tool=184
- Total cost (CloudFront defaults, compute OFF): $0.04 | Blockable: $0.00 ($0.0046, training only)
- (v1.1.x pinned $0.08 / $0.01 with the old invented SSR $0.005/1K; v1.2.0 removed it — origin-compute is opt-in, OFF by default. Egress+request math unchanged.)
- Edge rules: 9 cloudflare / 4 fastly / 4 aws
- Threats: 659 | Traps: 8
- (v2.1 generator realism: diurnal ~3x peak 10am–4pm, weekend −30%, Pareto IPs, GET 92.8% / HEAD 4.1% / POST 2.1%, Chrome Win 65% of humans, 5% real 66.249.66.x Googlebot for the VERIFIED path, scattered TTFB. The old flat fixture — uniform humans/methods/referrers, 10% PUT+DELETE — is gone.)

## Top bots

| Bot | Requests | MB | Tier |
|-----|----------|----|------|
| Human Browser (Chrome on Windows) | 4560 | 161.5 MB | human |
| Human Browser (Safari on macOS) | 884 | 30.2 MB | human |
| Human Browser (Mobile Chrome) | 692 | 24.5 MB | human |
| Human Browser (Safari on iPhone) | 418 | 15.1 MB | human |
| Googlebot | 385 | 14.2 MB | search_engine |
| Bytespider | 366 | 12.6 MB | ai_training |
| CCBot | 363 | 13.7 MB | ai_training |
| GPTBot | 351 | 12.5 MB | ai_training |
| PerplexityBot | 251 | 9.7 MB | ai_search_index |
| OAI-SearchBot | 234 | 8.1 MB | ai_search_index |
| Bingbot (strict) | 231 | 8.4 MB | search_engine |
| Human Browser (Safari on iPad) | 229 | 8.0 MB | human |

Reviewer check: load `?sample=10k`, confirm GPTBot lands in ai_training (blockable),
OAI-SearchBot/PerplexityBot in ai_search_index (rate-limit only), ChatGPT-User in
ai_user_fetch (observe, never block).

Reviewer check (v1.3.0): DeepSeekBot/QwenBot/Timpibot/Sidetiq/Firecrawl/BrightData →
ai_training (blockable); MistralAI-Search → ai_search_index (120/min, never block);
PetalBot → search_engine (allow). `/shop?add-to-cart=` / `?variant=` / `/_next/data/`
→ trap table; `/.well-known/` / `/vendor/phpunit` / `/actuator/env` → threat table.
`ai_citation` must not appear as a tier anywhere (legacy alias → ai_search_index).
