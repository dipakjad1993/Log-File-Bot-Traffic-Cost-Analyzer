const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');
const FULL = require('../js/full-report-pdf.js');

function rec(ip, ua, uri = '/', status = 200, bytes = 50000, ts = '2026-06-03T10:00:00Z') {
  return { ip, user_agent: ua, uri, status, bytes, timestamp: ts, method: 'GET' };
}

function sampleAnalysis() {
  const rs = [];
  for (let i = 0; i < 200; i++) rs.push(rec('10.0.0.' + (i % 20 + 1), 'GPTBot/1.0 (+https://openai.com/gptbot)', '/page?p=' + i, 200, 60000, '2026-06-0' + (1 + (i % 8)) + 'T10:00:00Z'));
  for (let i = 0; i < 100; i++) rs.push(rec('10.0.1.' + (i % 10 + 1), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36', '/', 200, 40000, '2026-07-01T10:00:00Z'));
  for (let i = 0; i < 50; i++) rs.push(rec('10.0.2.' + (i % 5 + 1), 'OAI-SearchBot/1.0', '/blog/a', 200, 30000, '2026-08-01T10:00:00Z'));
  for (let i = 0; i < 30; i++) rs.push(rec('10.0.3.' + (i % 5 + 1), 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', '/x?sort=price&page=' + i, 200, 35000, '2026-07-15T10:00:00Z'));
  return A.analyze(rs, { cdnEgress: 0.09, request10K: 0.0075, ssr1K: 0, preset: 'AWS CloudFront' }, () => {});
}

test('full-report: data model covers all 10 modules + CFO', () => {
  const out = sampleAnalysis();
  const d = FULL.buildFullData(out, { domain: 'example.com', file: 'access.log' });
  assert.ok(d.cfo, 'embeds CFO data model');
  assert.ok(d.meta.records > 0, 'meta records');
  assert.ok(d.classification.tiers.length >= 3, 'tier split, len=' + d.classification.tiers.length);
  assert.ok(d.classification.topBots.length <= 25 && d.classification.topBots.length > 0, 'top bots trimmed');
  assert.ok('matches' in d.verification && 'unverified' in d.verification, 'verification KPIs');
  assert.ok(Array.isArray(d.crawl.traps), 'traps array');
  assert.ok(d.costs.rows.length <= 20 && d.costs.rows.length > 0, 'cost rows trimmed');
  assert.ok(Array.isArray(d.ai.rows), 'AI matrix rows');
  assert.ok(Array.isArray(d.edge.cloudflare), 'edge rules arrays');
  assert.ok(d.perf.statuses.length > 0, 'status distribution');
  assert.ok(d.perf.hourly.length === 24, 'hourly buckets');
  assert.ok(Array.isArray(d.dynamics.daily) && d.dynamics.daily.length === 7, 'day-of-week');
  assert.ok('threatCount' in d.security && Array.isArray(d.security.groups), 'security rollup');
  // totals agree with CFO model
  assert.equal(d.costs.total.all, d.cfo.kpis.total, 'cost total matches CFO');
  assert.equal(d.costs.blockable, d.cfo.kpis.blockable, 'blockable matches CFO');
});

test('full-report: generates multi-page real PDF with all sections', () => {
  const out = sampleAnalysis();
  const res = FULL.generateFullPDFBytes(out, { domain: 'example.com', file: 'access.log' });
  assert.ok(res.bytes instanceof Uint8Array);
  const head = Buffer.from(res.bytes.slice(0, 8)).toString('latin1');
  assert.ok(/^%PDF-1\.[3-7]/.test(head), 'real PDF header, got: ' + head);
  assert.ok(res.pages >= 4, 'full reference spans multiple pages, got ' + res.pages);
  const body = Buffer.from(res.bytes).toString('latin1');
  for (const s of ['FULL ANALYSIS REPORT', 'EXECUTIVE RECOMMENDATION', 'Bot classification', 'Multi-layer bot verification', 'Crawl budget', 'Infrastructure cost analysis', 'citation ROI matrix', 'Edge + policy bundle', 'Performance deep dive', 'Dynamics', 'Security threat intelligence', 'Do NOT block', 'Appendix']) {
    assert.ok(body.includes(s), 'section present: ' + s);
  }
  assert.ok(/Page 1 of/.test(body), 'paginated footer present');
  const footers = [...body.matchAll(/Page (\d+) of (\d+)/g)].map((m) => [m[1], m[2]]);
  assert.equal(footers.length, res.pages, 'one footer per page');
  footers.forEach(([pg, tot], i) => {
    assert.equal(+pg, i + 1, 'footer ' + i + ' numbers page ' + pg);
    assert.equal(+tot, res.pages, 'footer totals match');
  });
});

test('full-report: WinAnsi-clean stream, no mojibake', () => {
  const out = sampleAnalysis();
  const res = FULL.generateFullPDFBytes(out, { domain: 'example.com', file: 'access.log' });
  const body = Buffer.from(res.bytes).toString('latin1');
  assert.ok(!body.includes('[116;'), 'no ANSI/mojibake artifact in stream');
  assert.ok(!body.includes('(cid:'), 'no CID font escapes (Helvetica only)');
  assert.equal(FULL.san('a — b → c ± d × e'), 'a -- b -> c +/- d x e');
  assert.equal(FULL.tierLabel('ai_training'), 'AI Training');
});
