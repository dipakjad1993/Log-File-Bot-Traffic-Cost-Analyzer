/* ============================================================
   Full Report PDF engine — entire tool analysis (all 10 modules)
   + CFO executive summary in ONE downloadable reference PDF.
   Built on vendored jsPDF 2.5.1 + jspdf-autotable 3.8.2
   (js/vendor/, MIT — no CDN, no runtime network; the offline /
   privacy audit stays green: zero XHR/WebSocket, ever).
   Reuses CFOPDF.buildCFOData for Part A so the numbers always
   match the standalone CFO PDF download.
   Browser: js/vendor/*.min.js, js/cfo-pdf.js, then this file.
   Node: require('jspdf') + require('jspdf-autotable') + ./cfo-pdf.js.
   Node-testable via module.exports.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- CFO access (browser global vs Node require) ---------- */
function CFO() {
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try { return require('./cfo-pdf.js'); } catch (e) { /* fall through */ }
  }
  var r = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  return (r && r.CFOPDF) || null;
}

function getJsPDFCtor() {
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try {
      var ns = require('jspdf');
      try { require('jspdf-autotable'); } catch (e2) { /* optional */ }
      if (ns && ns.jsPDF) return ns.jsPDF;
    } catch (e) { /* fall through to globals */ }
  }
  var g = (root && root.jspdf) || {};
  if (g.jsPDF) return g.jsPDF;
  throw new Error('Full-report engine missing: load js/vendor/jspdf.umd.min.js + jspdf-autotable.min.js first (browser) or npm install (Node).');
}

