# EXPECTED — sample-10k.jsonl (seed 42, 10,000 lines, 30% bots)

Regenerate: `node tools/gen-logs.js --lines 10000 --bots 0.3 --seed 42 --out sample-data/sample-10k.jsonl`

- Records: 10000
- Bytes: 349.42 MB
- Human: 69.6% | Bot: 30.4%
- Tiers: human=6960, ai_training=1022, ai_user_fetch=503, seo_tool=258, search_engine=477, ai_search_index=780
- Total cost (CloudFront defaults): $0.08 | Blockable: $0.01
- Edge rules: 9 cloudflare / 4 fastly / 4 aws
- Threats: 558 | Traps: 8

## Top bots

| Bot | Requests | MB | Tier |
|-----|----------|----|------|
| Human Browser (Chrome on Windows) | 2331 | 81.6 MB | human |
| Human Browser (Safari on macOS) | 2321 | 80.3 MB | human |
| Human Browser (Safari on iPhone) | 2308 | 79.4 MB | human |
| Python-requests | 272 | 8.8 MB | ai_training |
| Bytespider | 272 | 9.2 MB | ai_training |
| Claude-SearchBot | 269 | 10.2 MB | ai_search_index |
| CCBot | 263 | 9.3 MB | ai_training |
| AhrefsBot | 258 | 9.7 MB | seo_tool |
| OAI-SearchBot | 257 | 9.4 MB | ai_search_index |
| PerplexityBot | 254 | 8.8 MB | ai_search_index |
| Perplexity-User | 253 | 9.0 MB | ai_user_fetch |
| Bingbot | 252 | 8.7 MB | search_engine |

Reviewer check: load `?sample=10k`, confirm GPTBot lands in ai_training (blockable),
OAI-SearchBot/PerplexityBot in ai_search_index (rate-limit only), ChatGPT-User in
ai_user_fetch (observe, never block).
