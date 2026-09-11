#!/usr/bin/env node
/* Deterministic sample-log generator: npm run gen-logs -- --lines 10000 --bots 0.3 --seed 42
 * Writes NDJSON to stdout (redirect to sample-data/sample-10k.jsonl). Reproducible via --seed. */
const fs = require('fs');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
}
const LINES = parseInt(opt('--lines', '10000'), 10);
const BOT_FRAC = parseFloat(opt('--bots', '0.3'));
const SEED = parseInt(opt('--seed', '42'), 10);
const OUT = opt('--out', '');

const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rip = () => `${1 + Math.floor(rnd() * 223)}.${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}.${1 + Math.floor(rnd() * 254)}`;

const BOT_UAS = [
  'GPTBot/1.0 (+https://openai.com/gptbot)',
  'CCBot/2.0 (+https://commoncrawl.org/faq/)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'PerplexityBot/1.0 (+https://docs.perplexity.ai)',
  'OAI-SearchBot/1.0 (+https://openai.com/searchbot)',
  'Claude-SearchBot/1.0 (+https://anthropic.com/claudebot)',
  'ChatGPT-User/1.0 (+https://openai.com/gptbot)',
  'Perplexity-User/1.0 (+https://docs.perplexity.ai)',
  'Bytespider/5.0',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'python-requests/2.31.0',
];
const HUMAN_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];
const URLS = ['/', '/pricing', '/blog/seo-guide-2026', '/products/widget-pro',
  '/shop/filter?color=blue&size=xl&sort=price&page=12', '/search?q=bot+detection&utm_source=x',
  '/api/products?limit=50&offset=500', '/.env', '/wp-login.php', '/calendar/2026/01'];

const base = Date.UTC(2026, 6, 25, 10, 0, 0);
const out = [];
for (let i = 0; i < LINES; i++) {
  const isBot = rnd() < BOT_FRAC;
  const ua = isBot ? pick(BOT_UAS) : pick(HUMAN_UAS);
  const uri = isBot && rnd() < 0.4 ? pick(URLS.slice(4)) : pick(URLS.slice(0, 4));
  const status = uri.startsWith('/.') || uri.includes('wp-') ? 404 : rnd() < 0.9 ? 200 : 301;
  out.push(JSON.stringify({
    ClientIP: isBot ? pick(['40.88.0.1', '35.192.0.1', '66.249.66.1', '34.102.136.180']) : rip(),
    Timestamp: new Date(base + i * 1000).toISOString(),
    RequestURI: uri,
    RequestMethod: 'GET',
    HttpStatus: status,
    Bytes: status === 301 ? 200 : 500 + Math.floor(rnd() * 80000),
    UserAgent: ua,
    Referer: '',
    RequestTime: +(0.05 + rnd() * 1.5).toFixed(3),
    CacheStatus: rnd() < 0.4 ? 'HIT' : 'MISS',
    TLSProtocol: 'TLSv1.3',
  }));
}
const data = out.join('\n') + '\n';
if (OUT) fs.writeFileSync(OUT, data);
else process.stdout.write(data);
