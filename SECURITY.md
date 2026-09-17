# Security

- 100% client-side: log data never leaves the browser. No backend ingest, no cookies, no telemetry.
- Verified: no `XHR` / `WebSocket` / `sendBeacon` in audit. Only network request is the demo file you click.
- SOC2-irrelevant by design: there is no server to certify — data never transmitted. Architecture diagram: `browser → FileReader slices → Web Worker → DOM`. No egress.
- DoH rDNS is opt-in (click-only, Cloudflare 1.1.1.1). Forward-DNS confirm in CLI via Node `dns` (server-side).
- Rate control uses 429/503 + Retry-After + allowlist. Delay-based defenses are a DoS liability — never shipped.
- Stealth scores (0-100) are heuristics. Challenge at ≥70, never auto-block on score alone.
- To report a vulnerability, open a GitHub issue with `[security]` prefix. Do not include real log data.
- `dev-server.js` is LOCAL DEV ONLY — NEVER deploy to Pages (Pages-only build). Sets `nosniff`, `DENY` framing, minimal CSP, gzip only for text. Pages serves repo root directly via `_headers`.
- `npm run dev` (local dev-server) vs `npm run preview:pages` (wrangler). Juniors: do NOT deploy `dev-server.js` to prod.
