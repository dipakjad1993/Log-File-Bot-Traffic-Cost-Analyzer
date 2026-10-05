#!/usr/bin/env node
/* Generate bots/index.html — searchable 127-signature DB with anchors.
 * Usage: node tools/gen-bots-page.js  (re-run after Bot DB edits) */
const fs = require('fs');
const path = require('path');
const A = require('../js/analyzer.js');

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escH = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rows = [...A.BOTS].sort((a, b) => a.n.localeCompare(b.n)).map(b => {
  const pol = (A.RATE_POLICY && A.RATE_POLICY[b.tier]) || null;
  return { ...b, id: slug(b.n), policy: pol ? `${pol.action} — ${pol.limit}` : '' };
});

const tiers = ['ai_training', 'ai_search_index', 'ai_user_fetch', 'search_engine', 'social', 'seo_tool', 'monitoring'];
const tierName = t => ({ ai_training: 'Training — block freely', ai_search_index: 'Search-index — allow', ai_user_fetch: 'User-triggered — do not throttle', search_engine: 'Search engines', social: 'Social / link previews', seo_tool: 'SEO tools', monitoring: 'Monitoring' }[t] || t);

let body = '';
for (const t of tiers) {
  const list = rows.filter(b => b.tier === t);
  if (!list.length) continue;
  body += `<h2>${escH(tierName(t))} (${list.length})</h2>\n<table class="dt"><thead><tr><th>Bot</th><th>Policy</th><th>Notes</th></tr></thead><tbody>\n`;
  for (const b of list) {
    body += `<tr id="${b.id}"><td><strong>${escH(b.n)}</strong><br><code>${escH(b.p)}</code></td><td>${escH(b.rateLimit || b.policy)}</td><td>${escH(b.note || '')}${b.citationRisk ? ` <em>Risk: ${escH(b.citationRisk)}.</em>` : ''}${b.verify ? ` <a href="${escH(b.verify)}">vendor list</a>` : ''}</td></tr>\n`;
  }
  body += '</tbody></table>\n';
}

