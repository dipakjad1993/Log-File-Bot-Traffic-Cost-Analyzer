# Security

- 100% client-side: log data never leaves the browser. No backend ingest, no cookies, no telemetry.
- To report a vulnerability, open a GitHub issue with `[security]` prefix. Do not include real log data.
- `server.js` sets `nosniff`, `DENY` framing, minimal CSP, and gzip only for text assets.
