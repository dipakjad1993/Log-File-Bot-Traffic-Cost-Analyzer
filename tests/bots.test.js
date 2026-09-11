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
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)': 'search_engine',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36': 'human',
};

test('bot DB version pinned', () => {
  assert.equal(A.BOT_DB_VERSION, '2026.09.01');
  assert.ok(A.BOTS.length >= 60, `want 60+ signatures, got ${A.BOTS.length}`);
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

test('bot-first order: spoofed browser UA still classified as bot', () => {
  const c = A.classifyBot('Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 GPTBot/1.0');
  assert.equal(c.tier, 'ai_training');
});

test('short-prefix IPs are heuristic-only, not verified', () => {
  const v = A.verifyBot({ ip: '34.1.2.3', uri: '/', tls: '', cache: '' }, { name: 'Googlebot', tier: 'search_engine' });
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
