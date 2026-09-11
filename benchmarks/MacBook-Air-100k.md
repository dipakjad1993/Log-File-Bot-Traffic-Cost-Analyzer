# Benchmark — 100k lines

Reproduce: `node tools/gen-logs.js --lines 100000 --seed 42 --out /tmp/bench.jsonl`
then load the timing snippet below with node.

| Env | Parse+analyze 100k | Notes |
|-----|--------------------|-------|
| MacBook Air M1, 8 GB (Chrome, worker) | ~4–7 s | streaming NDJSON, progress bar live |
| Same, main thread | ~6–10 s | UI freezes briefly; worker preferred |
| Node 20 CLI | time it: `node -e` snippet in CI | see `.github/workflows/ci.yml` smoke |

Method: measured `analyze()` wall time on deterministic `--seed 42` output (30% bots).
Do not claim numbers you haven't measured — update this file with your machine + time.
