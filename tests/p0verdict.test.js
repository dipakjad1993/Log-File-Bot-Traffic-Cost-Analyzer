const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

test('P0 verdict: training threshold >=2 fires (1810 GPTBot must not be silent)', () => {
  const mk = (tier, count) => ({ tier, count, totalBytes: 1000, topUAList: [[tier + '-ua', count]] });
  const r = A.genEdgeRules({ GPTBot: mk('ai_training', 2), Bytespider: mk('ai_training', 1810), CCBot: mk('ai_training', 5), ClaudeBot: mk('ai_training', 3) }, { hvIPs: [] });
  const blocks = r.cloudflare.filter((x) => x.act === 'BLOCK');
  assert.equal(blocks.length, 4, 'all 4 training bots >=2 must emit BLOCK, got ' + JSON.stringify(blocks.map(b=>b.name)));
});

test('P0 verdict: suspicious threshold >=2 challenges; search 429-only; user allow-only', () => {
  const mk = (tier, count) => ({ tier, count, totalBytes: 1000, topUAList: [[tier + '-ua', count]] });
  const r = A.genEdgeRules({
    'OAI-SearchBot': mk('ai_search_index', 2),
    'ChatGPT-User': mk('ai_user_fetch', 1),
    'python-requests/2.31': mk('suspicious', 2),
  }, { hvIPs: [] });
  assert.ok(r.cloudflare.some((x) => /120\/min/.test(x.act)), 'search 120/min');
  assert.ok(!r.cloudflare.some((x) => x.act === 'BLOCK' && /OAI-SearchBot/.test(x.name)), 'search never BLOCK');
  assert.ok(r.cloudflare.some((x) => /ALLOW/.test(x.act) && /ChatGPT-User/.test(x.name)), 'user ALLOW');
  assert.ok(r.cloudflare.some((x) => x.act === 'CHALLENGE'), 'suspicious challenges at >=2');
});

test('P0 verdict: OAI-AdsBot revenue guard — never blocked even if mis-tiered', () => {
  const r = A.genEdgeRules({
    'OAI-AdsBot': { tier: 'ai_training', count: 500, totalBytes: 1e6, topUAList: [['OAI-AdsBot/1.0', 500]] },
  }, { hvIPs: [] });
  assert.ok(!r.cloudflare.some((x) => /adsbot/i.test(x.name + ' ' + x.rule) && /BLOCK|CHALLENGE/.test(x.act)), 'AdsBot must never BLOCK/CHALLENGE');
  const risks = A.checkPolicyConsistency({ robotsAllows: [], robotsDisallows: ['OAI-AdsBot'] });
  assert.ok(risks.some((x) => /REVENUE RISK/i.test(x)), 'Disallow AdsBot must raise REVENUE RISK');
});

test('P0 verdict: anomaly has no Hour #167 / fake z=12.92 — flat baseline reports z null + ISO hour', () => {
  // 40 days of flat GPTBot traffic (2/hr) then one 60-req hour: flat baseline => z null, never 12.92
  const rs = [];
  const base = Date.parse('2026-06-01T00:00:00Z');
  for (let h = 0; h < 960; h++) for (let k = 0; k < 2; k++)
    rs.push({ ip: '9.9.9.9', user_agent: 'GPTBot/1.0', uri: '/x', status: 200, bytes: 800, timestamp: new Date(base + h * 3600e3 + k * 1000).toISOString(), method: 'GET' });
  for (let i = 0; i < 60; i++)
    rs.push({ ip: '9.9.9.9', user_agent: 'GPTBot/1.0', uri: '/x', status: 200, bytes: 800, timestamp: new Date(base + 960 * 3600e3 + i * 60e3).toISOString(), method: 'GET' });
  const normed = rs.map(A.norm);
  const cls = normed.map((r) => A.classifyBot(r.ua));
  const an = A.detectAnomalies(normed, cls);
  const dump = JSON.stringify(an.bursts);
  assert.ok(!/Hour #/.test(dump), 'no global Hour # index, got ' + dump.slice(0, 200));
  assert.ok(!/12\.92/.test(dump), 'no fabricated z=12.92, got ' + dump.slice(0, 200));
  for (const b of an.bursts) {
    assert.match(b.hour, /^\d{4}-\d{2}-\d{2}T\d{2}:00Z$/, 'ISO hour label, got ' + b.hour);
    assert.ok(b.z === null || (b.z >= 3 && b.count >= 2 * b.mean), 'z>=3 + 2x mean or null-flat, got ' + JSON.stringify(b));
  }
});

test('P0 verdict: anomaly requires n>30 — tiny bots never burst', () => {
  const rs = [];
  const base = Date.parse('2026-09-01T00:00:00Z');
  for (let i = 0; i < 12; i++) rs.push({ ip: '1.1.1.1', user_agent: 'TinyBot/9', uri: '/', status: 200, bytes: 10, timestamp: new Date(base + i * 60e3).toISOString(), method: 'GET' });
  const an = A.detectAnomalies(rs.map(A.norm), rs.map((r) => A.classifyBot(r.user_agent)));
  assert.equal(an.bursts.filter((b) => /TinyBot/.test(b.bot)).length, 0, 'n<=30 must not burst');
});

test('P2 verdict: freshness red after 14d (not 21d)', () => {
  assert.equal(A.getFreshnessStatus(Date.parse('2026-09-25T00:00:00Z')).level, 'amber', '8d = amber boundary');
  const st = A.getFreshnessStatus(Date.parse('2026-10-02T00:00:00Z'));
  assert.equal(st.level, 'red', '15d must be red');
  assert.ok(st.stale);
});
