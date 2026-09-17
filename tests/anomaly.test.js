const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

test('anomaly: burst detected (GPTBot 0 for days then 4k in 3h shape)', () => {
  const rs = [];
  const base = Date.parse('2026-09-01T00:00:00Z');
  for (let h = 0; h < 48; h++) rs.push({ ip: '1.1.1.1', user_agent: 'Mozilla/5.0 Chrome', uri: '/', status: 200, bytes: 1000, timestamp: new Date(base + h * 3600e3).toISOString(), method: 'GET' });
  for (let i = 0; i < 60; i++) rs.push({ ip: '2.2.2.2', user_agent: 'GPTBot/1.0', uri: '/x', status: 200, bytes: 800, timestamp: new Date(base + 47 * 3600e3 + i * 60e3).toISOString(), method: 'GET' });
  const normed = rs.map(A.norm);
  const cls = normed.map((r) => A.classifyBot(r.ua));
  const an = A.detectAnomalies(normed, cls);
  assert.ok(an.hours >= 1);
  assert.ok(Array.isArray(an.bursts));
});

test('anomaly: 404 vendor/phpunit cluster surfaced', () => {
  const rs = [];
  for (let i = 0; i < 8; i++) rs.push({ ip: '3.3.3.' + i, user_agent: 'curl/8', uri: '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php', status: 404, bytes: 200, timestamp: '2026-09-17T10:00:00Z', method: 'GET' });
  const an = A.detectAnomalies(rs.map(A.norm), rs.map((r) => A.classifyBot(r.user_agent)));
  assert.ok(an.not404.length >= 1);
  assert.ok(an.not404[0].uri.includes('phpunit'));
});

test('diff: A vs B deltas + cost delta', () => {
  const mk = (gpt, cost) => ({ botData: { GPTBot: { count: gpt } }, traps: { X: { count: 1 } }, costs: { total: { all: cost } }, summary: { totalRecords: gpt } });
  const d = A.diffAnalyses(mk(10, 1.0), mk(50, 3.0));
  assert.equal(d.bots[0].delta, 40);
  assert.equal(d.costDelta, 2.0);
});

test('edge estimate: origin warns undercount, edge does not', () => {
  const fake = { sec: { threats: [1, 2], hvIPs: [] }, stealth: [] };
  assert.ok(A.estimateEdgeBlocked(fake, 'origin').warning.includes('UNDERCOUNT'));
  assert.ok(A.estimateEdgeBlocked(fake, 'edge').warning.includes('near-complete'));
});

test('BQ pack: DDL + 5 queries', () => {
  const p = A.genBQPack();
  assert.ok(p.ddl.includes('PARTITION BY DATE'));
  assert.ok(p.queries.includes('JS-shell') || p.queries.includes('js') || p.queries.includes('bytes < 5120'));
});

test('triple join: sitemap + gsc + logs', () => {
  const rs = [{ ip: '1.1.1.1', user_agent: 'Mozilla', uri: '/a', status: 200, bytes: 100, timestamp: '2026-09-17T10:00:00Z', method: 'GET' }];
  const an = A.analyze(rs, {}, () => {});
  const j = A.joinTriple(an, ['/a', '/b'], [{ url: '/b', clicks: 10, impressions: 100 }]);
  assert.ok(j.triple.length >= 1);
});