const tierCount = t => rows.filter(b => b.tier === t).length;
const tierTable = tiers.map(t => `<tr><td><strong>${escH(tierName(t))}</strong></td><td class="n">${tierCount(t)}</td><td>${escH((((A.RATE_POLICY || {})[t]) || {}).action || 'allow')}${(((A.RATE_POLICY || {})[t]) || {}).limit ? ' — ' + escH(A.RATE_POLICY[t].limit) : ''}</td></tr>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Open Bot DB: 127 Signatures — Training vs Search vs User (2026)</title>
<meta name="description" content="Searchable bot signature database (127 sigs, v${A.BOT_DB_VERSION}): which AI crawlers to block, rate-limit, or never touch. Training 60/min, search-index 120/min, user-triggered do-not-block.">
<link rel="canonical" href="https://log-file-bot-traffic-cost-analyzer.pages.dev/bots/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../css/style.css?v=2.1.0">
</head>
<body><div class="main-wrap"><div class="card" style="max-width:960px">
<p class="crumbs"><a href="../">Analyzer</a> / Bot DB</p>
<h1>Open Bot DB — ${A.BOTS.length} signatures (v${A.BOT_DB_VERSION})</h1>
<p>Every signature the analyzer classifies by, with its edge policy and rate limit. <strong>Training = block freely (60/min).</strong> <strong>Search-index = allow at 120/min</strong> with 429 + Retry-After — never hard block. <strong>User-triggered = do not throttle.</strong> IP snapshot: <code>data/bot-ips.json</code> (14 vendor sources, full CIDRs + IPv6) dated ${A.BOT_IP_JSON_DATE}, refreshed weekly by automation. <a href="../?sample=10k">Test on the 10k demo</a>.</p>
<h2>DB composition — ${A.BOTS.length} signatures across 7 tiers</h2>
<div class="tbl-wrap"><table class="dt"><thead><tr><th>Tier</th><th>Signatures</th><th>Edge policy</th></tr></thead><tbody>
${tierTable}
</tbody></table></div>
<h2>How classification works (bot-first, longest-pattern-first)</h2>
<ul>
<li><strong>Bot signatures take precedence over browser fingerprints</strong> — a Chrome UA claiming to be GPTBot is still classified GPTBot (then flagged UNVERIFIED if the IP is not vendor-listed).</li>
<li><strong>Longest pattern wins:</strong> Applebot-Extended beats Applebot, GoogleOther-Image beats GoogleOther — training tokens are never shadowed by their parent crawlers.</li>
<li><strong>Google-Extended is a robots.txt token, not a UA</strong> — it never matches traffic, only the generated robots.txt.</li>
<li><strong>OAI-AdsBot is allow-listed</strong> — it verifies ChatGPT shopping checkouts; blocking it breaks ecommerce revenue checks.</li>
</ul>
<h2>4-layer verification (signals, not proof)</h2>
<ul>
<li><strong>1 · Vendor IP JSON</strong> (<code>data/bot-ips.json</code>, ${A.BOT_IP_JSON_DATE}, 14 sources + BotBase taxonomy, IPv6 + CIDR aware) — the only path to a VERIFIED badge.</li>
<li><strong>2 · TLS / protocol signals</strong> from log fields where present.</li>
<li><strong>3 · Cloud-ASN heuristic</strong> — /16-or-longer prefixes only, always labeled low-confidence (single-octet /8s removed).</li>
<li><strong>4 · Behavioral scoring</strong> — stealth detection (Chrome UA + cloud ASN) and the UNVERIFIED spoof KPI.</li>
</ul>
<p>Anthropic publishes no IP list, so ClaudeBot/Claude-SearchBot verify <strong>robots-first</strong> — any tool claiming IP verification for Claude is guessing. Confirm with server-side reverse DNS before blocking; the analyzer exports an rDNS checklist (Tab 2 · Verification).</p>
<h2>Measured on real logs</h2>
<p>10k pinned fixture (seed 42): 10,000 records, 69.9% human — GPTBot lands in training (blockable), OAI-SearchBot/PerplexityBot in search-index (rate-limit only), ChatGPT-User in user-fetch (observe, never block). 1.02 GB / 3.2M-line run: $2.61 total, $0.25 blockable (training only). Full numbers: <a href="../research/1gb-teardown.html">1GB teardown</a>.</p>
<h2>Search the DB</h2>
<p><input id="bot-q" placeholder="Filter: gptbot, perplexity, shopping…" aria-label="Filter bots" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-1);color:var(--text-1)"></p>
<div id="bot-db">
${body}
</div>
<h2>FAQ</h2>
<p><strong>Should I block OAI-SearchBot like GPTBot?</strong> No — blocking search-index drops ChatGPT citation share in 1–2 weeks. Block training freely instead.</p>
<p><strong>Why is PerplexityBot allowed?</strong> Best measured crawl-to-referral in class (~210:1). Rate-limit at 120/min, never hard block.</p>
<p><strong>Can I trust VERIFIED badges?</strong> Only vendor-IP-JSON matches. Prefix matches say "heuristic (low confidence)". Always confirm with server-side rDNS before blocking search engines.</p>
<p class="crumbs" style="margin-top:16px">See also: <a href="./gptbot-vs-oai-searchbot.html">GPTBot vs OAI-SearchBot</a> · <a href="./perplexitybot-block-or-allow.html">PerplexityBot</a> · <a href="./claudebot-no-ip-robots-only.html">ClaudeBot IPs</a> · <a href="../guides/compare-screaming-frog-jetoctopus-free.html">Tool comparison</a></p>
</div></div>
<script>
document.getElementById('bot-q').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  document.querySelectorAll('#bot-db tr[id]').forEach(tr=>{tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none';});
});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '..', 'bots', 'index.html'), html);
console.log(`wrote bots/index.html (${A.BOTS.length} bots)`);
