const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

// 2026 split: training vs search-index vs user-triggered
const EXPECTED = {
  'GPTBot/1.0 (+https://openai.com/gptbot)': 'ai_training',
  'CCBot/2.0 (+https://commoncrawl.org/faq/)': 'ai_training',
  'Bytespider/5.0': 'ai_training',
  'ClaudeBot/1.0 (+https://anthropic.com/claudebot)': 'ai_training',
  'cohere-ai/1.0': 'ai_training',
  'AI2Bot/1.0': 'ai_training',
  'OAI-SearchBot/1.0 (+https://openai.com/searchbot)': 'ai_search_index',
  'PerplexityBot/1.0 (+https://docs.perplexity.ai)': 'ai_search_index',
  'Claude-SearchBot/1.0': 'ai_search_index',
  'DuckAssistBot/1.0': 'ai_search_index',
  'ChatGPT-User/1.0': 'ai_user_fetch',
  'Perplexity-User/1.0': 'ai_user_fetch',
  'Claude-User/1.0': 'ai_user_fetch',
  'MistralAI-User/1.0': 'ai_user_fetch',
  'Google-Agent/1.0': 'ai_user_fetch',
  'OAI-AdsBot/1.0': 'search_engine',
  'GoogleOther/1.0': 'ai_training',
  'GoogleOther-Image/1.0': 'ai_training',
  'ImageSiftBot/1.0': 'ai_training',
  'DeepSeekBot/1.0': 'ai_training',
  'QwenBot/1.0': 'ai_training',
  'Timpibot/1.0': 'ai_training',
  'Sidetiq/1.0': 'ai_training',
  'Firecrawl/1.0': 'ai_training',
  'BrightData/1.0': 'ai_training',
  'MistralAI-Search/1.0': 'ai_search_index',
  'PetalBot/1.0': 'search_engine',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)': 'search_engine',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36': 'human',
};

test('bot DB version pinned', () => {
  assert.equal(A.BOT_DB_VERSION, '2026.09.17');
  assert.ok(A.BOTS.length >= 120, `want 120+ signatures, got ${A.BOTS.length}`);
});

for (const [ua, tier] of Object.entries(EXPECTED)) {
  test(`classify ${ua.slice(0, 40)}... => ${tier}`, () => {
    assert.equal(A.classifyBot(ua).tier, tier);
  });
}

test('user-triggered bots carry do-not-block rate policy', () => {
  assert.match(A.classifyBot('ChatGPT-User/1.0').rateLimit, /no-throttle/i);
  assert.match(A.classifyBot('Perplexity-User/1.0').rateLimit, /no-throttle/i);
});

test('training bots carry 60/min policy', () => {
  assert.match(A.classifyBot('GPTBot/1.0').rateLimit, /60\/min/);
});

test('search-index bots carry 120/min policy', () => {
  assert.match(A.classifyBot('OAI-SearchBot/1.0').rateLimit, /120\/min/);
});

test('longest-pattern-first: Applebot-Extended beats Applebot', () => {
  const c = A.classifyBot('Mozilla/5.0 (compatible; Applebot-Extended/1.0; +https://www.apple.com/go/applebot-extended)');
  assert.equal(c.tier, 'ai_training');
});

test('OAI-AdsBot is allow-listed, never blocked', () => {
  const c = A.classifyBot('OAI-AdsBot/1.0 (+https://openai.com/adsbot)');
  assert.equal(c.tier, 'search_engine');
  assert.match(c.note || c.rateLimit || 'allow ceiling', /do not block|allow|ceiling/i);
});

test('IPv4 CIDR matcher: 40.88.0.1 in 40.88.0.0/16, outside 40.89.0.0/16', () => {
  assert.ok(A.ipInCidr('40.88.0.1', '40.88.0.0/16'));
  assert.ok(!A.ipInCidr('40.89.0.1', '40.88.0.0/16'));
  assert.ok(A.ipInCidr('40.88.5.5', '40.88.'));
  assert.equal(A.normalizeIP('[2600:1400:1::1]'), '2600:1400:1::1');
  assert.ok(A.ipMatchesAny('2600:1400:1::1', ['2600:1400:']));
});

