const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

function rec(ip, ua, uri, status, bytes) {
  return { ip, user_agent: ua, uri, status, bytes, timestamp: '2026-09-17T10:00:00Z', method: 'GET' };
}

test('js-shell: AI-bot 200 <5KB flagged, sorted ascending', () => {
  const rs = [
    rec('1.1.1.1', 'GPTBot/1.0', '/blog/seo-guide', 200, 2100),
    rec('1.1.1.2', 'OAI-SearchBot/1.0', '/pricing', 200, 180000),
    rec('1.1.1.3', 'PerplexityBot/1.0', '/_next/data/abc.json', 200, 900),
    rec('1.1.1.4', 'Mozilla/5.0 Chrome/126', '/blog/seo-guide', 200, 1500),
  ];
  const normed = rs.map(A.norm);
  const cls = normed.map((r) => A.classifyBot(r.ua));
  const j = A.detectJsShell(normed, cls, {});
  assert.equal(j.total, 2);
  assert.ok(j.rows[0].bytes <= j.rows[1].bytes, 'ascending');
  assert.ok(j.rows.some((r) => r.uri.includes('_next/data')), 'SSR signal');
});

test('js-shell: static assets excluded', () => {
  const rs = [rec('1.1.1.1', 'GPTBot/1.0', '/app.js', 200, 500)];
  const j = A.detectJsShell(rs.map(A.norm), rs.map((r) => A.classifyBot(r.user_agent)), {});
  assert.equal(j.total, 0);
});

test('analyze() carries jsShell + spoof + anomalies', () => {
  const rs = [];
  for (let i = 0; i < 10; i++) rs.push(rec('9.9.9.' + i, 'GPTBot/1.0', '/p' + i, 200, 1500));
  const out = A.analyze(rs, {}, () => {});
  assert.ok(out.jsShell && out.jsShell.total >= 1);
  assert.ok(out.spoof && out.spoof.claimed >= 1);
  assert.ok(out.anomalies);
});
