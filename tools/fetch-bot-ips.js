#!/usr/bin/env node
/* Refresh data/bot-ips.json from vendor IP JSON endpoints. Usage: npm run fetch-ips
 * Anthropic publishes no IP list — Claude entries stay robots.txt-only by design. */
const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'log-file-analyzer/1.1' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(get(res.headers.location));
      if (res.statusCode !== 200) return reject(new Error(`${url} -> ${res.statusCode}`));
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function isIPv4(s){return /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(s);}
function isIPv6(s){return /^[0-9a-f:]+(\/\d{1,3})?$/i.test(s)&&s.includes(':');}
function prefixesOf(jsonText) {
  // P0 fix (v1.3.0): keep FULL CIDRs (/24 detail + IPv6), never truncate to /16.
  // Old code did split('.').slice(0,2) which threw away /24 detail and broke
  // verification precision. Vendor JSON already ships CIDRs — preserve them.
  try {
    const j = JSON.parse(jsonText);
    const out = [];
    const walk = (v) => {
      if (typeof v === 'string'){
        const s=v.trim();
        if(isIPv4(s)){out.push(s.includes('/')?s:s+'/32');}
        else if(isIPv6(s)){out.push(s);}
        else if(/^\d{1,3}\.\d{1,3}\./.test(s)){
          // bare prefix without mask (legacy vendor format) — keep as prefix hint
          out.push(s.replace(/\/\d+$/,''));
        }
      }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(j);
    return [...new Set(out)].slice(0, 200);
  } catch (e) { return []; }
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const defs = [
    { bot: 'GPTBot / ChatGPT-User', url: 'https://openai.com/gptbot.json', bots: ['gptbot', 'chatgpt-user'] },
    { bot: 'OAI-SearchBot', url: 'https://openai.com/searchbot.json', bots: ['oai-searchbot'] },
    { bot: 'PerplexityBot / Perplexity-User', url: 'https://docs.perplexity.ai/bot.json', bots: ['perplexitybot', 'perplexity-user'] },
  ];
  const sources = [];
  for (const d of defs) {
    try {
      const text = await get(d.url);
      sources.push({ ...d, prefixes: prefixesOf(text), date: today });
      console.log(`ok ${d.bot}: ${sources[sources.length - 1].prefixes.length} prefixes`);
    } catch (e) {
      console.log(`WARN ${d.bot}: ${e.message} (keeping shipped snapshot)`);
      sources.push({ ...d, prefixes: [], date: today, stale: true });
    }
  }
  sources.push({ bot: 'ClaudeBot / Claude-SearchBot', url: null, prefixes: [], bots: ['claudebot', 'claude-searchbot'], date: today, note: 'Anthropic publishes no IP list — verify via robots.txt compliance only.' });
  const out = { date: today, note: 'Regenerate with: npm run fetch-ips.', sources };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'bot-ips.json'), JSON.stringify(out, null, 2));
  console.log('wrote data/bot-ips.json');
})();
