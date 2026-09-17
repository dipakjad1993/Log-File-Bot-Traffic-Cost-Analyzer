const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

function rec(ip, ua, uri = '/', status = 200, bytes = 5000) {
  return { ip, user_agent: ua, uri, status, bytes, timestamp: '2026-09-17T10:00:00Z', method: 'GET' };
}

test('spoof KPI: Chrome-UA GPTBot on residential IP = UNVERIFIED', () => {
  const rs = [];
  for (let i = 0; i < 5; i++) rs.push(rec('192.0.2.' + (i + 1), 'GPTBot/1.0 (+https://openai.com/gptbot)'));
  const normed = rs.map(A.norm);
  const cls = normed.map((r) => A.classifyBot(r.ua));
  const db = [{ prefixes: ['40.88.0.0/16'], bots: ['gptbot'], date: '2026-09-17', source: 'openai.com/gptbot.json' }];
  const s = A.countUnverified(normed, cls, db);
  assert.equal(s.claimed, 5);
  assert.equal(s.unverified, 5);
  assert.ok(s.byBot.length >= 1);
});

test('spoof KPI: verified GPTBot IP passes', () => {
  const rs = [rec('40.88.10.5', 'GPTBot/1.0')];
  const normed = rs.map(A.norm);
  const cls = normed.map((r) => A.classifyBot(r.ua));
  const db = [{ prefixes: ['40.88.0.0/16'], bots: ['gptbot'], date: '2026-09-17', source: 't' }];
  const s = A.countUnverified(normed, cls, db);
  assert.equal(s.verified, 1);
  assert.equal(s.unverified, 0);
});

test('spoof fixture: Chrome UA + cloud ASN scores stealth (Aug 2025 pattern)', () => {
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const rs = [];
  for (let i = 0; i < 12; i++) rs.push(rec('13.64.9.9', chrome, '/article-' + i));
  const normed = rs.map(A.norm);
  const cls = normed.map((r) => A.classifyBot(r.ua));
  const st = A.detectStealth(normed, cls, A.security(normed));
  assert.equal(st.length, 1);
  assert.ok(st[0].score >= 40);
});
