#!/usr/bin/env node
/* Refresh data/bot-ips.json from vendor IP JSON endpoints. Usage: npm run fetch-ips
 * 2026-09-17 enterprise pass: 11 endpoints (OpenAI x3, Perplexity x3, Anthropic crawling
 * policy, Google x2, Bing x1) + ETag/fetched-date + failure fallback to shipped snapshot.
 * Apple/Meta/ByteDance publish no stable list — kept as robots/ASN-only by design. */
const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url, etag) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'log-file-analyzer/1.4' };
    if (etag) headers['If-None-Match'] = etag;
    https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(get(res.headers.location, etag));
      if (res.statusCode === 304) return resolve({ notModified: true, etag: res.headers.etag || etag, text: '' });
      if (res.statusCode !== 200) return reject(new Error(`${url} -> ${res.statusCode}`));
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ text: d, etag: res.headers.etag || null }));
    }).on('error', reject);
  });
}

function isIPv4(s){return /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(s);}
function isIPv6(s){return /^[0-9a-f:]+(\/\d{1,3})?$/i.test(s)&&s.includes(':');}
function prefixesOf(jsonText) {
  try {
    const j = JSON.parse(jsonText);
    const out = [];
    const walk = (v) => {
      if (typeof v === 'string'){
        const s=v.trim();
        if(isIPv4(s)){out.push(s.includes('/')?s:s+'/32');}
        else if(isIPv6(s)){out.push(s);}
        else if(/^\d{1,3}\.\d{1,3}\./.test(s)){ out.push(s.replace(/\/\d+$/,'')); }
      }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(j);
    return [...new Set(out)].slice(0, 400);
  } catch (e) { return []; }
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const snapPath = path.join(__dirname, '..', 'data', 'bot-ips.json');
  let prev = { sources: [] };
  try { prev = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch (e) {}
  const prevByUrl = {};
  for (const s of (prev.sources || [])) if (s.url) prevByUrl[s.url] = s;
  const defs = [
    { bot: 'GPTBot', url: 'https://openai.com/gptbot.json', bots: ['gptbot'] },
    { bot: 'OAI-SearchBot', url: 'https://openai.com/searchbot.json', bots: ['oai-searchbot'] },
    { bot: 'ChatGPT-User', url: 'https://openai.com/chatgpt-user.json', bots: ['chatgpt-user'] },
    { bot: 'PerplexityBot', url: 'https://www.perplexity.ai/perplexitybot.json', bots: ['perplexitybot'] },
    { bot: 'Perplexity-User', url: 'https://www.perplexity.ai/perplexity-user.json', bots: ['perplexity-user'] },
    { bot: 'PerplexityBot/User (docs legacy)', url: 'https://docs.perplexity.ai/bot.json', bots: ['perplexitybot', 'perplexity-user'] },
    { bot: 'ClaudeBots (crawling policy)', url: 'https://claude.com/crawling/bots.json', bots: ['claudebot', 'claude-searchbot', 'claude-user'], policyOnly: true },
    { bot: 'Googlebot', url: 'https://developers.google.com/search/apis/ipranges/googlebot.json', bots: ['googlebot'] },
    { bot: 'Google-Other / Special crawlers', url: 'https://developers.google.com/search/apis/ipranges/special-crawlers.json', bots: ['googleother'] },
    { bot: 'Bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', bots: ['bingbot'] },
  ];
  const sources = [];
  for (const d of defs) {
    const old = prevByUrl[d.url];
    try {
      const r = await get(d.url, old && old.etag);
      if (r.notModified) {
        sources.push({ ...d, prefixes: old.prefixes || [], date: old.date || today, fetched: today, etag: old.etag || null, notModified: true });
        console.log(`ok ${d.bot}: 304 not-modified (${(old.prefixes||[]).length} cached)`);
      } else {
        const pfx = d.policyOnly ? [] : prefixesOf(r.text);
        sources.push({ ...d, prefixes: pfx, date: today, fetched: today, etag: r.etag || null, source: d.url });
        console.log(`ok ${d.bot}: ${pfx.length} prefixes${d.policyOnly ? ' (policy-only, no bare IPs)' : ''}`);
      }
    } catch (e) {
      console.log(`WARN ${d.bot}: ${e.message} (fallback to shipped snapshot)`);
      sources.push({ ...d, prefixes: (old && old.prefixes) || [], date: (old && old.date) || today, fetched: today, stale: true, error: String(e.message) });
    }
  }
  sources.push({ bot: 'Applebot-Extended', url: null, prefixes: [], bots: ['applebot-extended'], date: today, note: 'Apple publishes no IP list — robots token only.' });
  sources.push({ bot: 'Meta-ExternalAgent', url: null, prefixes: [], bots: ['meta-externalagent'], date: today, note: 'Meta publishes no stable agent list — ASN + rDNS confirm.' });
  sources.push({ bot: 'Bytespider', url: null, prefixes: [], bots: ['bytespider'], date: today, note: 'ByteDance publishes no list — ASN + rDNS confirm.' });
  const out = { date: today, note: 'Regenerate with: npm run fetch-ips. Authoritative vendor IP JSON prefixes in FULL CIDR form (/24 detail + IPv6 preserved, never truncated to /16). Short-prefix heuristics in analyzer.js are low-confidence only.', freshnessPolicy: 'fail CI if >14 days old (see tests/freshness.test.js)', sources };
  fs.writeFileSync(snapPath, JSON.stringify(out, null, 2));
  console.log('wrote data/bot-ips.json');
})();
