# Contributing

1. Fork, branch from `main`, open a PR.
2. `npm run lint && npm test` must pass.
3. New bot signatures need: UA substring, tier (`ai_training` / `ai_search_index` / `ai_user_fetch` / `search_engine` / `seo_tool` / `monitoring` / `social` / `human`), `rateLimit`, and a test in `tests/bots.test.js`.
4. IP ranges: update via `npm run fetch-ips` (refreshes `data/bot-ips.json` date); never add short prefixes like `3.`/`34.`.
5. No log data in fixtures beyond synthetic generator output.
