const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function rec(ip, ua, uri = '/', status = 200, bytes = 1000, ts = '2026-09-01T10:00:00Z') {
  return { ip, user_agent: ua, uri, status, bytes, timestamp: ts, method: 'GET' };
}

test('stealth: Chrome UA + cloud ASN scores >= 40 with signals', () => {
  const rs = [];
  for (let i = 0; i < 12; i++) rs.push(rec('13.64.1.5', chromeUA, '/page-' + i));
  const normed = rs.map(A.norm);
  const cls = normed.map(r => A.classifyBot(r.ua));
  const sec = A.security(normed);
  const st = A.detectStealth(normed, cls, sec);
  assert.equal(st.length, 1);
  assert.ok(st[0].score >= 40, 'score=' + st[0].score);
  assert.ok(st[0].signals.join(' ').includes('Chrome'), 'chrome signal present');
  assert.ok(st[0].signals.join(' ').includes('Azure'), 'cloud signal present');
});

test('stealth: residential humans are not flagged', () => {
  const rs = [];
  for (let i = 0; i < 12; i++) rs.push(rec('192.168.1.' + (i + 1), chromeUA, '/home'));
  const normed = rs.map(A.norm);
  const cls = normed.map(r => A.classifyBot(r.ua));
  const st = A.detectStealth(normed, cls, A.security(normed));
  assert.equal(st.length, 0);
});

test('R2 + Workers preset: $0 egress, $0.005/10K', () => {
  const p = A.COST_PRESETS['Cloudflare R2 + Workers (edge)'];
  assert.equal(p.cdnEgress, 0);
  assert.equal(p.request10K, 0.005);
  const bd = { B: { count: 10000, totalBytes: 1073741824, s2xx: 10000, tier: 'human' } };
  const c = A.calcCosts(bd, p);
  assert.equal(c.total.egress, 0);
  assert.ok(Math.abs(c.total.request - 0.005) < 1e-9);
});

test('cost CI: 95% interval is honest math', () => {
  const bd = { B: { count: 10000, totalBytes: 1073741824, s2xx: 10000, tier: 'human' } };
  const c = A.calcCosts(bd, {});
  assert.ok(Math.abs(c.ci.rel - 1.96 / 100) < 1e-9);
  assert.ok(Math.abs(c.ci.abs - c.total.all * c.ci.rel) < 1e-9);
  const empty = A.calcCosts({}, {});
  assert.equal(empty.ci.rel, 0);
});

test('cfg share hash round-trips', () => {
  const cfg = { cdnEgress: 0.03, request10K: 0, ssr1K: 0.005 };
  assert.deepEqual(A.decodeCfg(A.encodeCfg(cfg)), cfg);
  assert.equal(A.decodeCfg('!!!not-base64!!!'), null);
});

test('bot DB age is days since 2026-09-17', () => {
  assert.equal(A.botDbAgeDays(Date.parse('2026-09-17T12:00:00Z')), 0);
  assert.equal(A.botDbAgeDays(Date.parse('2026-09-27T00:00:00Z')), 10);
});

test('reverseIPv4 maps octets correctly, rejects v6', () => {
  assert.equal(A.reverseIPv4('66.249.66.1'), '1.66.249.66.in-addr.arpa');
  assert.equal(A.reverseIPv4('2600:1400::1'), null);
  assert.equal(A.reverseIPv4('999.1.1.1'), null);
});

test('ai_citation deprecation: warns once, still maps', () => {
  let warns = 0;
  const orig = console.warn;
  console.warn = () => { warns++; };
  try {
    assert.equal(A.normalizeTier('ai_citation'), 'ai_search_index');
    A.normalizeTier('ai_citation');
    assert.equal(warns, 1);
    assert.equal(A.normalizeTier('ai_search_index'), 'ai_search_index');
  } finally { console.warn = orig; }
});

test('402 snippet: nginx + worker + bypass + harness', () => {
  const s = A.gen402Example();
  assert.ok(s.includes('402'));
  assert.ok(s.includes('BYPASS') || s.includes('bypass'));
  assert.ok(s.includes('OAI-SearchBot'));
  assert.ok(s.includes('curl -A'));
});

test('edge rules: dynamic rates + decision tree, arrays only', () => {
  const bd = { GPTBot: { name: 'GPTBot', tier: 'ai_training', count: 120, totalBytes: 5000, uniqueIPCount: 2, topUAList: [['GPTBot/1.0', 120]] } };
  const r = A.genEdgeRules(bd, { hvIPs: [] }, 60000);
  assert.ok(Array.isArray(r.cloudflare) && Array.isArray(r.fastly) && Array.isArray(r.aws));
  assert.ok(r.cloudflare.length >= 1);
  assert.ok(r.cloudflare[0].desc.includes('req/min/IP'), 'rate in desc: ' + r.cloudflare[0].desc);
  assert.ok(r.decision.includes('429'));
  const noWindow = A.genEdgeRules(bd, { hvIPs: [] });
  assert.ok(noWindow.cloudflare[0].desc.includes('window unknown'));
});

test('analyze() carries stealth + ci + decision', () => {
  const rs = [];
  for (let i = 0; i < 12; i++) rs.push(rec('13.64.1.5', chromeUA, '/p' + i));
  for (let i = 0; i < 20; i++) rs.push(rec('9.9.9.' + (i % 5 + 1), 'GPTBot/1.0', '/x', 200, 500));
  const out = A.analyze(rs, {}, () => {});
  assert.ok(Array.isArray(out.stealth) && out.stealth.length >= 1);
  assert.ok(out.costs.ci && out.costs.ci.n === 32);
  assert.ok(out.edgeRules.decision.includes('429'));
});

test('worker-path parity: 20k+ records keep _urlSet for GSC join', () => {
  const rs = [];
  for (let i = 0; i < 20500; i++) {
    rs.push(rec('10.0.0.' + (i % 200 + 1), i % 7 === 0 ? 'GPTBot/1.0' : chromeUA, '/u' + (i % 500), 200, 800));
  }
  const out = A.analyze(rs, {}, () => {});
  assert.equal(out.summary.totalRecords, 20500);
  assert.ok(out._urlSet.length >= 400, '_urlSet kept, len=' + out._urlSet.length);
  assert.ok(out.tierData.ai_training && out.tierData.human);
}, { timeout: 120000 });
