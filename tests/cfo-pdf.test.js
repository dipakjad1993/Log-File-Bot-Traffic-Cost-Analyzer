const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');
const CFO = require('../js/cfo-pdf.js');

function rec(ip, ua, uri = '/', status = 200, bytes = 50000, ts = '2026-06-03T10:00:00Z') {
  return { ip, user_agent: ua, uri, status, bytes, timestamp: ts, method: 'GET' };
}

test('cfo-pdf: generates real PDF bytes (no window.print)', () => {
  const rs = [];
  for (let i = 0; i < 200; i++) rs.push(rec('10.0.0.' + (i % 20 + 1), 'GPTBot/1.0 (+https://openai.com/gptbot)', '/page?p=' + i, 200, 60000, '2026-06-0' + (1 + (i % 8)) + 'T10:00:00Z'));
  for (let i = 0; i < 100; i++) rs.push(rec('10.0.1.' + (i % 10 + 1), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36', '/', 200, 40000, '2026-07-01T10:00:00Z'));
  for (let i = 0; i < 50; i++) rs.push(rec('10.0.2.' + (i % 5 + 1), 'OAI-SearchBot/1.0', '/blog/a', 200, 30000, '2026-08-01T10:00:00Z'));
  const out = A.analyze(rs, { cdnEgress: 0.09, request10K: 0.0075, ssr1K: 0, preset: 'AWS CloudFront' }, () => {});
  const res = CFO.generateCFOPDFBytes(out, { domain: 'example.com', file: 'access.log' });
  assert.ok(res.bytes instanceof Uint8Array);
  const head = Buffer.from(res.bytes.slice(0, 8)).toString('latin1');
  assert.ok(head.startsWith('%PDF-1.4'), 'real PDF header, got: ' + head);
  assert.ok(res.bytes.length > 5000, 'enterprise PDF has real content, len=' + res.bytes.length);
  assert.ok(res.pages >= 1);
  const body = Buffer.from(res.bytes).toString('latin1');
  assert.ok(body.includes('EXECUTIVE'), 'has executive section');
  assert.ok(body.includes('PROJECTED ANNUAL'), 'annualizes savings (CFO requirement)');
  assert.ok(body.includes('Do NOT block') || body.includes('Do NOT'), 'revenue guardrails present');
  assert.ok(!body.includes('window.print'), 'no print-dialog hack inside PDF');
});

test('cfo-pdf: data model annualizes + labels pricing + badge', () => {
  const rs = [];
  for (let i = 0; i < 100; i++) rs.push(rec('9.9.9.' + (i % 5 + 1), 'GPTBot/1.0', '/x', 200, 100000, '2026-06-03T00:00:00Z'));
  const out = A.analyze(rs, { cdnEgress: 0.09, request10K: 0.0075, ssr1K: 0, preset: 'AWS CloudFront' }, () => {});
  const d = CFO.buildCFOData(out, {});
  assert.ok(d.kpis.annual >= d.kpis.blockable, 'annual >= period');
  assert.ok(d.meta.preset.length > 0);
  assert.ok(['EXACT', 'SAMPLED 1-in-1'].includes(d.meta.badge) || d.meta.badge.startsWith('SAMPLED') || d.meta.badge === 'EXACT');
  assert.ok(d.method.includes('Blockable ='));
});

test('P0 safety: no 40-char generic Chrome BLOCK for Bytespider', () => {
  const bd = {
    Bytespider: { name: 'Bytespider', tier: 'ai_training', count: 50, totalBytes: 1000000, uniqueIPCount: 5, topUAList: [['Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36', 50]] }
  };
  const r = A.genEdgeRules(bd, { hvIPs: [] }, 30 * 86400000);
  const blocks = r.cloudflare.filter(x => x.act === 'BLOCK');
  // Must NOT emit a BLOCK containing a generic Chrome slice
  for (const b of blocks) {
    assert.ok(!/Chrome\/1/.test(b.rule) || /Bytespider|ByteDance/i.test(b.rule), 'no generic Chrome block: ' + b.rule);
  }
  // Either a safe token block or a challenge-with-verify is acceptable, never generic block
  assert.ok(r.cloudflare.length >= 1);
});

test('P0 safety: GPTBot rule uses stable token, not truncated URL', () => {
  const bd = {
    GPTBot: { name: 'GPTBot', tier: 'ai_training', count: 100, totalBytes: 5000000, uniqueIPCount: 3, topUAList: [['GPTBot/1.0 (+https://openai.com/gptbot)', 100]] }
  };
  const r = A.genEdgeRules(bd, { hvIPs: [] }, 86400000);
  const b = r.cloudflare.find(x => x.act === 'BLOCK');
  assert.ok(b, 'emits block for real training bot');
  assert.ok(b.rule.includes('GPTBot'), 'stable token present');
  assert.ok(!b.rule.includes('substring') && b.rule.length < 300, 'clean short rule, len=' + b.rule.length);
});
