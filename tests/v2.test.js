const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../js/analyzer.js');

test('P0-1: Sept-2026 defaults WAF + diff + BotBase taxonomy', () => {
  const bd = {
    GPTBot: { name: 'GPTBot', tier: 'ai_training', count: 180, totalBytes: 1e6, topUAList: [['GPTBot/1.0', 180]] },
    'OAI-SearchBot': { name: 'OAI-SearchBot', tier: 'ai_search_index', count: 50, totalBytes: 5e5, topUAList: [['OAI-SearchBot/1.0', 50]] },
    'ChatGPT-User': { name: 'ChatGPT-User', tier: 'ai_user_fetch', count: 10, totalBytes: 1e5, topUAList: [['ChatGPT-User/1.0', 10]] },
  };
  const s = A.genSept2026Defaults(bd);
  assert.equal(s.defaults.version, '2026.09.15');
  assert.match(s.waf, /Sept-15-2026/);
  assert.match(s.diff, /180/);
  assert.equal(s.counts.training, 180);
  assert.ok(Array.isArray(A.BOTBASE_TAXONOMY) && A.BOTBASE_TAXONOMY.length >= 5);
  assert.ok(A.BOT_IP_SOURCES.some(x => /BotBase/i.test(x.bot)));
});

test('P0-2: Pay Per Crawl v2 per-path pricing + worker + discovery + recovery model', () => {
  const v2 = A.genPayPerCrawlV2({});
  assert.match(v2.nginx, /\/api\//);
  assert.match(v2.nginx, /0\.25/);
  assert.match(v2.worker, /crawler-price/i);
  assert.match(v2.worker, /BYPASS/);
  assert.match(v2.discovery, /Discovery/);
  assert.match(v2.harness, /curl -A/);
  const bd = { GPTBot: { tier: 'ai_training', count: 180000, totalBytes: 1e9 } };
  const r = A.calcPayPerCrawlRecovery(bd, 0.02);
  assert.equal(r.pricePerReq, 0.02);
  assert.ok(Math.abs(r.totalMonthly - 3600) < 1e-6, 'got ' + r.totalMonthly);
  assert.match(r.headline, /3,600/);
  assert.match(r.disclaimer, /not a guarantee/i);
});

test('P0-3: Web Bot Auth detect + batch dig bundle', () => {
  assert.equal(A.detectWebBotAuth({ cf_web_bot_auth: 'signed-abc' }).present, true);
  assert.equal(A.detectWebBotAuth({}).present, false);
  assert.equal(A.detectWebBotAuth(A.norm({ cf_web_bot_auth: 'x', user_agent: 'x', uri: '/' })).present, true);
  const cmd = A.genBatchVerifyCommands([['1.1.1.1', 5], ['8.8.8.8', 3]]);
  assert.match(cmd, /dig -x 1\.1\.1\.1/);
  assert.match(cmd, /verify-rdns/);
});

test('P0-4: crawlers.json + security.txt + bundle + consistency checker', () => {
  const bd = { GPTBot: { tier: 'ai_training', count: 3, topUAList: [['GPTBot/1.0', 3]] } };
  const cj = JSON.parse(A.genCrawlersJson(bd));
  assert.equal(cj.version, '2026.09');
  assert.ok(cj.agents.length >= 1);
  assert.match(A.genSecurityTxt({}), /security\.txt/i);
  const b = A.genPolicyBundle({ botData: bd, tp: { topURLs: [] } }, {});
  assert.ok(b.robots.includes('GPTBot') && b.llms.includes('llms.txt') && b.crawlers.includes('agents'));
  const ok = A.checkPolicyConsistency({ robotsAllows: ['GPTBot'], robotsDisallows: [], cfBlocksTraining: true });
  assert.ok(ok.length >= 1);
  const risk = A.checkPolicyConsistency({ robotsAllows: [], robotsDisallows: ['OAI-AdsBot'] });
  assert.ok(risk.some(x => /OAI-AdsBot/i.test(x)));
});

test('P0-5: citation-gap harness + killers', () => {
  const cmds = A.genCitationGapCommands('https://example.com/page');
  assert.match(cmds, /GPTBot\/1\.0/);
  assert.match(cmds, /PerplexityBot/);
  const k = A.detectCitationKillers('<div id="root"></div><script>fetch("/api/price")</script>');
  assert.ok(k.length >= 1 && /Shell|fetch/i.test(k.join(' ')));
  const k2 = A.detectCitationKillers('<html><h1>Real SSR article with facts</h1><p>' + 'x'.repeat(6000) + '</p></html>');
  assert.ok(k2.join(' ').length > 0);
});

test('P1-7: Bot Dynamics + auto-ticket + GSC overlay', () => {
  const cur = { botData: { GPTBot: { count: 200 }, 'OAI-SearchBot': { count: 50 } } };
  const prev = { botCounts: { GPTBot: 50, 'OAI-SearchBot': 50 } };
  const d = A.genBotDynamics(cur, prev);
  assert.ok(d.rows.some(r => r.bot === 'GPTBot' && r.flag === 'SPIKE'));
  const t = A.genTicketText({ bursts: [{ bot: 'GPTBot', count: 300, z: 5.1, mean: 10 }], not404: [{ uri: '/vendor/phpunit', count: 400 }] }, { hvIPs: [] });
  assert.match(t, /BOT-BURST/);
  assert.match(t, /block, not 404/);
  const ov = A.overlayGscClicks({ uncrawled: [{ url: '/x', clicks: 9, impressions: 100 }] });
  assert.equal(ov[0].clicks, 9);
});

test('P1-8: BQ streaming pack (R2->Parquet COPY + scheduled UNVERIFIED %)', () => {
  const p = A.genBQStreamingPack();
  assert.match(p.streaming, /COPY logs TO/i);
  assert.match(p.streaming, /UNVERIFIED/);
  assert.match(p.streaming, /Logpush.*R2/i);
});

test('Fixes: AI disclaimer + guess-mode guard + freshness + dev-server', () => {
  assert.match(A.AI_MATRIX_DISCLAIMER, /NOT guarantees|not.*guarantee/i);
  assert.equal(A.isGuessMode({ lowConfidence: { 'w3c-guess': 5 } }), true);
  assert.equal(A.isGuessMode({}), false);
  const g = A.guardEdgeRules({ cloudflare: [{ name: 'x' }] }, { lowConfidence: { 'w3c-guess': 2 } });
  assert.equal(g.blocked, true);
  assert.equal(g.rules.cloudflare.length, 0);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'dev-server.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'server.js')), 'server.js must be gone (renamed)');
});

test('MCP server tools callable (no transport)', () => {
  const mcp = require('../tools/mcp-server.js');
  assert.ok(mcp.TOOLS.some(t => t.name === 'analyzeLogs'));
  const pol = mcp.callTool('getBotPolicy', { ua: 'GPTBot/1.0' });
  assert.equal(pol.tier, 'ai_training');
  const rule = mcp.callTool('genEdgeRule', { tier: 'ai_search_index' });
  assert.ok(rule.cloudflare.length >= 1 || rule.robots.length > 0);
});
