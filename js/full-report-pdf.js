/* ============================================================
   Full Report PDF engine — entire tool analysis (all 10 modules)
   + CFO executive summary in ONE downloadable reference PDF.
   Built on vendored jsPDF 2.5.1 + jspdf-autotable 3.8.2
   (js/vendor/, MIT — no CDN, no runtime network; the offline /
   privacy audit stays green: zero XHR/WebSocket, ever).
   Reuses CFOPDF.buildCFOData for Part A so the numbers always
   match the standalone CFO PDF download.
   Navigation: numbered + clickable contents page AND PDF bookmarks
   (sidebar in Acrobat/Preview/Chrome). Tables never split rows
   across pages; code (robots.txt, rules) renders line-by-line.
   Every figure is measured from YOUR log window -- the only static
   tables are labeled reference (tool research, not your traffic).
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
/* Split into TRUE lines first, THEN sanitize each -- never flatten \n
 * into spaces (that turned robots.txt into one unreadable paragraph). */
function splitLines(text) {
  return String(text == null ? '' : text).split(/\r?\n/);
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
/* Word-aware truncation -- never slices mid-word like "Chrome on Wi...". */
function shortStr(s, max) {
  var t = san(s || '');
  if (t.length <= max) return t;
  var cut = t.slice(0, max - 3);
  var sp = cut.lastIndexOf(' ');
  if (sp > max * 0.45) cut = cut.slice(0, sp);
  return cut + '...';
}
var TIER_LABEL = {
  human: 'Human', ai_training: 'AI Training', ai_search_index: 'AI Search-Index',
  ai_user_fetch: 'AI User Fetch', search_engine: 'Search Engine', seo_tool: 'SEO Tool',
  monitoring: 'Monitoring', social: 'Social', unknown_bot: 'Unknown Bot',
  suspicious: 'Suspicious', unclassified: 'Unclassified', unknown: 'Unknown'
};
function tierLabel(t) { return TIER_LABEL[t] || String(t || 'Unknown'); }

/* Static reference (tool research, NOT your traffic) -- labeled as such. */
var AI_REF = [
  ['OAI-SearchBot', 'search-index', '85 : 1', 'ALLOW @120/min -- block = citation loss in 1-2 wks'],
  ['PerplexityBot', 'search-index', '210 : 1', 'ALLOW @120/min -- best search ROI'],
  ['ClaudeBot (training)', 'training', '~5,143 : 1', 'Block freely -- worst ratio'],
  ['GPTBot / CCBot / Bytespider', 'training', 'infinite (zero referrals)', 'Block freely -- zero live citation loss']
];
var TIER_GLOSSARY = [
  ['Training', 'GPTBot, ClaudeBot, CCBot, Bytespider', 'Block / throttle freely, 60/min (20 aggressive)', 'robots Disallow', 'None'],
  ['Search-index', 'OAI-SearchBot, PerplexityBot, Claude-SearchBot', 'Allow @120/min (60 aggressive), 429 + Retry-After', 'robots Allow', 'Citation loss in 1-2 wks if blocked'],
  ['User-triggered', 'ChatGPT-User, Perplexity-User, Claude-User', 'DO NOT throttle (300/min abuse ceiling only)', 'Allow (robots may not apply)', 'Critical -- 429 = missing live answer'],
  ['Search engine', 'Googlebot, Bingbot', 'Allow (classic SEO crawl)', 'robots Allow', 'Critical -- organic visibility']
];

/* ---------- full-report data model (single source for PDF + tests) ---------- */
function buildFullData(A, opts) {
  opts = opts || {};
  var extra = opts.extras || {};
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
  var egRate = (cfo.meta && cfo.meta.cdnEgress) || 0.09;
  var rqRate = (cfo.meta && cfo.meta.req10k) || 0.0075;
  function trapCost(bytes, count) { return (bytes / 1073741824) * egRate + (count / 10000) * rqRate; }

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
    r.reqShare = records > 0 ? r.reqs / records * 100 : 0;
    return r;
  }).sort(function (a, b) { return b.cost - a.cost; });
  var graded = Object.keys(bd).map(function (bn) {
    var b = bd[bn] || {};
    var v = (c.byBot && c.byBot[bn]) || {};
    var ch = (b.cacheHit || 0) + (b.cacheMiss || 0);
    return { bot: bn, tier: b.tier || '', count: b.count || 0, bytes: b.totalBytes || 0, cost: v.total || 0, avgMs: b.avgMs, p95Ms: b.p95Ms, cachePct: ch > 0 ? (b.cacheHit || 0) / ch * 100 : null, ips: b.uniqueIPCount || 0, urls: b.uniqueUrlCount || 0, s2xx: b.s2xx || 0, s4xx: b.s4xx || 0, s5xx: b.s5xx || 0 };
  });
  var topBots = graded.slice().sort(function (a, b) { return b.cost - a.cost; }).slice(0, 25);
  var topUA = [];
  try { topUA = ((A.tp && A.tp.topUA) || []).slice(0, 10); } catch (e) {}
  var topTrainer = graded.filter(function (b) { return b.tier === 'ai_training'; }).sort(function (a, b) { return b.cost - a.cost; })[0] || null;
  var topSearchIdx = graded.filter(function (b) { return b.tier === 'ai_search_index'; }).sort(function (a, b) { return b.count - a.count; })[0] || null;
  var slowestHuman = graded.filter(function (b) { return b.tier === 'human' && b.p95Ms; }).sort(function (a, b) { return b.p95Ms - a.p95Ms; })[0] || null;
  var slowestBot = graded.filter(function (b) { return b.tier !== 'human' && b.avgMs; }).sort(function (a, b) { return b.avgMs - a.avgMs; })[0] || null;

  // Module 2 — verification
  var vs = (A && A.vs) || {};
  var spoof = (A && A.spoof) || {};
  var unByBot = [];
  try { unByBot = (spoof.byBot || []).slice(0, 10); } catch (e) {}

  // Module 3 — crawl budget + traps + render gap + top paths
  var eng2 = [];
  try {
    eng2 = Object.keys(A.crawlBud || {}).map(function (k) { return A.crawlBud[k]; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 12);
  } catch (e) {}
  var worstParam = eng2.slice().sort(function (a, b) { return (b.paramRatio || 0) - (a.paramRatio || 0); })[0] || null;
  var traps = [];
  try {
    traps = Object.entries(A.traps || {}).map(function (e2) {
      var t = e2[1] || {};
      return { name: e2[0], count: t.count || 0, paths: t.uniqueCount || 0, bytes: t.bytes || 0, sev: t.sev || '', cost: trapCost(t.bytes || 0, t.count || 0) };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
  } catch (e) {}
  var worstTrap = traps.slice().sort(function (a, b) { return b.cost - a.cost; })[0] || null;
  var jsShell = (A && A.jsShell) || { total: 0, byBot: [], minBytes: 5120 };
  var topPaths = [];
  try { topPaths = ((A.tp && A.tp.topURLs) || []).slice(0, 10); } catch (e) {}

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
  var aiTotal = aiRows.reduce(function (x, r) { return x + r.bandCost; }, 0);
  var aiTop = aiRows[0] || null;

  // Module 6 — edge + policy (full rule text kept -- no truncation in data)
  var edge = { cloudflare: [], fastly: [], aws: [], robots: '', decision: '', cfAICrawl: '', counts: { BLOCK: 0, CHALLENGE: 0, RATELIMIT: 0, ALLOW: 0, total: 0 } };
  try {
    var er = A.edgeRules || {};
    ['cloudflare', 'fastly', 'aws'].forEach(function (p) {
      (er[p] || []).forEach(function (r) {
        var act = String(r.act || '');
        var kind = /BLOCK/i.test(act) ? 'BLOCK' : /RATE/i.test(act) ? 'RATELIMIT' : /ALLOW/i.test(act) ? 'ALLOW' : 'CHALLENGE';
        if (p === 'cloudflare') { edge.counts[kind] = (edge.counts[kind] || 0) + 1; edge.counts.total++; }
      });
    });
    edge.cloudflare = (er.cloudflare || []).slice(0, 12);
    edge.fastly = (er.fastly || []).slice(0, 8);
    edge.aws = (er.aws || []).slice(0, 8);
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
  var statuses = [], methods = [], hourly = [], spikeHours = 0;
  try {
    var tp = A.tp || {};
    statuses = Object.entries(tp.statuses || {}).sort().map(function (e4) { return { k: e4[0], v: e4[1], share: records > 0 ? e4[1] / records * 100 : 0 }; });
    var mTot = Object.values(tp.methods || {}).reduce(function (x, y2) { return x + y2; }, 0);
    methods = Object.entries(tp.methods || {}).sort(function (a, b) { return b[1] - a[1]; }).map(function (e5) { return { k: e5[0], v: e5[1], share: mTot > 0 ? e5[1] / mTot * 100 : 0 }; });
    var spikes = tp.spikes || {};
    hourly = (tp.hourly || []).map(function (v, h) { return { h: h, v: v, spike: !!spikes[h] }; });
    spikeHours = Object.keys(spikes).length;
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
  var peakDay = daily.slice().sort(function (a, b) { return b.v - a.v; })[0] || null;
  var topBurst = bursts[0] || null;

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
  var topThreat = threatGroups[0] || null;
  var hvIPs = [], stealth = [], largeP = [];
  try { hvIPs = (sec.hvIPs || []).slice(0, 10); } catch (e) {}
  try { stealth = ((A && A.stealth) || []).slice(0, 10); } catch (e) {}
  try { largeP = (sec.largeP || []).slice(0, 5); } catch (e) {}

  return {
    meta: cfo.meta,
    kpis: cfo.kpis,
    cfo: cfo,
    env: {
      botDb: extra.botDb || '2026.09.17', sigs: extra.sigs || 127, fresh: extra.fresh || '',
      rateTraining: extra.rateTraining || '60 req/min/IP (20 aggressive)',
      rateSearch: extra.rateSearch || '120 req/min/IP (60 aggressive)',
      rateUser: extra.rateUser || 'no throttle (300/min abuse ceiling only)',
      ppc: extra.ppc || null
    },
    classification: { tiers: tiers, topBots: topBots, topUA: topUA, topTrainer: topTrainer, topSearchIdx: topSearchIdx, humanShare: s.humanPct || 0, botShare: s.botPct || 0 },
    verification: { matches: vs.matches || vs.verified || 0, unusual: vs.unusual || vs.suspicious || 0, informational: vs.informational || 0, skipped: vs.skipped || 0, sampled: !!(vs.sampled || vs.verifySampled), claimed: spoof.claimed || 0, verified: spoof.verified || 0, unverified: spoof.unverified || 0, unverifiedPct: spoof.unverifiedPct || 0, unByBot: unByBot },
    crawl: { eng: eng2, worstParam: worstParam, traps: traps, worstTrap: worstTrap, jsTotal: jsShell.total || 0, jsMin: jsShell.minBytes || 5120, jsByBot: (jsShell.byBot || []).slice(0, 5), topPaths: topPaths },
    costs: { rows: costRows, total: c.total, blockable: +((c.savings && c.savings.botBlocking) || 0), ciAbs: (c.ci && c.ci.abs) || 0, ciRel: (c.ci && c.ci.rel) || 0, trainCost: (c.savings && c.savings.byTier && c.savings.byTier.ai_training) || 0 },
    ai: { rows: aiRows, total: aiTotal, top: aiTop },
    edge: edge,
    perf: { slow: slow, slowestHuman: slowestHuman, slowestBot: slowestBot, statuses: statuses, methods: methods, hourly: hourly, spikeHours: spikeHours },
    dynamics: { bursts: bursts, topBurst: topBurst, not404: not404, daily: daily, peakDay: peakDay, topIPs: topIPs, topRef: topRef },
    security: { totalIPs: sec.totalIPs || 0, threatCount: (sec.threats || []).length, groups: threatGroups, topThreat: topThreat, hvIPs: hvIPs, stealth: stealth, largeP: largeP, velocityThreshold: sec.velocityThreshold || 0 }
  };
}

/* ---------- layout (M3 modern, mirrors the CFO engine) ---------- */
var M = 44, PW = 595, PH = 842, CW = PW - M * 2;
var INK = [25, 28, 34], MUT = [68, 71, 78], FAINT = [116, 119, 127];
var ACC = [11, 87, 208], ACC_DK = [4, 66, 160], HDRF = [25, 28, 34];
var GRID = [220, 227, 238], ZEBRA = [243, 246, 251], RED = [179, 38, 30];
var BLUE_BG = [211, 227, 253], GREEN_BG = [237, 255, 240];
var AMBER_BG = [255, 243, 224], RED_BG = [249, 222, 220];
var TOTAL_PAGES = '{total_pages_count_string}';
var BODY_BOTTOM = PH - 62, FOOT_Y = PH - 30;
var TOC_PAGE = 1;

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
function addBookmark(doc, title, page) {
  try {
    if (doc.outline && typeof doc.outline.add === 'function') doc.outline.add(null, san(title), { pageNumber: page });
  } catch (e) { /* bookmarks are progressive enhancement */ }
}
function tocLink(doc, text, x, y, page) {
  try { doc.textWithLink(san(text), x, y, { pageNumber: page }); }
  catch (e) { doc.text(san(text), x, y); }
}
function ensure(doc, d, y, need) {
  if (y + need > BODY_BOTTOM) { doc.addPage(); return 78; }
  return y;
}
/* Module header: numbered badge + title + rule + right-aligned Contents backlink. */
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
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(FAINT[0], FAINT[1], FAINT[2]);
  tocLink(doc, '^ Contents', PW - M, y, TOC_PAGE, 'right');
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
  styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 4.5, right: 6, bottom: 4.5, left: 6 }, textColor: INK, lineColor: GRID, lineWidth: 0.5, valign: 'middle', overflow: 'linebreak' },
  headStyles: { fillColor: ACC, textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: { top: 6, right: 6, bottom: 6, left: 6 } },
  alternateRowStyles: { fillColor: ZEBRA },
  showHead: 'everyPage',
  rowPageBreak: 'avoid',
  pageBreak: 'auto'
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
/* True line-by-line code block on a shaded band -- directives stay intact. */
function codeBlock(doc, d, y, title, text, maxLines) {
  var raw = splitLines(text);
  var lines = raw.slice(0, maxLines || 70);
  var truncated = raw.length > lines.length;
  var wrapped = [];
  for (var i = 0; i < lines.length; i++) {
    var parts = doc.splitTextToSize(san(lines[i]) || ' ', CW - 24);
    for (var w = 0; w < parts.length; w++) wrapped.push({ t: parts[w], cont: w > 0 });
  }
  var h = 30 + wrapped.length * 10.5;
  y = ensure(doc, d, y, Math.min(h + 8, 200));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setTextColor(ACC_DK[0], ACC_DK[1], ACC_DK[2]);
  doc.text(san(title) + (truncated ? '  (truncated -- full text in Module 6 of the tool)' : ''), M + 2, y);
  y += 8;
  var top = y - 4;
  var yy = y;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
  for (var k = 0; k < wrapped.length; k++) {
    yy = ensure(doc, d, yy, 12);
    if (yy === 78 && k > 0) { top = yy - 4; } // fresh band after page break
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(wrapped[k].t, M + 10 + (wrapped[k].cont ? 8 : 0), yy);
    yy += 10.5;
  }
  // shade behind the finished block(s): draw bands per page segment is complex;
  // instead shade first-page segment only when it fits on one page.
  void top;
  return yy + 8;
}
/* KPI cards --_any even count, 2 per row. */
function kpiGrid(doc, d, y, kpis) {
  var gap = 12, gw = (CW - gap) / 2, gh = 58;
  var rows = Math.ceil(kpis.length / 2);
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
  return y + gh * rows + gap * (rows - 1) + 12;
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
/* Edge-rule card: name + action on one row, desc, then FULL rule text. */
function ruleCard(doc, d, y, r) {
  var act = String(r.act || '');
  var bg = /BLOCK/i.test(act) ? RED_BG : /RATE|CHALLENGE/i.test(act) ? AMBER_BG : BLUE_BG;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
  var descLines = doc.splitTextToSize(san(r.desc || ''), CW - 28);
  var ruleLines = [];
  splitLines(r.rule || '').forEach(function (ln) {
    var parts = doc.splitTextToSize(san(ln) || ' ', CW - 28);
    for (var w = 0; w < parts.length; w++) ruleLines.push(parts[w]);
  });
  var h = 26 + descLines.length * 10.5 + ruleLines.length * 10.5;
  y = ensure(doc, d, y, Math.min(h + 8, 220));
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, h, 5, 5, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(shortStr(r.name, 52), M + 12, y + 15);
  doc.setFontSize(7);
  var actW = doc.getTextWidth(act) + 12;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PW - M - actW - 10, y + 6, actW, 13, 6, 6, 'F');
  doc.setTextColor(ACC_DK[0], ACC_DK[1], ACC_DK[2]);
  doc.text(act, PW - M - 10 - actW / 2, y + 15, { align: 'center' });
  var yy = y + 27;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(MUT[0], MUT[1], MUT[2]);
  for (var i = 0; i < descLines.length; i++) { doc.text(descLines[i], M + 12, yy); yy += 10.5; }
  doc.setFontSize(6.8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (var k = 0; k < ruleLines.length; k++) { doc.text(ruleLines[k], M + 12, yy); yy += 10.5; }
  return y + h + 8;
}
/* Numbered, clickable contents. Line count is identical with or without
 * page numbers, so the two layout passes paginate identically. */
var SECTIONS = [
  ['A', 'Executive summary (CFO)'],
  ['1', 'Bot classification & behavioral engine'],
  ['2', 'Multi-layer bot verification'],
  ['3', 'Crawl budget, traps & render gap'],
  ['4', 'Infrastructure cost analysis'],
  ['5', 'AI scraper citation ROI matrix'],
  ['6', 'Edge + policy bundle'],
  ['7', 'Performance deep dive'],
  ['8', 'Dynamics -- bursts, weekdays, referrers'],
  ['9', 'Security threat intelligence'],
  ['X', 'Appendix -- method, limits, re-run']
];
function contents(doc, d, y, pageMap) {
  y = h2(doc, d, y, 'Contents');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  for (var i = 0; i < SECTIONS.length; i++) {
    y = ensure(doc, d, y, 14);
    var pg = pageMap ? pageMap[i] : null;
    var dots = pg ? '  ' + new Array(46 - SECTIONS[i][1].length).join('.') + '  ' + pg : '  .....';
    var label = SECTIONS[i][0] + '. ' + SECTIONS[i][1];
    doc.setTextColor(INK[0], INK[1], INK[2]);
    if (pg) tocLink(doc, label, M + 2, y, pg);
    else doc.text(san(label), M + 2, y);
    doc.setTextColor(FAINT[0], FAINT[1], FAINT[2]);
    doc.text(dots, M + 2 + doc.getTextWidth(san(label)) + 4, y);
    y += 12.5;
  }
  return y + 4;
}

/* ---------- document assembly (deterministic: safe to run twice) ---------- */
function layoutDoc(doc, d, pageMap) {
  var f = d.cfo;
  var secPages = [];
  var y = 78;

  y = recBox(doc, d, y, 'BOT TRAFFIC COST - FULL ANALYSIS REPORT',
    'Complete reference export: all 10 analysis modules plus the CFO executive summary in one file. ' +
    num(d.meta.records) + ' records (' + bytesFmt(f.totalBytes) + ') from ' + d.meta.periodStart + ' to ' + d.meta.periodEnd +
    '. Pricing: ' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K. ' +
    d.meta.badge + ' analysis. Bot DB v' + d.env.botDb + ' (' + num(d.env.sigs) + ' signatures' + (d.env.fresh ? ', ' + d.env.fresh : '') + '). ' +
    'Keep this PDF with the log file it describes -- re-run after each deploy.', BLUE_BG);
  y = contents(doc, d, y, pageMap);
  y = h2(doc, d, y, 'At a glance');
  y = kpiGrid(doc, d, y, [
    { l: 'RECORDS ANALYZED', v: num(d.meta.records), s: bytesFmt(f.totalBytes) + ' total', bar: ACC },
    { l: 'UNIQUE IPS / URLS', v: num(f.uniqueIPs) + ' / ' + num(f.uniqueURLs), s: 'distinct sources and paths', bar: [11, 114, 133] },
    { l: 'HUMAN / BOT SPLIT', v: pct(d.classification.humanShare) + ' human', s: pct(d.classification.botShare) + ' bot traffic', bar: [19, 115, 51] },
    { l: 'TOTAL PERIOD COST', v: money(f.kpis.total), s: 'measured, auditable', bar: ACC },
    { l: 'BLOCKABLE (PERIOD)', v: money(f.kpis.blockable), s: pct(f.kpis.blockableShare) + ' of egress', bar: RED },
    { l: 'PROJECTED ANNUAL SAVING', v: money(f.kpis.annual) + ' / yr', s: money(f.kpis.monthly) + ' / mo run-rate', bar: [109, 40, 217] }
  ]);

  function section(num2, title) {
    y = h1(doc, d, y, num2, title);
    secPages.push(doc.getNumberOfPages());
  }

  // Part A — Executive summary (CFO content, same numbers as the CFO PDF)
  section('A', 'Executive summary (CFO)');
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
  section('1', 'Bot classification & behavioral engine');
  y = para(doc, d, y, 'Every request classified by User-Agent string matching against ' + num(d.env.sigs) + ' bot signatures and 18 browser fingerprint patterns (bot signatures take precedence to prevent spoofing). No subjective value scores -- this report measures cost; you determine value from analytics.', 8);
  if (d.classification.topTrainer) y = recBox(doc, d, y, 'BIGGEST TRAINING DRAIN', (d.classification.topTrainer.bot) + ' alone consumed ' + bytesFmt(d.classification.topTrainer.bytes) + ' (' + money(d.classification.topTrainer.cost) + ') training a competing model on your content. Block at the edge per Module 6 -- zero citation loss.', RED_BG);
  if (d.classification.topSearchIdx) y = para(doc, d, y, 'Most active search-index fetcher: ' + d.classification.topSearchIdx.bot + ' (' + num(d.classification.topSearchIdx.count) + ' fetches). Keep allowed at ' + d.env.rateSearch + ' -- throttling it drops AI citations within 1-2 weeks.', 8);
  y = h2(doc, d, y, 'Traffic distribution by category');
  y = table(doc, d, y, ['Category', 'Bots', 'Requests', 'Req share', 'Bandwidth', 'Cost'],
    d.classification.tiers.map(function (t) { return [tierLabel(t.tier), num(t.bots), num(t.reqs), pct(t.reqShare), bytesFmt(t.bytes), money(t.cost)]; }),
    { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } });
  y = h2(doc, d, y, 'Top 25 bots by cost (TTFB + cache included)');
  y = table(doc, d, y, ['Bot', 'Category', 'Requests', 'Bandwidth', 'Avg TTFB', 'Cache hit', 'Cost'],
    d.classification.topBots.map(function (b) { return [shortStr(b.bot, 30), tierLabel(b.tier), num(b.count), bytesFmt(b.bytes), b.avgMs != null ? Math.round(b.avgMs) + 'ms' : '--', b.cachePct != null ? pct(b.cachePct) : '--', money(b.cost)]; }),
    { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } });
  if (d.classification.topUA.length) {
    y = h2(doc, d, y, 'Top user-agent strings (truncated -- copy full UA from Module 1 in the tool)');
    y = table(doc, d, y, ['User-Agent (first 110 chars)', 'Count'],
      d.classification.topUA.map(function (u) { return [shortStr(u[0], 110), num(u[1])]; }),
      { 1: { halign: 'right' } });
  }

  // Module 2
  section('2', 'Multi-layer bot verification');
  y = para(doc, d, y, 'Four heuristic layers: IP range, TLS version, cloud-host detection, behavioral analysis. Signals, not proof -- confirm with vendor IP JSON + server-side reverse DNS (dig -x) before enforcing blocks. Never block on UA alone.', 8);
  y = table(doc, d, y, ['Check', 'Count'],
    [['Matching expected patterns', num(d.verification.matches)], ['Flagged unusual', num(d.verification.unusual)], ['Informational only', num(d.verification.informational)], ['Skipped (no data)', num(d.verification.skipped)], ['Claimed AI fetches', num(d.verification.claimed)], ['Verified via vendor IP JSON', num(d.verification.verified)], ['UNVERIFIED fetches', num(d.verification.unverified) + ' (' + pct(d.verification.unverifiedPct) + ')']].concat(d.verification.sampled ? [['Sampling', 'Scaled from sampled verification base']] : []),
    { 1: { halign: 'right' } });
  y = h2(doc, d, y, 'The 4 verification layers (method reference)');
  y = table(doc, d, y, ['Layer', 'What it checks', 'Strength'],
    [['1. IP range', 'Request IP vs known search-engine prefixes + vendor CIDR JSON', 'Strong when matched'], ['2. TLS version', 'Handshake version vs bot-family patterns', 'Signal only'], ['3. Cloud-host detection', 'Datacenter vs residential ASN ranges', 'Signal only'], ['4. Behavioral analysis', 'Velocity, breadth, error-rate fingerprints', 'Signal only']],
    {});
  if (d.verification.unByBot.length) {
    y = h2(doc, d, y, 'Top unverified bots (verify before blocking)');
    y = table(doc, d, y, ['Bot', 'Unverified fetches'],
      d.verification.unByBot.map(function (u) { return [u[0], num(u[1])]; }),
      { 1: { halign: 'right' } });
  }

  // Module 3
  section('3', 'Crawl budget, traps & render gap');
  y = para(doc, d, y, 'Parameterized URLs, faceted navigation and trap patterns burn the crawl budget that should go to high-value pages. AI fetchers read raw HTML with no JS -- a 200 + tiny body is a JS shell with zero citation chance.', 8);
  if (d.crawl.worstTrap) y = recBox(doc, d, y, 'COSTLIEST TRAP', '"' + d.crawl.worstTrap.name + '" burned ' + bytesFmt(d.crawl.worstTrap.bytes) + ' (' + money(d.crawl.worstTrap.cost) + ') across ' + num(d.crawl.worstTrap.count) + ' requests. Fix owner: Eng + SEO -- Disallow in robots.txt and canonicalize faceted parameters.', AMBER_BG);
  if (d.crawl.eng.length) {
    y = h2(doc, d, y, 'Search-engine crawl efficiency');
    y = table(doc, d, y, ['Crawler', 'Total', 'Unique URLs', '2xx', 'Param %', 'Cache %', 'Efficiency'],
      d.crawl.eng.map(function (e) { return [shortStr(e.name, 24), num(e.total), num(e.uniqueCount), num(e.s2xx), pct(e.paramRatio), pct(e.cacheRatio), pct(e.efficiency)]; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } });
  } else y = para(doc, d, y, 'No search-engine or AI citation crawlers in this window.', 8);
  if (d.crawl.traps.length) {
    y = h2(doc, d, y, 'Crawl-trap detection (with measured $ waste)');
    y = table(doc, d, y, ['Trap pattern', 'Severity', 'Requests', 'Unique paths', 'Bandwidth', '$ waste'],
      d.crawl.traps.map(function (t) { return [t.name, (t.sev || '').toUpperCase(), num(t.count), num(t.paths), bytesFmt(t.bytes), money(t.cost)]; }),
      { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } });
  }
  y = h2(doc, d, y, 'Render gap -- JS shells (GEO)');
  if (d.crawl.jsTotal > 0) {
    y = para(doc, d, y, num(d.crawl.jsTotal) + ' AI-bot 200s under ' + num(d.crawl.jsMin) + 'B. Top offenders: ' + d.crawl.jsByBot.map(function (b) { return b.bot + ' (' + b.count + ')'; }).join(', ') + '. Fix: server-render critical content, inline quotable facts + FAQ blocks.', 8);
  } else y = para(doc, d, y, 'No JS-shell suspects -- AI-bot 200s all exceed ' + num(d.crawl.jsMin) + 'B, or no AI bots in this window.', 8);
  if (d.crawl.topPaths.length) {
    y = h2(doc, d, y, 'Most-requested paths (top 10)');
    y = table(doc, d, y, ['Path', 'Requests'],
      d.crawl.topPaths.map(function (u) { return [shortStr(u[0], 70), num(u[1])]; }),
      { 1: { halign: 'right' } });
  }

  // Module 4
  section('4', 'Infrastructure cost analysis');
  y = para(doc, d, y, 'Measured bytes x configured pricing (' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K). Origin-compute excluded unless opted in. 95% CI +/-' + money(d.costs.ciAbs) + ' (+/-' + (d.costs.ciRel * 100).toFixed(1) + '%).', 8);
  y = h2(doc, d, y, 'Cost components (measured)');
  y = table(doc, d, y, ['Component', 'Measured cost', 'Share', 'What it is'],
    [['CDN egress', money(d.costs.total.egress), pct(d.costs.total.all > 0 ? d.costs.total.egress / d.costs.total.all * 100 : 0), 'Bandwidth for all traffic'], ['Request processing', money(d.costs.total.request), pct(d.costs.total.all > 0 ? d.costs.total.request / d.costs.total.all * 100 : 0), 'Per-request CDN charges'], ['Origin compute (opt-in)', money(d.costs.total.ssr), pct(d.costs.total.all > 0 ? d.costs.total.ssr / d.costs.total.all * 100 : 0), 'Estimate you enable in Pricing; OFF by default'], ['TOTAL', money(d.costs.total.all), '100.0%', '']],
    { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } });
  y = h2(doc, d, y, 'Cost by bot (top 20)');
  y = table(doc, d, y, ['Bot', 'Requests', 'Bandwidth', 'Egress', 'Req cost', 'Total', 'Share'],
    d.costs.rows.map(function (r) { return [shortStr(r.bot, 30), num(r.count), bytesFmt(r.bytes), money(r.eg), money(r.rq), money(r.total), pct(r.share)]; }),
    { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } });
  y = recBox(doc, d, y, 'BLOCKABLE WASTE', 'Blocking AI training + suspicious traffic recovers ' + money(d.costs.blockable) + ' in this period (' + money(d.costs.trainCost) + ' pure AI-training). Period total ' + money(d.costs.total.all) + ' (egress ' + money(d.costs.total.egress) + ' + requests ' + money(d.costs.total.request) + (d.costs.total.ssr > 0 ? ' + compute ' + money(d.costs.total.ssr) : '') + ').', GREEN_BG);

  // Module 5
  section('5', 'AI scraper citation ROI matrix');
  y = para(doc, d, y, 'Measured cost per AI bot from your logs. Whether a bot is valuable depends on YOUR analytics: check referral traffic from AI domains before allowing.', 8);
  if (d.ai.top) y = recBox(doc, d, y, 'COSTLIEST AI BOT', d.ai.top.bot + ' (' + tierLabel(d.ai.top.tier) + ') cost ' + money(d.ai.top.bandCost) + ' across ' + num(d.ai.top.count) + ' fetches. Total AI-bot cost this window: ' + money(d.ai.total) + '. ' + d.ai.top.rec + '.', AMBER_BG);
  if (d.ai.rows.length) {
    y = h2(doc, d, y, 'AI-bot cost from your logs');
    y = table(doc, d, y, ['AI bot', 'Class', 'Requests', 'Bandwidth', 'Egress cost', 'Cost/req', 'Recommendation'],
      d.ai.rows.map(function (b) { return [shortStr(b.bot, 26), tierLabel(b.tier), num(b.count), bytesFmt(b.bytes), money(b.bandCost), money(b.cpReq), b.rec]; }),
      { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } });
  } else y = para(doc, d, y, 'No AI scraper bots detected.', 8);
  y = h2(doc, d, y, 'Crawl-to-referral reference (tool research -- not your traffic)');
  y = table(doc, d, y, ['Bot', 'Class', 'Crawl : referral', 'Policy'],
    AI_REF.map(function (r) { return r; }), { 2: { halign: 'right' } });
  if (d.env.ppc && d.env.ppc.rows && d.env.ppc.rows.length) {
    y = h2(doc, d, y, 'Pay-per-crawl recovery model (your training volume x $0.02)');
    y = para(doc, d, y, d.env.ppc.headline || '', 7.5);
    y = table(doc, d, y, ['Training bot', 'Hits', 'Recoverable / mo'],
      d.env.ppc.rows.map(function (r) { return [shortStr(r.bot, 30), num(r.hits), money(r.recoverable)]; }),
      { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' } });
    y = para(doc, d, y, 'Total recoverable @ $0.02: ' + money(d.env.ppc.totalMonthly) + '/mo. Projection from your window scaled to 30 days -- confirm volume stability 4+ weeks before quoting.', 7);
  }

  // Module 6
  section('6', 'Edge + policy bundle');
  y = para(doc, d, y, 'Ready-to-deploy rules from your log data. Training = block/challenge freely. Search-index = 429-only, never hard block (' + d.env.rateSearch + '). User-fetch = allow + abuse ceiling (' + d.env.rateUser + '; 429 = missing live answer). OAI-AdsBot is allow-listed -- blocking breaks shopping ads. Full rule text below; copy buttons live in Module 6 of the tool.', 8);
  y = recBox(doc, d, y, 'RULEBOOK AT A GLANCE', d.edge.counts.total + ' Cloudflare rules generated: ' + d.edge.counts.BLOCK + ' BLOCK, ' + (d.edge.counts.RATELIMIT || 0) + ' rate-limit, ' + ((d.edge.counts.CHALLENGE || 0) + (d.edge.counts.ALLOW || 0)) + ' challenge/allow. ' + d.edge.fastly.length + ' Fastly VCL snippets and ' + d.edge.aws.length + ' AWS WAF statements shown below (first page each).', BLUE_BG);
  if (!d.edge.cloudflare.length && !d.edge.fastly.length && !d.edge.aws.length) y = para(doc, d, y, 'No rules generated -- no bot met the enforcement threshold (training/suspicious: 2+ requests; user-triggered: 1+). Upload a larger window.', 8);
  var provNames = { cloudflare: 'Cloudflare WAF rules (full text)', fastly: 'Fastly VCL snippets (full text)', aws: 'AWS WAF statements (full text)' };
  ['cloudflare', 'fastly', 'aws'].forEach(function (p) {
    if (d.edge[p].length) {
      y = h2(doc, d, y, provNames[p]);
      for (var ri = 0; ri < d.edge[p].length; ri++) y = ruleCard(doc, d, y, d.edge[p][ri]);
    }
  });
  if (d.edge.decision) y = codeBlock(doc, d, y, '429 vs challenge vs block -- decision tree', d.edge.decision, 14);
  if (d.edge.robots) y = codeBlock(doc, d, y, 'robots.txt -- training vs search split (paste as-is)', d.edge.robots, 90);
  if (d.edge.cfAICrawl) y = para(doc, d, y, 'Cloudflare AI Crawl Control: ' + d.edge.cfAICrawl, 7.5);
  y = h2(doc, d, y, 'Rate policy by class (2026 defaults)');
  y = table(doc, d, y, ['Class', 'Training block', 'Search-index limit', 'User-fetch ceiling'],
    [['Training bots', d.env.rateTraining, '--', '--'], ['Search-index bots', '--', d.env.rateSearch, '--'], ['User-triggered bots', '--', '--', d.env.rateUser]],
    {});

  // Module 7
  section('7', 'Performance deep dive');
  y = para(doc, d, y, 'TTFB by traffic category. Slow bots = origin compute pressure. Slow humans = lost revenue (lab heuristic: ~100ms ~= -1% conversion; confirm in CrUX/RUM).', 8);
  if (d.perf.slowestHuman) y = recBox(doc, d, y, 'REVENUE WATCH', 'Slowest human-facing path: ' + d.perf.slowestHuman.bot + ' at ' + Math.round(d.perf.slowestHuman.p95Ms) + 'ms p95 over ' + num(d.perf.slowestHuman.count) + ' requests. Fix human-slow paths before bot-slow ones.', AMBER_BG);
  if (d.perf.slowestBot) y = para(doc, d, y, 'Slowest bot (origin pressure): ' + d.perf.slowestBot.bot + ' at ' + Math.round(d.perf.slowestBot.avgMs) + 'ms avg. ' + (d.perf.slowestBot.tier === 'ai_training' ? 'It is a training bot -- blocking it removes the pressure for free.' : 'Rate-limit at the edge if it has no citation value.'), 8);
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
    y = h2(doc, d, y, 'Hourly traffic, UTC (* = spike over mean + 2 std dev)');
    y = table(doc, d, y, ['Hour', 'Requests', 'Spike'],
      d.perf.hourly.map(function (r) { return [String(r.h).padStart(2, '0') + ':00', num(r.v), r.spike ? 'YES *' : '--']; }),
      { 1: { halign: 'right' }, 2: { halign: 'center' } });
    y = para(doc, d, y, d.perf.spikeHours + ' spike hour(s) this window. Spikes + training-bot share = scheduled scraping; answer with time-based rate limits, not permanent blocks.', 7.5);
  }

  // Module 8
  section('8', 'Dynamics -- bursts, weekdays, referrers');
  if (d.dynamics.topBurst) y = recBox(doc, d, y, 'LARGEST BURST', d.dynamics.topBurst.bot + ': ' + num(d.dynamics.topBurst.count) + ' requests in one hour (' + (d.dynamics.topBurst.hour || '') + ', z=' + (d.dynamics.topBurst.z == null ? 'n/a' : d.dynamics.topBurst.z) + '). Correlate with deploy log / WAF changes before blaming bots.', AMBER_BG);
  else y = para(doc, d, y, 'No per-bot bursts (requires n>30, z>=3, >=2x rolling mean, >=10 req/hr).', 8);
  if (d.dynamics.bursts.length) {
    y = h2(doc, d, y, 'Per-bot bursts (rolling 7-day baseline)');
    y = table(doc, d, y, ['Bot', 'Hour (UTC)', 'Count', 'z', 'Note'],
      d.dynamics.bursts.map(function (b) { return [shortStr(b.bot, 26), shortStr(b.hour || '', 20), num(b.count), b.z == null ? 'n/a' : String(b.z), shortStr(b.note || '', 40)]; }),
      { 2: { halign: 'right' }, 3: { halign: 'right' } });
  }
  if (d.dynamics.not404.length) {
    y = h2(doc, d, y, '404 clusters (sensitive paths -- see also Module 9)');
    y = table(doc, d, y, ['URI', 'Hits'],
      d.dynamics.not404.map(function (x) { return [shortStr(x.uri, 70), num(x.count)]; }),
      { 1: { halign: 'right' } });
  }
  if (d.dynamics.daily.length) {
    y = h2(doc, d, y, 'Day-of-week distribution');
    y = table(doc, d, y, ['Day', 'Requests'],
      d.dynamics.daily.map(function (r) { return [r.d, num(r.v)]; }),
      { 1: { halign: 'right' } });
    if (d.dynamics.peakDay) y = para(doc, d, y, 'Peak day: ' + d.dynamics.peakDay.d + ' (' + num(d.dynamics.peakDay.v) + ' requests). Schedule heavy crawls and deploys away from it.', 7.5);
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
  section('9', 'Security threat intelligence');
  y = table(doc, d, y, ['Signal', 'Count'],
    [['Unique IPs', num(d.security.totalIPs)], ['Suspicious patterns', num(d.security.threatCount)], ['High-velocity IPs', num(d.security.hvIPs.length)], ['Velocity threshold', d.security.velocityThreshold.toFixed(1) + ' req/sec (mean + 2 std dev)'], ['Stealth-flagged IPs (score >= 40)', num(d.security.stealth.length)], ['Large payloads (>10MB)', num(d.security.largeP.length)]],
    { 1: { halign: 'right' } });
  if (d.security.topThreat) y = recBox(doc, d, y, 'TOP THREAT', d.security.topThreat.type + ' (' + (d.security.topThreat.sev || '').toUpperCase() + '): ' + num(d.security.topThreat.count) + ' hits. Block offending IPs at the edge immediately and enable WAF rules -- see Module 6.', RED_BG);
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
  } else y = para(doc, d, y, 'No high-velocity IPs -- no source exceeded the data-driven velocity threshold.', 8);
  if (d.security.stealth.length) {
    y = h2(doc, d, y, 'Stealth / spoof scores (heuristic -- verify via rDNS before blocking)');
    y = table(doc, d, y, ['IP', 'Score', 'Requests', 'Network'],
      d.security.stealth.map(function (x) { return [x.ip, String(x.score), num(x.count), x.cloud || '']; }),
      { 1: { halign: 'right' }, 2: { halign: 'right' } });
    y = para(doc, d, y, 'Score >= 70: challenge at edge. Score 40-69: watch + verify. Never auto-block on score alone.', 7.5);
  } else y = para(doc, d, y, 'No stealth-flagged IPs (Chrome-UA + cloud-ASN + machine-velocity shape) in this window.', 8);
  if (d.security.largeP.length) {
    y = h2(doc, d, y, 'Large payloads (>10MB -- exfiltration / misconfig check)');
    y = table(doc, d, y, ['IP', 'URI', 'Size'],
      d.security.largeP.map(function (p) { return [p.ip, shortStr(p.uri, 60), bytesFmt(p.bytes)]; }),
      { 2: { halign: 'right' } });
  }

  // Appendix
  section('X', 'Appendix -- method, limits, re-run');
  y = para(doc, d, y, 'Method: ' + f.method, 7.5);
  y = h2(doc, d, y, 'Tier glossary -- what each class means (reference)');
  y = table(doc, d, y, ['Class', 'Examples', 'Edge action', 'robots.txt', 'Block risk'],
    TIER_GLOSSARY.map(function (r) { return r; }), {});
  y = h2(doc, d, y, 'Re-run checklist (keep with this PDF)');
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

  return { sections: SECTIONS.map(function (s2) { return s2[0] + '. ' + s2[1]; }), pages: secPages };
}

function generateFullPDFBytes(A, opts) {
  var d = buildFullData(A, opts);
  var JsPDF = getJsPDFCtor();
  // Pass 1: collect section start pages (contents without numbers).
  var doc1 = new JsPDF({ unit: 'pt', format: 'a4', compress: false });
  var pass1 = layoutDoc(doc1, d, null);
  // Pass 2: identical layout, contents filled with real page numbers.
  var doc = new JsPDF({ unit: 'pt', format: 'a4', compress: false });
  layoutDoc(doc, d, pass1.pages);
  // Bookmarks (reader sidebar navigation) + chrome + totals.
  for (var i = 0; i < pass1.sections.length; i++) addBookmark(doc, pass1.sections[i], pass1.pages[i]);
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

var api = { buildFullData: buildFullData, generateFullPDFBytes: generateFullPDFBytes, downloadFullPDF: downloadFullPDF, san: san, splitLines: splitLines, tierLabel: tierLabel, SECTIONS: SECTIONS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.FULLPDF = api;

})(typeof window !== 'undefined' ? window : globalThis);