test('vendor IP JSON verifies via CIDR, not just prefix', () => {
  const db = [{ prefixes: ['40.88.0.0/16'], bots: ['gptbot'], date: '2026-09-01', source: 'test' }];
  const v = A.verifyBot({ ip: '40.88.123.45', uri: '/', tls: '', cache: '' }, { name: 'GPTBot', tier: 'ai_training' }, db);
  assert.equal(v.dns.s, 'verified');
});

test('bot-first order: spoofed browser UA still classified as bot', () => {
  const c = A.classifyBot('Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 GPTBot/1.0');
  assert.equal(c.tier, 'ai_training');
});

test('short-prefix IPs are heuristic-only, not verified', () => {
  const v = A.verifyBot({ ip: '104.16.9.9', uri: '/', tls: '', cache: '' }, { name: 'Googlebot', tier: 'search_engine' });
  assert.notEqual(v.asn.s, 'verified');
  assert.match(v.asn.d, /low confidence/i);
});

test('parseTime handles apache / epoch / w3c', () => {
  assert.ok(A.parseTime('10/Oct/2000:13:55:36 -0700') instanceof Date);
  assert.ok(A.parseTime('1725540000') instanceof Date);
  assert.ok(A.parseTime('2026-09-01 10:00:00') instanceof Date);
  assert.equal(A.parseTime('not-a-date'), null);
});

test('combined-log line parses', () => {
  const r = A.parseCombinedLine('127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /a.gif HTTP/1.0" 200 2326 "-" "Mozilla/5.0"');
  assert.equal(r.request_uri, '/a.gif');
  assert.equal(r.status, '200');
});

test('OAI-SearchBot vs GPTBot independence (no prefix shadowing)', () => {
  const s = A.classifyBot('OAI-SearchBot/1.0 (+https://openai.com/searchbot)');
  const g = A.classifyBot('GPTBot/1.0 (+https://openai.com/gptbot)');
  assert.equal(s.tier, 'ai_search_index');
  assert.equal(g.tier, 'ai_training');
  assert.notEqual(s.name, g.name);
});

test('v2: ai_citation removed — normalizeTier is identity, migrateLegacyTier handles old exports', () => {
  assert.equal(A.normalizeTier('ai_citation'), 'ai_citation');
  assert.equal(A.normalizeTier('ai_training'), 'ai_training');
  assert.ok(!A.RATE_POLICY.ai_citation, 'legacy alias removed from RATE_POLICY');
  const old = { tier: 'ai_citation', nested: [{ tier: 'ai_citation' }] };
  const r = A.migrateLegacyTier(old);
  assert.equal(r.migrated, 2);
  assert.equal(old.tier, 'ai_search_index');
});

test('IPv6 + full-CIDR verification (no /16 truncation)', () => {
  assert.ok(A.ipInCidr('40.88.220.5', '40.88.220.0/24'));
  assert.ok(!A.ipInCidr('40.88.221.5', '40.88.220.0/24'));
  assert.ok(A.ipInCidr('2603:1030:1::5', '2603:1030:'));
  const db = [{ prefixes: ['40.88.220.0/24'], bots: ['gptbot'], date: '2026-09-13', source: 'openai.com/gptbot.json' }];
  const v = A.verifyBot({ ip: '40.88.220.5', uri: '/', tls: '', cache: '' }, { name: 'GPTBot', tier: 'ai_training' }, db);
  assert.equal(v.dns.s, 'verified');
  const v2 = A.verifyBot({ ip: '40.88.221.5', uri: '/', tls: '', cache: '' }, { name: 'GPTBot', tier: 'ai_training' }, db);
  assert.notEqual(v2.dns.s, 'verified');
});
