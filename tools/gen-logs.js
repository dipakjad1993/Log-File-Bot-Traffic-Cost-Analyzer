#!/usr/bin/env node
/* Realistic deterministic log generator v2.1 (seeded — same seed => byte-identical).
 * Usage: node tools/gen-logs.js --lines 10000 --bots 0.3 --seed 42 --days 30 --out sample-data/sample-10k.jsonl
 * Writes NDJSON to stdout (or --out file). Reproducible via --seed.
 *
 * v2.1 realism fixes (the old flat fixture fooled nobody):
 *  - diurnal traffic shape: ~3x peak 10am-4pm vs 3am trough (gaussian around 13:00)
 *  - weekend thinning: ~30% of Sat/Sun volume shifts to Friday (B2B shape)
 *  - power-law IPs: Pareto-ish — 1 heavy hitter ~12%, next 4 ~6% each, long tail rest
 *  - methods: GET 93% / HEAD 4% / POST 2% / PUT+DELETE+PATCH+OPTIONS 1%
 *  - humans: Chrome Win ~62%, Safari macOS ~12%, Mobile Chrome ~10%, iPhone ~6%,
 *    iPad ~3%, Linux ~3%, Edge ~2%, Firefox ~2%
 *  - 5% of bot lines use real Googlebot UA + 66.249.66.x IP so the VERIFIED /
 *    heuristic-match path actually demos (rest stay spoof-shape residential)
 *  - referrers: google long-tail dominant, social/reddit tail, most direct (empty)
 *  - TTFB: scattered log-normal per tier (humans ~120ms scattered, bots tiered+wide)
 */
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
const DAYS = Math.max(1, parseInt(opt('--days', '30'), 10));
const OUT = opt('--out', '');

const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
// Weighted pick: weights array parallel to arr
function wpick(arr, weights) {
  let r = rnd(), acc = 0;
  for (let i = 0; i < arr.length; i++) { acc += weights[i]; if (r <= acc) return arr[i]; }
  return arr[arr.length - 1];
}
// Power-law IP pool: index 0 = heavy hitter (~12%), 1-4 = mid (~6% each), rest = tail
function buildIpPool(n) {
  const pool = [];
  for (let i = 0; i < n; i++) pool.push(`${1 + Math.floor(rnd() * 223)}.${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}.${1 + Math.floor(rnd() * 254)}`);
  return pool;
}
function paretoIp(pool) {
  const r = rnd();
  if (r < 0.12) return pool[0];
  if (r < 0.36) return pool[1 + Math.floor(rnd() * Math.min(4, pool.length - 1))];
  return pool[Math.min(pool.length - 1, 5 + Math.floor(rnd() * Math.max(1, pool.length - 5)))];
}
// Diurnal hour: gaussian bump around 13:00 over a 1.0 floor => ~3.2x peak/trough
const HOUR_W = [];
for (let h = 0; h < 24; h++) HOUR_W.push(1 + 2.2 * Math.exp(-((h - 13) ** 2) / (2 * 3.2 ** 2)));
const HOUR_SUM = HOUR_W.reduce((a, b) => a + b, 0);
const HOUR_P = HOUR_W.map((w) => w / HOUR_SUM);
function diurnalHour() {
  let r = rnd(), acc = 0;
  for (let h = 0; h < 24; h++) { acc += HOUR_P[h]; if (r <= acc) return h; }
  return 13;
}

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
const BOT_W = [3, 3, 2, 2, 2, 2, 1.5, 1.5, 1, 3, 1.5, 1]; // GPTBot/CCBot/Bytespider heavier
const BOT_WSUM = BOT_W.reduce((a, b) => a + b, 0);
function botUa() {
  let r = rnd() * BOT_WSUM;
  for (let i = 0; i < BOT_UAS.length; i++) { r -= BOT_W[i]; if (r <= 0) return BOT_UAS[i]; }
  return BOT_UAS[0];
}
// Human UA mix: Chrome Win dominates like the real web
const HUMAN_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
];
const HUMAN_W = [0.36, 0.26, 0.12, 0.10, 0.06, 0.03, 0.03, 0.02, 0.02]; // Chrome Win = 62%
function humanUa() { return wpick(HUMAN_UAS, HUMAN_W); }

const URLS = ['/', '/pricing', '/blog/seo-guide-2026', '/products/widget-pro',
  '/shop/filter?color=blue&size=xl&sort=price&page=12', '/search?q=bot+detection&utm_source=x',
  '/api/products?limit=50&offset=500', '/.env', '/wp-login.php', '/calendar/2026/01'];