/* ---------- small formatters (WinAnsi-safe, same as CFO engine) ---------- */
var SAN_MAP = {
  '\u2014': '--', '\u2013': '-', '\u2012': '-', '\u2212': '-',
  '\u2192': '->', '\u2190': '<-', '\u21D2': '=>', '\u2713': 'ok',
  '\u00B1': '+/-', '\u00D7': 'x', '\u2022': '-', '\u00B7': '-',
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2026': '...', '\u00A0': ' ', '\u2009': ' ', '\u200B': '',
  '\u2714': 'ok', '\u26A0': '!', '\u2191': '^', '\u2193': 'v'
};
function san(s) {
  var t = String(s == null ? '' : s);
  var out = '';
  for (var i = 0; i < t.length; i++) {
    var ch = t[i];
    var code = t.charCodeAt(i);
    if (code >= 32 && code <= 126) out += ch;
    else if (SAN_MAP[ch]) out += SAN_MAP[ch];
    else if (code === 10 || code === 13) out += ' ';
    else if (code > 126) out += '?';
    else out += ch;
  }
  return out;
}
function money(n) {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function num(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-US');
}
function bytesFmt(b) {
  if (!b || isNaN(b)) return '0 B';
  var k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = Math.floor(Math.log(Math.abs(b)) / Math.log(k));
  if (i < 0) i = 0; if (i >= s.length) i = s.length - 1;
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
}
function pct(x) {
  if (x == null || isNaN(x)) return '0.0%';
  return Number(x).toFixed(1) + '%';
}
function isoDay(v) {
  try {
    if (!v) return '--';
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch (e) { return '--'; }
}
function shortStr(s, max) {
  var t = san(s || '');
  if (t.length <= max) return t;
  return t.slice(0, max - 3) + '...';
}
var TIER_LABEL = {
  human: 'Human', ai_training: 'AI Training', ai_search_index: 'AI Search-Index',
  ai_user_fetch: 'AI User Fetch', search_engine: 'Search Engine', seo_tool: 'SEO Tool',
  monitoring: 'Monitoring', social: 'Social', unknown_bot: 'Unknown Bot',
  suspicious: 'Suspicious', unclassified: 'Unclassified', unknown: 'Unknown'
};
function tierLabel(t) { return TIER_LABEL[t] || String(t || 'Unknown'); }

/* ---------- full-report data model (single source for PDF + tests) ---------- */
function buildFullData(A, opts) {
  opts = opts || {};
  var cfo = null;
  try {
    var eng = CFO();
    if (eng && eng.buildCFOData) cfo = eng.buildCFOData(A, opts);
  } catch (e) { cfo = null; }
  if (!cfo) throw new Error('Full-report needs the CFO engine: load js/cfo-pdf.js before js/full-report-pdf.js.');

  var s = (A && A.summary) || {};
  var c = (A && A.costs) || { total: { egress: 0, request: 0, ssr: 0, all: 0 }, savings: { botBlocking: 0, byTier: {} }, byBot: {}, ci: {} };
  var bd = (A && A.botData) || {};
  var total = +((c.total && c.total.all) || 0);
  var records = s.totalRecords || 0;

  // Module 1 — classification
  var tierAgg = {};
  Object.keys(bd).forEach(function (bn) {
    var b = bd[bn] || {};
    var t = b.tier || 'unknown';
    if (!tierAgg[t]) tierAgg[t] = { tier: t, bots: 0, reqs: 0, bytes: 0, cost: 0 };
    tierAgg[t].bots++;
    tierAgg[t].reqs += b.count || 0;
    tierAgg[t].bytes += b.totalBytes || 0;
    tierAgg[t].cost += (c.byBot && c.byBot[bn] && +c.byBot[bn].total) || 0;
  });
  var tiers = Object.keys(tierAgg).map(function (t) {
    var r = tierAgg[t];
    r.share = total > 0 ? r.cost / total * 100 : 0;
    return r;
  }).sort(function (a, b) { return b.cost - a.cost; });
  var topBots = Object.keys(c.byBot || {}).map(function (bn) {
    var v = c.byBot[bn] || {};
    return { bot: bn, tier: (bd[bn] && bd[bn].tier) || '', count: v.count || 0, bytes: v.totalBytes || 0, cost: v.total || 0 };
  }).sort(function (a, b) { return b.cost - a.cost; }).slice(0, 25);
  var topUA = [];
  try { topUA = ((A.tp && A.tp.topUA) || []).slice(0, 10); } catch (e) {}

  // Module 2 — verification
  var vs = (A && A.vs) || {};
  var spoof = (A && A.spoof) || {};
  var unByBot = [];
  try { unByBot = (spoof.byBot || []).slice(0, 10); } catch (e) {}

  // Module 3 — crawl budget + traps + render gap
  var eng2 = [];
  try {
    eng2 = Object.keys(A.crawlBud || {}).map(function (k) { return A.crawlBud[k]; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 12);
  } catch (e) {}
  var traps = [];
  try {
    traps = Object.entries(A.traps || {}).map(function (e2) { return { name: e2[0], count: e2[1].count, paths: e2[1].uniqueCount, bytes: e2[1].bytes, sev: e2[1].sev || '' }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
  } catch (e) {}
  var jsShell = (A && A.jsShell) || { total: 0, byBot: [], minBytes: 5120 };

  // Module 4 — costs (top 20 by total)
  var costRows = Object.keys(c.byBot || {}).map(function (bn) {
    var v = c.byBot[bn] || {};
    return { bot: bn, tier: (bd[bn] && bd[bn].tier) || '', count: v.count || 0, bytes: v.totalBytes || 0, eg: v.eg || 0, rq: v.rq || 0, ss: v.ss || 0, total: v.total || 0, share: total > 0 ? (v.total || 0) / total * 100 : 0 };
  }).sort(function (a, b) { return b.total - a.total; }).slice(0, 20);

  // Module 5 — AI matrix
  var aiRows = [];
  try {
    aiRows = Object.entries(A.aiMatrix || {}).map(function (e3) {
      var b = e3[1] || {};
      var nt = b.tier || '';
      var rec = nt === 'ai_search_index' ? 'ALLOW @120/min -- check referrals' : nt === 'ai_user_fetch' ? 'DO NOT BLOCK -- user-triggered' : 'Consider blocking -- zero referral value';
      return { bot: e3[0], tier: nt, count: b.count || 0, bytes: b.totalBytes || 0, bandCost: b.bandCost || 0, cpReq: (b.count > 0) ? (b.bandCost || 0) / b.count : 0, rec: rec };
    }).sort(function (a, b) { return b.bandCost - a.bandCost; }).slice(0, 20);
  } catch (e) {}

  // Module 6 — edge + policy
  var edge = { cloudflare: [], fastly: [], aws: [], robots: '', decision: '', cfAICrawl: '' };
  try {
    var er = A.edgeRules || {};
    ['cloudflare', 'fastly', 'aws'].forEach(function (p) {
      edge[p] = ((er[p] || []).slice(0, 12)).map(function (r) {
        return { name: r.name || '', act: r.act || '', rule: shortStr(r.rule || '', 140) };
      });
    });
    edge.robots = String(er.robots || '');
    edge.decision = String(er.decision || '');
    edge.cfAICrawl = String(er.cfAICrawl || '');
  } catch (e) {}

  // Module 7 — performance
  var slow = [];
  try {
    slow = Object.values(bd).filter(function (b) { return b.avgMs != null; })
      .sort(function (a, b) { return b.avgMs - a.avgMs; }).slice(0, 12);
  } catch (e) {}
  var statuses = [], methods = [], hourly = [];
  try {
    var tp = A.tp || {};
    statuses = Object.entries(tp.statuses || {}).sort().map(function (e4) { return { k: e4[0], v: e4[1], share: records > 0 ? e4[1] / records * 100 : 0 }; });
    var mTot = Object.values(tp.methods || {}).reduce(function (x, y) { return x + y; }, 0);
    methods = Object.entries(tp.methods || {}).sort(function (a, b) { return b[1] - a[1]; }).map(function (e5) { return { k: e5[0], v: e5[1], share: mTot > 0 ? e5[1] / mTot * 100 : 0 }; });
    var spikes = tp.spikes || {};
    hourly = (tp.hourly || []).map(function (v, h) { return { h: h, v: v, spike: !!spikes[h] }; });
  } catch (e) {}

  // Module 8 — dynamics
  var an = (A && A.anomalies) || {};
  var bursts = [], not404 = [];
  try { bursts = (an.bursts || []).slice(0, 15); } catch (e) {}
  try { not404 = (an.not404 || []).slice(0, 10); } catch (e) {}
  var daily = [], topIPs = [], topRef = [];
  try {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    daily = ((A.tp && A.tp.daily) || []).map(function (v, i) { return { d: days[i] || ('Day ' + i), v: v }; });
    topIPs = ((A.tp && A.tp.topIPs) || []).slice(0, 10);
    topRef = ((A.tp && A.tp.topRef) || []).slice(0, 10);
  } catch (e) {}

  // Module 9 — security
  var sec = (A && A.sec) || {};
  var grouped = {};
  try {
    (sec.threats || []).forEach(function (t) {
      var k = t.type || 'unknown';
      if (!grouped[k]) grouped[k] = { type: k, sev: t.sev || '', count: 0 };
      grouped[k].count++;
    });
  } catch (e) {}
  var threatGroups = Object.keys(grouped).map(function (k) { return grouped[k]; })
    .sort(function (a, b) { return b.count - a.count; }).slice(0, 15);
  var hvIPs = [], stealth = [], largeP = [];
  try { hvIPs = (sec.hvIPs || []).slice(0, 10); } catch (e) {}
  try { stealth = ((A && A.stealth) || []).slice(0, 10); } catch (e) {}
  try { largeP = (sec.largeP || []).slice(0, 5); } catch (e) {}

  return {
    meta: cfo.meta,
    kpis: cfo.kpis,
    cfo: cfo,
    classification: { tiers: tiers, topBots: topBots, topUA: topUA },
    verification: { matches: vs.matches || vs.verified || 0, unusual: vs.unusual || vs.suspicious || 0, informational: vs.informational || 0, skipped: vs.skipped || 0, sampled: !!(vs.sampled || vs.verifySampled), claimed: spoof.claimed || 0, verified: spoof.verified || 0, unverified: spoof.unverified || 0, unverifiedPct: spoof.unverifiedPct || 0, unByBot: unByBot },
    crawl: { eng: eng2, traps: traps, jsTotal: jsShell.total || 0, jsMin: jsShell.minBytes || 5120, jsByBot: (jsShell.byBot || []).slice(0, 5) },
    costs: { rows: costRows, total: c.total, blockable: +((c.savings && c.savings.botBlocking) || 0), ciAbs: (c.ci && c.ci.abs) || 0, ciRel: (c.ci && c.ci.rel) || 0 },
    ai: { rows: aiRows },
    edge: edge,
    perf: { slow: slow, statuses: statuses, methods: methods, hourly: hourly },
    dynamics: { bursts: bursts, not404: not404, daily: daily, topIPs: topIPs, topRef: topRef },
    security: { totalIPs: sec.totalIPs || 0, threatCount: (sec.threats || []).length, groups: threatGroups, hvIPs: hvIPs, stealth: stealth, largeP: largeP, velocityThreshold: sec.velocityThreshold || 0 }
  };
}

/* ---------- layout (M3 modern, mirrors the CFO engine) ---------- */
var M = 44, PW = 595, PH = 842, CW = PW - M * 2;
var INK = [25, 28, 34], MUT = [68, 71, 78], FAINT = [116, 119, 127];
var ACC = [11, 87, 208], ACC_DK = [4, 66, 160], HDRF = [25, 28, 34];
var GRID = [220, 227, 238], ZEBRA = [243, 246, 251], RED = [179, 38, 30];
var BLUE_BG = [211, 227, 253], GREEN_BG = [237, 255, 240];
var TOTAL_PAGES = '{total_pages_count_string}';
var BODY_BOTTOM = PH - 62, FOOT_Y = PH - 30;

function drawHeader(doc, d) {
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.rect(0, 0, PW, 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text(san('FULL ANALYSIS REPORT - BOT TRAFFIC + COST'), M, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(211, 227, 253);
  doc.text(san(d.meta.domain + '  |  ' + d.meta.periodStart + ' to ' + d.meta.periodEnd + '  |  Generated ' + d.meta.generated), M, 39);
  var badge = san(d.meta.badge);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
  var bw = doc.getTextWidth(badge) + 16;
  var bx = PW - M - bw;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(bx, 28, bw, 14, 7, 7, 'F');
  doc.setTextColor(ACC[0], ACC[1], ACC[2]);
  doc.text(badge, bx + bw / 2, 37.5, { align: 'center' });
}
function drawFooter(doc, pageNo) {
  var y = FOOT_Y;
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.5);
  doc.line(M, y - 9, PW - M, y - 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3);
  doc.setTextColor(FAINT[0], FAINT[1], FAINT[2]);
  doc.text(san('Confidential  |  Full reference export -- all 10 modules + CFO summary. Measured bytes x configured pricing.'), M, y);
  doc.text(san('Page ' + pageNo + ' of ' + TOTAL_PAGES), PW - M, y, { align: 'right' });
}
function stampChrome(doc, d) {
  var n = doc.getNumberOfPages();
  for (var i = 1; i <= n; i++) {
    doc.setPage(i);
    drawHeader(doc, d);
    drawFooter(doc, i);
  }
}
function ensure(doc, d, y, need) {
  if (y + need > BODY_BOTTOM) { doc.addPage(); return 78; }
  return y;
}
function h1(doc, d, y, num2, title) {
  y = ensure(doc, d, y, 96);
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.circle(M + 8, y - 4, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(String(num2), M + 8, y - 1, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.setTextColor(HDRF[0], HDRF[1], HDRF[2]);
  doc.text(san(title), M + 22, y);
  y += 7;
  doc.setDrawColor(ACC[0], ACC[1], ACC[2]); doc.setLineWidth(1.2);
  doc.line(M, y, M + 34, y);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.5);
  doc.line(M + 34, y, PW - M, y);
  return y + 16;
}
function h2(doc, d, y, t) {
  y = ensure(doc, d, y, 64);
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.rect(M, y - 8.5, 3, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(HDRF[0], HDRF[1], HDRF[2]);
  doc.text(san(t), M + 9, y);
  return y + 14;
}
function para(doc, d, y, t, size) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size || 8.5);
  doc.setTextColor(MUT[0], MUT[1], MUT[2]);
  var lines = doc.splitTextToSize(san(t), CW - 4);
  for (var i = 0; i < lines.length; i++) {
    y = ensure(doc, d, y, 13);
    doc.text(lines[i], M + 2, y);
    y += 12;
  }
  return y + 4;
}
function bullets(doc, d, y, items, size) {
  for (var i = 0; i < items.length; i++) y = para(doc, d, y, '- ' + items[i], size || 7.5);
  return y;
}
var TABLE_BASE = {
  theme: 'grid',
  margin: { left: M, right: M },
  styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 5, right: 6, bottom: 5, left: 6 }, textColor: INK, lineColor: GRID, lineWidth: 0.5, valign: 'middle', overflow: 'linebreak' },
  headStyles: { fillColor: ACC, textColor: 255, fontStyle: 'bold', fontSize: 7.2, cellPadding: { top: 6, right: 6, bottom: 6, left: 6 } },
  alternateRowStyles: { fillColor: ZEBRA },
  showHead: 'everyPage'
};
function table(doc, d, y, head, body, colStyles) {
  if (!body.length) return para(doc, d, y, 'None in this window.', 8);
  y = ensure(doc, d, y, 52);
  doc.autoTable(Object.assign({}, TABLE_BASE, {
    startY: y, head: [head.map(san)], body: body.map(function (r) { return r.map(san); }),
    columnStyles: colStyles || {}
  }));
  return doc.lastAutoTable.finalY + 12;
}
function codeBlock(doc, d, y, title, text, maxLines) {
  var all = san(text || '').split('\n');
  var lines = all.slice(0, maxLines || 60);
  var truncated = all.length > lines.length;
  y = ensure(doc, d, y, 40);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setTextColor(ACC_DK[0], ACC_DK[1], ACC_DK[2]);
  doc.text(san(title) + (truncated ? '  (truncated -- full text in Module 6)' : ''), M + 2, y);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (var i = 0; i < lines.length; i++) {
    var wrapped = doc.splitTextToSize(lines[i] || ' ', CW - 12);
    for (var w = 0; w < wrapped.length; w++) {
      y = ensure(doc, d, y, 11);
      doc.text(wrapped[w], M + 6, y);
      y += 10;
    }
  }
  return y + 6;
}
function kpiGrid(doc, d, y, kpis) {
  var gap = 12, gw = (CW - gap) / 2, gh = 58;
  y = ensure(doc, d, y, gh * 2 + gap + 6);
  for (var i = 0; i < kpis.length; i++) {
    var x = M + (i % 2) * (gw + gap);
    var yy = y + Math.floor(i / 2) * (gh + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.6);
    doc.roundedRect(x, yy, gw, gh, 6, 6, 'FD');
    doc.setFillColor(kpis[i].bar[0], kpis[i].bar[1], kpis[i].bar[2]);
    doc.roundedRect(x, yy, gw, 4.5, 6, 6, 'F');
    doc.rect(x, yy + 2.5, gw, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6);
    doc.setTextColor(FAINT[0], FAINT[1], FAINT[2]);
    doc.text(kpis[i].l, x + 12, yy + 19);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(kpis[i].v, x + 12, yy + 37);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(MUT[0], MUT[1], MUT[2]);
    doc.text(kpis[i].s.slice(0, 52), x + 12, yy + 49);
  }
  return y + gh * Math.ceil(kpis.length / 2) + gap * (Math.ceil(kpis.length / 2) - 1) + 12;
}
function recBox(doc, d, y, title, body, bg) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8);
  var recLines = doc.splitTextToSize(san(body), CW - 30);
  var recH = 30 + recLines.length * 12.5;
  y = ensure(doc, d, y, recH + 10);
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.6);
  doc.roundedRect(M, y, CW, recH, 6, 6, 'FD');
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.roundedRect(M, y, 4.5, recH, 6, 6, 'F');
  doc.rect(M + 2, y, 2.5, recH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
  doc.setTextColor(ACC_DK[0], ACC_DK[1], ACC_DK[2]);
  doc.text(san(title), M + 14, y + 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (var ri = 0; ri < recLines.length; ri++) doc.text(recLines[ri], M + 14, y + 30 + ri * 12.5);
  return y + recH + 12;
}

/* ---------- document assembly ---------- */
var AI_REF = [
  ['OAI-SearchBot', 'search-index', '85 : 1', 'ALLOW @120/min -- block = citation loss in 1-2 wks'],
  ['PerplexityBot', 'search-index', '210 : 1', 'ALLOW @120/min -- best search ROI'],
  ['ClaudeBot (training)', 'training', '~5,143 : 1', 'Block freely -- worst ratio'],
  ['GPTBot / CCBot / Bytespider', 'training', 'infinite (zero referrals)', 'Block freely -- zero live citation loss']
];

function generateFullPDFBytes(A, opts) {
  var d = buildFullData(A, opts);
  var f = d.cfo;
  var JsPDF = getJsPDFCtor();
  var doc = new JsPDF({ unit: 'pt', format: 'a4', compress: false });
  var y = 78;

  // Cover
  y = recBox(doc, d, y, 'BOT TRAFFIC COST - FULL ANALYSIS REPORT',
    'Complete reference export: all 10 analysis modules plus the CFO executive summary in one file. ' +
    num(d.meta.records) + ' records (' + bytesFmt(f.totalBytes) + ') from ' + d.meta.periodStart + ' to ' + d.meta.periodEnd +
    '. Pricing: ' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K. ' +
    d.meta.badge + ' analysis. Keep this PDF with the log file it describes -- re-run after each deploy.', BLUE_BG);
  y = h2(doc, d, y, 'Contents');
  y = bullets(doc, d, y, [
    'A. Executive summary (CFO) -- recommendation, KPIs, tiers, top bots, traps, actions, sign-off',
    'Module 1 -- Bot classification: tier split, top 25 bots, top user-agents',
    'Module 2 -- Verification: 4-layer checks, spoof KPI, unverified bots',
    'Module 3 -- Crawl budget: crawler efficiency, traps, render gap (GEO)',
    'Module 4 -- Costs: per-bot measured cost, blockable waste, confidence interval',
    'Module 5 -- AI matrix: AI bot cost, policy per class, crawl-to-referral reference',
    'Module 6 -- Edge + policy: Cloudflare / Fastly / AWS rules, robots.txt, decision tree',
    'Module 7 -- Performance: TTFB ranking, status codes, methods, hourly traffic',
    'Module 8 -- Dynamics: bursts, 404 clusters, day-of-week, top IPs, referrers',
    'Module 9 -- Security: threats, high-velocity IPs, stealth scores, large payloads',
    'Appendix -- method, limits, how to re-run'
  ], 7.5);

  // Part A — Executive summary (CFO content, same numbers as the CFO PDF)
  y = h1(doc, d, y, 'A', 'Executive summary (CFO)');
  y = recBox(doc, d, y, 'EXECUTIVE RECOMMENDATION',
    'AI training bots consumed ' + money(f.kpis.blockable) + ' (' + pct(f.kpis.blockableShare) + ' of egress) with zero citation value. Blocking recovers ~' + money(f.kpis.monthly) + '/mo (' + money(f.kpis.annual) + '/yr). Search-index + user-fetch traffic must stay allowed -- blocking drops AI citations in 1-2 weeks and breaks shopping-ad verification.', BLUE_BG);
  y = kpiGrid(doc, d, y, [
    { l: 'TOTAL PERIOD COST', v: money(f.kpis.total), s: num(d.meta.records) + ' records  |  ' + bytesFmt(f.totalBytes), bar: ACC },
    { l: 'BLOCKABLE (PERIOD)', v: money(f.kpis.blockable) + '  (' + pct(f.kpis.blockableShare) + ')', s: 'Training + suspicious only', bar: RED },
    { l: 'PROJECTED MONTHLY SAVING', v: money(f.kpis.monthly) + ' / mo', s: 'Scaled x' + f.kpis.monthlyFactor.toFixed(2) + ' from window', bar: [19, 115, 51] },
    { l: 'PROJECTED ANNUAL SAVING', v: money(f.kpis.annual) + ' / yr', s: '12 x monthly  |  95% CI +/-' + money(d.meta.ciAbs), bar: [11, 114, 133] }
  ]);
  y = h2(doc, d, y, 'Cost breakdown by tier');
  y = table(doc, d, y, ['Tier', 'Requests', 'Bandwidth', 'Cost', 'Share'],
    f.tierRows.map(function (r) { return [tierLabel(r.tier), num(r.reqs), bytesFmt(r.bytes), money(r.cost), pct(r.share)]; }),
    { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  y = h2(doc, d, y, 'Top cost bots (measured)');
  y = table(doc, d, y, ['Bot', 'Tier', 'Reqs', 'Bytes', 'Cost'],
    f.topBots.map(function (b) { return [shortStr(b.bot, 40), tierLabel(b.tier), num(b.count), bytesFmt(b.bytes), money(b.cost)]; }),
    { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', textColor: RED, fontStyle: 'bold' } });
  if (f.traps.length) {
    y = h2(doc, d, y, 'Crawl traps -> $ waste (fix owners: Eng/SEO)');
    y = table(doc, d, y, ['Trap', 'Reqs', 'Waste', 'Cost', 'Share'],
      f.traps.map(function (t) { return [t.name, num(t.count), bytesFmt(t.bytes), money(t.cost), pct(t.share)]; }),
      { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  }
  if (f.actions.length) {
    y = h2(doc, d, y, 'Edge actions (finance-safe, eng-ready)');
    y = table(doc, d, y, ['Bot', 'Edge action', 'Saving', 'Risk'],
      f.actions.map(function (a) { return [shortStr(a.bot, 30), a.action, money(a.saving), a.risk]; }),
      { 0: { fontStyle: 'bold' }, 2: { halign: 'right' } });
  }
  y = h2(doc, d, y, 'Do NOT block (revenue / citation protection)');
  y = bullets(doc, d, y, f.doNotBlock, 7.5);
  if (f.kpis.ppcMonthly > 0.5) y = recBox(doc, d, y, 'PAY PER CRAWL UPSIDE', '402 beta: $0.002 per training request = ~' + money(f.kpis.ppcMonthly) + '/mo recoverable instead of a pure block. Search-index + user-fetch always bypass the paywall.', GREEN_BG);
  y = h2(doc, d, y, 'Recommended next steps');
  var steps = [];
  try { var eng0 = CFO(); steps = eng0.nextSteps(f); } catch (e) { steps = []; }
  for (var si = 0; si < steps.length; si++) y = para(doc, d, y, (si + 1) + '. ' + steps[si], 7.5);

  // Module 1
  y = h1(doc, d, y, '1', 'Bot classification & behavioral engine');
  y = para(doc, d, y, 'Every request classified by User-Agent string matching against 127 bot signatures and 18 browser fingerprint patterns (bot signatures take precedence to prevent spoofing). No subjective value scores -- this report measures cost; you determine value from analytics.', 8);
  y = h2(doc, d, y, 'Traffic distribution by category');
  y = table(doc, d, y, ['Category', 'Bots', 'Requests', 'Bandwidth', 'Cost', 'Share'],
    d.classification.tiers.map(function (t) { return [tierLabel(t.tier), num(t.bots), num(t.reqs), bytesFmt(t.bytes), money(t.cost), pct(t.share)]; }),
    { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } });
  y = h2(doc, d, y, 'Top 25 bots by cost');
  y = table(doc, d, y, ['Bot', 'Category', 'Requests', 'Bandwidth', 'Cost'],
    d.classification.topBots.map(function (b) { return [shortStr(b.bot, 36), tierLabel(b.tier), num(b.count), bytesFmt(b.bytes), money(b.cost)]; }),
    { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  if (d.classification.topUA.length) {
    y = h2(doc, d, y, 'Top user-agent strings (truncated -- copy full UA from Module 1 in the tool)');
    y = table(doc, d, y, ['User-Agent (first 110 chars)', 'Count'],
      d.classification.topUA.map(function (u) { return [shortStr(u[0], 110), num(u[1])]; }),
      { 1: { halign: 'right' } });
  }

  // Module 2
  y = h1(doc, d, y, '2', 'Multi-layer bot verification');
  y = para(doc, d, y, 'Four heuristic layers (IP range, TLS, cloud-host, behavior). Signals, not proof -- confirm with vendor IP JSON + server-side reverse DNS (dig -x) before enforcing blocks. Never block on UA alone.', 8);
  y = table(doc, d, y, ['Check', 'Count'],
    [['Matching expected patterns', num(d.verification.matches)], ['Flagged unusual', num(d.verification.unusual)], ['Informational only', num(d.verification.informational)], ['Skipped (no data)', num(d.verification.skipped)], ['Claimed AI fetches', num(d.verification.claimed)], ['Verified via vendor IP JSON', num(d.verification.verified)], ['UNVERIFIED fetches', num(d.verification.unverified) + ' (' + pct(d.verification.unverifiedPct) + ')']].concat(d.verification.sampled ? [['Sampling', 'Scaled from sampled verification base']] : []),
    { 1: { halign: 'right' } });
  if (d.verification.unByBot.length) {
    y = h2(doc, d, y, 'Top unverified bots (verify before blocking)');
    y = table(doc, d, y, ['Bot', 'Unverified fetches'],
      d.verification.unByBot.map(function (u) { return [u[0], num(u[1])]; }),
      { 1: { halign: 'right' } });
  }

  // Module 3
  y = h1(doc, d, y, '3', 'Crawl budget, traps & render gap');
  y = para(doc, d, y, 'Parameterized URLs, faceted navigation and trap patterns burn the crawl budget that should go to high-value pages. AI fetchers read raw HTML with no JS -- a 200 + tiny body is a JS shell with zero citation chance.', 8);
  if (d.crawl.eng.length) {
    y = h2(doc, d, y, 'Search-engine crawl efficiency');
    y = table(doc, d, y, ['Crawler', 'Total', 'Unique URLs', '2xx', 'Param %', 'Efficiency'],
      d.crawl.eng.map(function (e) { return [shortStr(e.name, 28), num(e.total), num(e.uniqueCount), num(e.s2xx), pct(e.paramRatio), pct(e.efficiency)]; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } });
  } else y = para(doc, d, y, 'No search-engine or AI citation crawlers in this window.', 8);
  if (d.crawl.traps.length) {
    y = h2(doc, d, y, 'Crawl-trap detection');
    y = table(doc, d, y, ['Trap pattern', 'Severity', 'Requests', 'Unique paths', 'Bandwidth'],
      d.crawl.traps.map(function (t) { return [t.name, (t.sev || '').toUpperCase(), num(t.count), num(t.paths), bytesFmt(t.bytes)]; }),
      { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  }
  y = h2(doc, d, y, 'Render gap -- JS shells (GEO)');
  if (d.crawl.jsTotal > 0) {
    y = para(doc, d, y, num(d.crawl.jsTotal) + ' AI-bot 200s under ' + num(d.crawl.jsMin) + 'B. Top offenders: ' + d.crawl.jsByBot.map(function (b) { return b.bot + ' (' + b.count + ')'; }).join(', ') + '. Fix: server-render critical content, inline quotable facts + FAQ blocks.', 8);
  } else y = para(doc, d, y, 'No JS-shell suspects -- AI-bot 200s all exceed ' + num(d.crawl.jsMin) + 'B, or no AI bots in this window.', 8);

  // Module 4
  y = h1(doc, d, y, '4', 'Infrastructure cost analysis');
  y = para(doc, d, y, 'Measured bytes x configured pricing (' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K). Origin-compute excluded unless opted in. 95% CI +/-' + money(d.costs.ciAbs) + '.', 8);
  y = h2(doc, d, y, 'Cost by bot (top 20)');
  y = table(doc, d, y, ['Bot', 'Requests', 'Bandwidth', 'Egress', 'Req cost', 'Total', 'Share'],
    d.costs.rows.map(function (r) { return [shortStr(r.bot, 30), num(r.count), bytesFmt(r.bytes), money(r.eg), money(r.rq), money(r.total), pct(r.share)]; }),
    { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } });
  y = recBox(doc, d, y, 'BLOCKABLE WASTE', 'Blocking AI training + suspicious traffic recovers ' + money(d.costs.blockable) + ' in this period. Period total ' + money(d.costs.total.all) + ' (egress ' + money(d.costs.total.egress) + ' + requests ' + money(d.costs.total.request) + (d.costs.total.ssr > 0 ? ' + compute ' + money(d.costs.total.ssr) : '') + ').', GREEN_BG);

  // Module 5
  y = h1(doc, d, y, '5', 'AI scraper citation ROI matrix');
  y = para(doc, d, y, 'Measured cost per AI bot from your logs. Whether a bot is valuable depends on YOUR analytics: check referral traffic from AI domains before allowing.', 8);
  if (d.ai.rows.length) {
    y = table(doc, d, y, ['AI bot', 'Class', 'Requests', 'Bandwidth', 'Egress cost', 'Cost/req', 'Recommendation'],
      d.ai.rows.map(function (b) { return [shortStr(b.bot, 26), tierLabel(b.tier), num(b.count), bytesFmt(b.bytes), money(b.bandCost), money(b.cpReq), b.rec]; }),
      { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } });
  } else y = para(doc, d, y, 'No AI scraper bots detected.', 8);
  y = h2(doc, d, y, 'Crawl-to-referral reference (why the tiers differ)');
  y = table(doc, d, y, ['Bot', 'Class', 'Crawl : referral', 'Policy'],
    AI_REF.map(function (r) { return r; }), { 2: { halign: 'right' } });

  // Module 6
  y = h1(doc, d, y, '6', 'Edge + policy bundle');
  y = para(doc, d, y, 'Ready-to-deploy rules from your log data. Training = block/challenge freely. Search-index = 429-only, never hard block. User-fetch = allow + abuse ceiling (429 = missing live answer). OAI-AdsBot is allow-listed -- blocking breaks shopping ads. Rule text truncated to 140 chars here; copy full rules from Module 6 in the tool.', 8);
  var provNames = { cloudflare: 'Cloudflare WAF rules', fastly: 'Fastly VCL snippets', aws: 'AWS WAF rules' };
  ['cloudflare', 'fastly', 'aws'].forEach(function (p) {
    if (d.edge[p].length) {
      y = h2(doc, d, y, provNames[p]);
      y = table(doc, d, y, ['Rule', 'Action', 'Match (truncated)'],
        d.edge[p].map(function (r) { return [shortStr(r.name, 34), r.act, r.rule]; }));
    }
  });
  if (!d.edge.cloudflare.length && !d.edge.fastly.length && !d.edge.aws.length) y = para(doc, d, y, 'No rules generated -- no bot met the enforcement threshold (training/suspicious: 2+ requests; user-triggered: 1+). Upload a larger window.', 8);
  if (d.edge.decision) y = codeBlock(doc, d, y, '429 vs challenge vs block -- decision tree', d.edge.decision, 12);
  if (d.edge.robots) y = codeBlock(doc, d, y, 'robots.txt -- training vs search split', d.edge.robots, 60);
  if (d.edge.cfAICrawl) y = para(doc, d, y, 'Cloudflare AI Crawl Control: ' + d.edge.cfAICrawl, 7.5);

  // Module 7
  y = h1(doc, d, y, '7', 'Performance deep dive');
  y = para(doc, d, y, 'TTFB by traffic category. Slow bots = origin compute pressure. Slow humans = lost revenue (lab heuristic: ~100ms ~= -1% conversion; confirm in CrUX/RUM).', 8);
  if (d.perf.slow.length) {
    y = h2(doc, d, y, 'Slowest responders (avg TTFB)');
    y = table(doc, d, y, ['Bot', 'Category', 'Requests', 'Avg TTFB', 'P95 TTFB'],
      d.perf.slow.map(function (b) { return [shortStr(b.name, 30), tierLabel(b.tier), num(b.count), Math.round(b.avgMs) + 'ms', b.p95Ms ? Math.round(b.p95Ms) + 'ms' : '--']; }),
      { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  }
  if (d.perf.statuses.length) {
    y = h2(doc, d, y, 'Status-code distribution');
    y = table(doc, d, y, ['Status', 'Count', 'Share'],
      d.perf.statuses.map(function (r) { return [r.k, num(r.v), pct(r.share)]; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' } });
  }
  if (d.perf.methods.length) {
    y = h2(doc, d, y, 'HTTP methods');
    y = table(doc, d, y, ['Method', 'Count', 'Share'],
      d.perf.methods.map(function (r) { return [r.k, num(r.v), pct(r.share)]; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' } });
  }
  if (d.perf.hourly.length) {
    y = h2(doc, d, y, 'Hourly traffic (UTC -- * = spike over mean + 2 std dev)');
    y = table(doc, d, y, ['Hour', 'Requests', 'Spike'],
      d.perf.hourly.map(function (r) { return [String(r.h).padStart(2, '0') + ':00', num(r.v), r.spike ? 'YES *' : '--']; }),
      { 1: { halign: 'right' }, 2: { halign: 'center' } });
  }

  // Module 8
  y = h1(doc, d, y, '8', 'Dynamics -- bursts, weekdays, referrers');
  if (d.dynamics.bursts.length) {
    y = h2(doc, d, y, 'Per-bot bursts (rolling 7d baseline)');
    y = table(doc, d, y, ['Bot', 'Hour (UTC)', 'Count', 'z', 'Note'],
      d.dynamics.bursts.map(function (b) { return [shortStr(b.bot, 26), shortStr(b.hour || '', 20), num(b.count), b.z == null ? 'n/a' : String(b.z), shortStr(b.note || '', 40)]; }),
      { 2: { halign: 'right' }, 3: { halign: 'right' } });
  } else y = para(doc, d, y, 'No per-bot bursts (requires n>30, z>=3, >=2x rolling mean, >=10 req/hr).', 8);
  if (d.dynamics.not404.length) {
    y = h2(doc, d, y, '404 clusters (sensitive paths)');
    y = table(doc, d, y, ['URI', 'Hits'],
      d.dynamics.not404.map(function (x) { return [shortStr(x.uri, 70), num(x.count)]; }),
      { 1: { halign: 'right' } });
  }
  if (d.dynamics.daily.length) {
    y = h2(doc, d, y, 'Day-of-week distribution');
    y = table(doc, d, y, ['Day', 'Requests'],
      d.dynamics.daily.map(function (r) { return [r.d, num(r.v)]; }),
      { 1: { halign: 'right' } });
  }
  if (d.dynamics.topIPs.length) {
    y = h2(doc, d, y, 'Top IPs by volume');
    y = table(doc, d, y, ['IP', 'Requests'],
      d.dynamics.topIPs.map(function (u) { return [u[0], num(u[1])]; }),
      { 1: { halign: 'right' } });
  }
  if (d.dynamics.topRef.length) {
    y = h2(doc, d, y, 'Top referrers');
    y = table(doc, d, y, ['Referrer', 'Requests'],
      d.dynamics.topRef.map(function (u) { return [shortStr(u[0], 60), num(u[1])]; }),
      { 1: { halign: 'right' } });
  }

  // Module 9
  y = h1(doc, d, y, '9', 'Security threat intelligence');
  y = table(doc, d, y, ['Signal', 'Count'],
    [['Unique IPs', num(d.security.totalIPs)], ['Suspicious patterns', num(d.security.threatCount)], ['High-velocity IPs', num(d.security.hvIPs.length)], ['Velocity threshold', d.security.velocityThreshold.toFixed(1) + ' req/sec (mean + 2 std dev)'], ['Stealth-flagged IPs (score >= 40)', num(d.security.stealth.length)], ['Large payloads (>10MB)', num(d.security.largeP.length)]],
    { 1: { halign: 'right' } });
  if (d.security.groups.length) {
    y = h2(doc, d, y, 'Threat patterns (grouped)');
    y = table(doc, d, y, ['Threat', 'Severity', 'Count'],
      d.security.groups.map(function (t) { return [t.type, (t.sev || '').toUpperCase(), num(t.count)]; }),
      { 2: { halign: 'right' } });
  }
  if (d.security.hvIPs.length) {
    y = h2(doc, d, y, 'High-velocity IPs (top 10 -- block at edge)');
    y = table(doc, d, y, ['IP', 'Requests', 'Req/sec', 'URLs', '4xx'],
      d.security.hvIPs.map(function (x) { return [x.ip, num(x.count), (+x.rps).toFixed(1), num(x.uniqueUrls), num(x.s4xx)]; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  }
  if (d.security.stealth.length) {
    y = h2(doc, d, y, 'Stealth / spoof scores (heuristic -- verify via rDNS before blocking)');
    y = table(doc, d, y, ['IP', 'Score', 'Requests', 'Network'],
      d.security.stealth.map(function (x) { return [x.ip, String(x.score), num(x.count), x.cloud || '']; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' } });
  }
  if (d.security.largeP.length) {
    y = h2(doc, d, y, 'Large payloads');
    y = table(doc, d, y, ['IP', 'URI', 'Size'],
      d.security.largeP.map(function (p) { return [p.ip, shortStr(p.uri, 60), bytesFmt(p.bytes)]; }),
      { 2: { halign: 'right' } });
  }

  // Appendix
  y = h1(doc, d, y, 'X', 'Appendix -- method, limits, re-run');
  y = para(doc, d, y, 'Method: ' + f.method, 7.5);
  y = bullets(doc, d, y, [
    'Cost = measured bytes x configured CDN pricing. Blockable = AI training + suspicious/unknown only (asserted in tests). Search-index + user-fetch excluded (citation/revenue protection).',
    'Verification = vendor IP JSON first; heuristics are low-confidence signals. Confirm blocks server-side (dig -x). Logs prove fetch, not citation.',
    'Browser <500MB triage (systematic sampling above ~300k lines, honestly bannered). CLI --exact for 500MB-50GB. BigQuery pack for 50GB+.',
    'Re-run after every deploy; watch the 429 rate on search-index bots (429 there = lost citations, not savings). Save summary.json weekly to enable WoW diffs.'
  ], 7.5);
  y = ensure(doc, d, y, 52);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.5);
  doc.line(M, y, PW - M, y);
  y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(MUT[0], MUT[1], MUT[2]);
  var colW = CW / 3;
  doc.text('Approved:', M + 2, y);
  doc.text('Date:', M + colW, y);
  doc.text('Owner:', M + colW * 2, y);
  doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(0.7);
  doc.line(M + 52, y + 3, M + colW - 8, y + 3);
  doc.line(M + colW + 30, y + 3, M + colW * 2 - 8, y + 3);
  doc.line(M + colW * 2 + 38, y + 3, PW - M - 2, y + 3);
  y += 16;
  doc.setFontSize(7);
  doc.setTextColor(FAINT[0], FAINT[1], FAINT[2]);
  doc.text('Full WAF + robots bundle lives in Module 6 (copy buttons) -- this PDF is the offline reference, not raw regex.', M + 2, y);

  stampChrome(doc, d);
  if (typeof doc.putTotalPages === 'function') doc.putTotalPages(TOTAL_PAGES);
  var pages = doc.getNumberOfPages();
  var buf = doc.output('arraybuffer');
  return { bytes: new Uint8Array(buf), data: d, pages: pages };
}

function downloadFullPDF(A, opts) {
  opts = opts || {};
  var res = generateFullPDFBytes(A, opts);
  var d = res.data;
  var fname = 'full-bot-traffic-report-' + d.meta.periodStart + '-to-' + d.meta.periodEnd + '.pdf';
  var blobSupported = (typeof Blob !== 'undefined');
  if (blobSupported && typeof URL !== 'undefined' && typeof document !== 'undefined') {
    var blob = new Blob([res.bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 2000);
  }
  return res;
}

var api = { buildFullData: buildFullData, generateFullPDFBytes: generateFullPDFBytes, downloadFullPDF: downloadFullPDF, san: san, tierLabel: tierLabel };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.FULLPDF = api;

})(typeof window !== 'undefined' ? window : globalThis);
