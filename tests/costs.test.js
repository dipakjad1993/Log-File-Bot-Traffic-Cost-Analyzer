const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

test('cost presets exist for Cloudflare/Fastly/GCS', () => {
  for (const k of ['AWS CloudFront', 'Cloudflare', 'Fastly', 'GCS / GCE']) {
    assert.ok(A.COST_PRESETS[k], k);
    assert.ok(A.COST_PRESETS[k].cdnEgress >= 0);
  }
  assert.ok(A.COST_PRESETS.Cloudflare.cdnEgress < A.COST_PRESETS['AWS CloudFront'].cdnEgress);
});

test('calcCosts measures from bytes; training is blockable, search-index is not', () => {
  const botData = {
    GPTBot: { tier: 'ai_training', count: 100, totalBytes: 1073741824, s2xx: 100 },
    'OAI-SearchBot': { tier: 'ai_search_index', count: 100, totalBytes: 1073741824, s2xx: 100 },
    'ChatGPT-User': { tier: 'ai_user_fetch', count: 10, totalBytes: 1048576, s2xx: 10 },
  };
  const c = A.calcCosts(botData, { cdnEgress: 0.09, request10K: 0.0075, ssr1K: 0.005 });
  assert.ok(Math.abs(c.byBot.GPTBot.eg - 0.09) < 1e-9, '1 GiB * $0.09');
  assert.ok(c.savings.botBlocking > 0, 'blockable > 0');
  assert.ok(!c.savings.byTier.ai_search_index, 'search-index must NOT be blockable');
  assert.ok(!c.savings.byTier.ai_user_fetch, 'user-fetch must NOT be blockable');
});

test('edge rules: 2026 rate table (training block, search 120/min, user allow)', () => {
  const mk = (tier, count) => ({ tier, count, totalBytes: 1000, topUAList: [[tier + '-ua', count]] });
  const r = A.genEdgeRules({ GPTBot: mk('ai_training', 3), 'OAI-SearchBot': mk('ai_search_index', 3), 'ChatGPT-User': mk('ai_user_fetch', 1) }, { hvIPs: [] });
  assert.ok(r.cloudflare.some((x) => x.act === 'BLOCK' && /GPTBot/.test(x.name)), 'training blocked');
  assert.ok(r.cloudflare.some((x) => /120\/min/.test(x.act) && /OAI/.test(x.name)), 'search 120/min');
  assert.ok(r.cloudflare.some((x) => /ALLOW/.test(x.act) && /ChatGPT-User/.test(x.name)), 'user allowed');
  assert.ok(r.robots.includes('Google-Extended'), 'robots covers token');
  assert.ok(r.cfAICrawl.includes('AI Crawl Control'), 'CF mapping present');
});

test('full analyze() on teaching sample keeps tiers separate', () => {
  const sample = require('../sample-data/sample-server-logs.json');
  const out = A.analyze(sample, {}, () => {});
  assert.ok(out.summary.totalRecords >= 20);
  assert.ok(out.aiMatrix.GPTBot || out.botData.GPTBot, 'GPTBot present');
  assert.ok(out.tierData.ai_training.count > 0, 'training tier nonzero');
});