// Referrer long-tail: mostly direct (''), google dominant among non-empty
const REFERRERS = ['', '', '', '', '', '',
  'https://www.google.com/search?q=bot+traffic+cost', 'https://www.google.com/',
  'https://www.bing.com/search?q=log+analyzer', 'https://www.facebook.com/',
  'https://t.co/xyz', 'https://www.reddit.com/r/SEO/', 'https://news.ycombinator.com/',
  'https://www.linkedin.com/feed/', 'https://duckduckgo.com/?q=crawl+budget'];
function method() {
  const r = rnd();
  if (r < 0.93) return 'GET';
  if (r < 0.97) return 'HEAD';
  if (r < 0.99) return 'POST';
  return pick(['PUT', 'DELETE', 'PATCH', 'OPTIONS']);
}
// Scattered TTFB: log-normal-ish around tier center (no more flat 129ms rows)
function ttfb(isBot, ua) {
  const center = !isBot ? 0.12 : /Googlebot|bingbot/i.test(ua) ? 0.35 : /GPTBot|Bytespider|CCBot/i.test(ua) ? 0.7 : 0.45;
  const v = center * Math.exp((rnd() + rnd() + rnd() - 1.5) * 1.1);
  return +Math.max(0.02, v).toFixed(3);
}

const humanPool = buildIpPool(500);
const botPool = buildIpPool(120);
const VERIFIED_GOOGLE_IPS = ['66.249.66.1', '66.249.66.45', '66.249.66.128', '66.249.68.10', '66.249.64.5'];
const GOOGLE_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const base = Date.UTC(2026, 5, 1, 0, 0, 0); // 2026-06-01 UTC; --days window
function makeLine() {
  const isBot = rnd() < BOT_FRAC;
  let ua, ip;
  if (isBot) {
    // 5% of bot lines: genuine-shape Googlebot (VERIFIED-path demo)
    if (rnd() < 0.05) { ua = GOOGLE_UA; ip = pick(VERIFIED_GOOGLE_IPS); }
    else { ua = botUa(); ip = paretoIp(botPool); }
  } else { ua = humanUa(); ip = paretoIp(humanPool); }
  const uri = isBot && rnd() < 0.4 ? pick(URLS.slice(4)) : pick(URLS.slice(0, 4));
  const status = uri.startsWith('/.') || uri.includes('wp-') ? 404 : rnd() < 0.9 ? 200 : 301;
  // Diurnal timestamp + weekend thinning (30% of Sat/Sun shifts to Friday)
  let day = Math.floor(rnd() * DAYS);
  const dow = (new Date(base + day * 86400000).getUTCDay());
  if ((dow === 0 || dow === 6) && rnd() < 0.3) day = Math.max(0, day - (dow === 0 ? 2 : 1));
  const hour = diurnalHour();
  const ts = new Date(base + day * 86400000 + hour * 3600000 + Math.floor(rnd() * 3600000));
  return JSON.stringify({
    ClientIP: ip,
    Timestamp: ts.toISOString(),
    RequestURI: uri,
    RequestMethod: method(),
    HttpStatus: status,
    Bytes: status === 301 ? 200 : 500 + Math.floor(rnd() * rnd() * 160000), // right-skewed sizes
    UserAgent: ua,
    Referer: isBot ? '' : pick(REFERRERS),
    RequestTime: ttfb(isBot, ua),
    CacheStatus: rnd() < 0.4 ? 'HIT' : 'MISS',
    TLSProtocol: 'TLSv1.3',
  });
}
// Batched generate+write: peak memory is one 20k-line batch, so 1GB+ is safe.
async function main() {
  const PER = 20000;
  let ws = null;
  if (OUT) ws = fs.createWriteStream(OUT);
  async function emitBatch(batch) {
    const data = batch.join('\n') + '\n';
    if (!OUT) {
      if (!process.stdout.write(data)) await new Promise((r) => process.stdout.once('drain', r));
      return;
    }
    if (!ws.write(data)) await new Promise((r) => ws.once('drain', r));
  }
  let batch = [];
  for (let i = 0; i < LINES; i++) {
    batch.push(makeLine());
    if (batch.length >= PER) { await emitBatch(batch); batch = []; }
  }
  if (batch.length) await emitBatch(batch);
  if (ws) await new Promise((r) => ws.end(r));
  if (OUT && LINES > 500000) process.stderr.write(`gen-logs: wrote ${LINES} lines to ${OUT}\n`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
