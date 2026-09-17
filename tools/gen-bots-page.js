#!/usr/bin/env node
/* Generate bots/index.html — searchable 75-signature DB with anchors.
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

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Open Bot DB: 75 Signatures — Training vs Search vs User (2026)</title>
<meta name="description" content="Searchable bot signature database: which AI crawlers to block, rate-limit, or never touch. Training 60/min, search-index 120/min, user-triggered do-not-block.">
<link rel="canonical" href="https://log-file-bot-traffic-cost-analyzer.pages.dev/bots/">
<link rel="stylesheet" href="../css/style.css">
</head>
<body><div class="main-wrap"><div class="card" style="max-width:960px">
<p class="crumbs"><a href="../">Analyzer</a> / Bot DB</p>
<h1>Open Bot DB — ${A.BOTS.length} signatures (v${A.BOT_DB_VERSION})</h1>
<p>Training = block freely (60/min). Search-index = allow at 120/min with 429 + Retry-After — never hard block. User-triggered = do not throttle. IP snapshot: <code>data/bot-ips.json</code> dated ${A.BOT_IP_JSON_DATE}, refreshed weekly. <a href="../?sample=10k">Test on the 10k demo</a>.</p>
<p><input id="bot-q" placeholder="Filter: gptbot, perplexity, shopping…" aria-label="Filter bots" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-1);color:var(--text-1)"></p>
<div id="bot-db">
${body}
</div>
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
