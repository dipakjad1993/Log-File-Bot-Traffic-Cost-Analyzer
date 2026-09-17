#!/usr/bin/env node
/* MCP server — expose log analysis to Claude/ChatGPT agents (stdio).
 * Minimal MCP-compatible JSON-RPC over stdio (no deps): tools/list + tools/call.
 * Tools: analyzeLogs, getBotPolicy, genEdgeRule. Grounding: ../llms-full.txt (127-sig dump).
 * Run: node tools/mcp-server.js  (pipe JSON-RPC lines on stdin)
 * Test: echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node tools/mcp-server.js
 */
const fs = require('fs');
const path = require('path');
const A = require('../js/analyzer.js');

function grounding() {
  try {
    const p = path.join(__dirname, '..', 'llms-full.txt');
    return fs.readFileSync(p, 'utf8').slice(0, 8000);
  } catch (e) { return 'Bot DB v' + A.BOT_DB_VERSION + ' (' + A.BOTS.length + ' sigs)'; }
}

const TOOLS = [
  { name: 'analyzeLogs', description: 'Classify log records + cost split (training vs search vs user). Input: {records:[{user_agent,ip,uri,status,bytes}] harness}', inputSchema: { type: 'object', properties: { records: { type: 'array' } } } },
  { name: 'getBotPolicy', description: 'Rate policy for a bot UA (block/allow + limits + citation risk). Input: {ua}', inputSchema: { type: 'object', properties: { ua: { type: 'string' } } } },
  { name: 'genEdgeRule', description: 'Cloudflare/Fastly/AWS edge rule for a tier. Input: {tier: ai_training|ai_search_index|ai_user_fetch}', inputSchema: { type: 'object', properties: { tier: { type: 'string' } } } },
];

function callTool(name, args) {
  args = args || {};
  if (name === 'analyzeLogs') {
    const recs = Array.isArray(args.records) ? args.records.slice(0, 5000) : [];
    const out = A.analyze(recs, {}, () => {});
    return { tiers: out.tierData, totalUSD: out.costs.total.all, blockableUSD: out.costs.savings.botBlocking, spoof: out.spoof, jsShellTotal: out.jsShell.total, disclaimer: A.AI_MATRIX_DISCLAIMER };
  }
  if (name === 'getBotPolicy') {
    const c = A.classifyBot(String(args.ua || ''));
    return { bot: c.name, tier: c.tier, rateLimit: c.rateLimit || null, citationRisk: c.citationRisk || null, note: c.note || '', policy: A.RATE_POLICY[c.tier] || null, grounding: grounding().slice(0, 2000) };
  }
  if (name === 'genEdgeRule') {
    const t = String(args.tier || 'ai_training');
    const mk = (tier, count) => ({ tier, count, totalBytes: 1000, topUAList: [[tier + '-ua', count]] });
    const sample = t === 'ai_search_index' ? { 'OAI-SearchBot': mk(t, 3) } : t === 'ai_user_fetch' ? { 'ChatGPT-User': mk(t, 1) } : { GPTBot: mk(t, 3) };
    const r = A.genEdgeRules(sample, { hvIPs: [] });
    return { tier: t, cloudflare: r.cloudflare, robots: r.robots, decision: r.decision, sept2026: A.CLOUDFLARE_SEPT_DEFAULTS };
  }
  throw new Error('unknown tool: ' + name);
}

if (require.main === module) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { return; }
    const reply = (result, error) => {
      const out = { jsonrpc: '2.0', id: msg.id };
      if (error) out.error = { code: -32000, message: String(error.message || error) };
      else out.result = result;
      process.stdout.write(JSON.stringify(out) + '\n');
    };
    try {
      if (msg.method === 'initialize') reply({ protocolVersion: '2024-11-05', serverInfo: { name: 'log-analyzer', version: '2.0.0' }, capabilities: { tools: {} } });
      else if (msg.method === 'tools/list') reply({ tools: TOOLS });
      else if (msg.method === 'tools/call') reply({ content: [{ type: 'text', text: JSON.stringify(callTool(msg.params && msg.params.name, msg.params && msg.params.arguments), null, 2) }] });
      else if (msg.method === 'ping') reply({});
      else reply(null, new Error('unknown method: ' + msg.method));
    } catch (e) { reply(null, e); }
  });
} else {
  module.exports = { TOOLS, callTool };
}
