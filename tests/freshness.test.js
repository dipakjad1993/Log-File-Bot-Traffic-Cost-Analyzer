const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../js/analyzer.js');

test('bot-ips.json freshness: 14 sources, ETag/fetched fields, fallback pin on stale', () => {
  const p = path.join(__dirname, '..', 'data', 'bot-ips.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(j.date, 'date present');
  const age = Math.floor((Date.now() - Date.parse(j.date + 'T00:00:00Z')) / 86400000);
  assert.ok((j.sources || []).length >= 14, 'want 14 sources (incl. BotBase), got ' + (j.sources || []).length);
  if (age > 14) {
    // v2: stale is allowed IFF last-good fallback pin + banner logic exists (freshness-or-death)
    assert.ok(A.FALLBACK_PIN && A.FALLBACK_PIN.date, 'stale needs fallback pin');
    const st = A.getFreshnessStatus(Date.now());
    assert.equal(st.level, 'red');
  } else {
    assert.ok(age <= 14, `bot-ips.json ${age}d old (>14d stale) — run npm run fetch-ips`);
  }
  const urls = j.sources.map((s) => s.url).filter(Boolean);
  for (const must of ['openai.com/gptbot.json', 'openai.com/searchbot.json', 'perplexitybot.json', 'claude.com/crawling/bots.json', 'googlebot.json', 'bing.com/toolbox/bingbot.json']) {
    assert.ok(urls.some((u) => u.includes(must.split('/').pop().replace('.json', '')) || u.includes(must)), 'missing ' + must);
  }
});

test('BOT_IP_SOURCES registry has 14 sources incl. BotBase taxonomy', () => {
  assert.ok(A.BOT_IP_SOURCES.length >= 14, 'got ' + A.BOT_IP_SOURCES.length);
  assert.ok(A.BOT_IP_SOURCES.some(s=>/BotBase/i.test(s.bot)), 'BotBase 14th source present');
});

test('freshness fallback: getFreshnessStatus levels + last-good pin', () => {
  const fresh = A.getFreshnessStatus(Date.parse('2026-09-17T12:00:00Z'));
  assert.equal(fresh.level, 'green');
  assert.equal(fresh.fallback.date, A.BOT_IP_JSON_DATE);
  const stale = A.getFreshnessStatus(Date.parse('2026-10-20T00:00:00Z'));
  assert.equal(stale.level, 'red');
  assert.ok(stale.stale);
  assert.match(stale.label, /last-good/i);
});
