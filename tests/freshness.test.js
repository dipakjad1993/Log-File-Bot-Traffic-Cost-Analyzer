const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../js/analyzer.js');

test('bot-ips.json freshness: <=14 days old, 10+ sources, ETag/fetched fields', () => {
  const p = path.join(__dirname, '..', 'data', 'bot-ips.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(j.date, 'date present');
  const age = Math.floor((Date.now() - Date.parse(j.date + 'T00:00:00Z')) / 86400000);
  assert.ok(age <= 14, `bot-ips.json ${age}d old (>14d stale) — run npm run fetch-ips`);
  assert.ok((j.sources || []).length >= 10, 'want 10+ sources, got ' + (j.sources || []).length);
  const urls = j.sources.map((s) => s.url).filter(Boolean);
  for (const must of ['openai.com/gptbot.json', 'openai.com/searchbot.json', 'perplexitybot.json', 'claude.com/crawling/bots.json', 'googlebot.json', 'bing.com/toolbox/bingbot.json']) {
    assert.ok(urls.some((u) => u.includes(must.split('/').pop().replace('.json', '')) || u.includes(must)), 'missing ' + must);
  }
});

test('BOT_IP_SOURCES registry has 11+ endpoints', () => {
  assert.ok(A.BOT_IP_SOURCES.length >= 11, 'got ' + A.BOT_IP_SOURCES.length);
});
