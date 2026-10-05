/* ============================================================
   CFO PDF engine — real PDF download, 100% client-side.
   Built on vendored jsPDF 2.5.1 + jspdf-autotable 3.8.2
   (js/vendor/, MIT — no CDN, no runtime network; the offline /
   privacy audit stays green: zero XHR/WebSocket, ever).
   Node: require('jspdf') + require('jspdf-autotable') (package.json).
   Browser: js/vendor/*.min.js script tags before this file.
   Node-testable via module.exports.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- ASCII sanitizer: keeps every emitted string WinAnsi-clean,
   so text stays selectable/searchable and byte-stable across viewers. */
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
function shortBot(name, max) {
  var t = san(name || '');
  if (t.length <= max) return t;
  var cut = t.slice(0, max - 3);
  var sp = cut.lastIndexOf(' ');
  if (sp > max * 0.5) cut = cut.slice(0, sp);
  return cut + '...';
}

/* CFO-facing tier names — never snake_case in front of finance. */
var TIER_LABEL = {
  human: 'Human', ai_training: 'AI Training', ai_search_index: 'AI Search-Index',
  ai_user_fetch: 'AI User Fetch', search_engine: 'Search Engine', seo_tool: 'SEO Tool',
  monitoring: 'Monitoring', social: 'Social', unknown_bot: 'Unknown Bot',
  suspicious: 'Suspicious', unclassified: 'Unclassified', unknown: 'Unknown'
};
function tierLabel(t) { return TIER_LABEL[t] || String(t || 'Unknown'); }

/* ---------- enterprise data model (single source for PDF + tests) ---------- */
function buildCFOData(A, opts) {
  opts = opts || {};
  var c = (A && A.costs) || { total: { egress: 0, request: 0, ssr: 0, all: 0 }, savings: { botBlocking: 0, byTier: {} }, byBot: {}, ci: { rel: 0, abs: 0 } };
  var s = (A && A.summary) || { totalRecords: 0, totalBytes: 0, uniqueIPs: 0, uniqueURLs: 0, dateRange: {}, timeRange: null, humanPct: 0, botPct: 0 };
  var cfg = (A && (A.cfg || A.pricing)) || {};
  var preset = (A && A.preset) || cfg.preset || 'Custom';
  var cdnEgress = (cfg.cdnEgress != null) ? +cfg.cdnEgress : 0.09;
  var req10k = (cfg.request10K != null) ? +cfg.request10K : 0.0075;

  var start = (s.dateRange && s.dateRange.start) || (s.timeRange && s.timeRange.start) || null;
  var end = (s.dateRange && s.dateRange.end) || (s.timeRange && s.timeRange.end) || null;
  var durMs = (s.timeRange && s.timeRange.durationMs) || A.durationMs || null;
  if (!durMs && start && end) {
    try { durMs = new Date(end) - new Date(start); } catch (e) { durMs = null; }
  }
  var periodDays = (durMs && durMs > 0) ? durMs / 86400000 : null;
  var monthlyFactor = periodDays ? 30 / periodDays : 1;
  var scaledCapped = periodDays && (periodDays < 0.5 || periodDays > 400);

  var total = +((c.total && c.total.all) || 0);
  var blockable = +((c.savings && c.savings.botBlocking) || 0);
  var monthly = blockable * monthlyFactor;
  var annual = monthly * 12;
  var records = s.totalRecords || 0;
  var stride = (A && A.stride) || 1;
  var sampled = !!(stride && stride > 1) || !!((A && A.vs && A.vs.sampled));
  var badge = sampled ? ('SAMPLED 1-in-' + stride) : 'EXACT';

  var tierRows = [];
  var tierAgg = {};
  try {
    for (var bn in (c.byBot || {})) {
      var t = (A.botData && A.botData[bn] && A.botData[bn].tier) || 'unknown';
      if (!tierAgg[t]) tierAgg[t] = { cost: 0, reqs: 0, bytes: 0 };
      tierAgg[t].cost += +c.byBot[bn].total || 0;
      tierAgg[t].reqs += +c.byBot[bn].count || 0;
      tierAgg[t].bytes += +c.byBot[bn].totalBytes || 0;
    }
  } catch (e) {}
  Object.keys(tierAgg).sort(function (a, b) { return tierAgg[b].cost - tierAgg[a].cost; }).forEach(function (t) {
    tierRows.push({ tier: t, cost: tierAgg[t].cost, reqs: tierAgg[t].reqs, bytes: tierAgg[t].bytes, share: total > 0 ? tierAgg[t].cost / total * 100 : 0 });
  });

  var topBots = Object.keys(c.byBot || {}).map(function (bn) {
    var v = c.byBot[bn];
    return { bot: bn, tier: (A.botData && A.botData[bn] && A.botData[bn].tier) || '', count: v.count || 0, bytes: v.totalBytes || 0, cost: v.total || 0 };
  }).sort(function (a, b) { return b.cost - a.cost; }).slice(0, 6);

  var traps = [];
  try {
    var entries = Object.entries(A.traps || {}).sort(function (a, b) { return b[1].count - a[1].count; }).slice(0, 5);
    for (var i = 0; i < entries.length; i++) {
      var tn = entries[i][0], tv = entries[i][1];
      var tCost = (tv.bytes / 1073741824) * cdnEgress + (tv.count / 10000) * req10k;
      traps.push({ name: tn, count: tv.count, bytes: tv.bytes, cost: tCost, share: total > 0 ? tCost / total * 100 : 0, sev: tv.sev || '' });
    }
  } catch (e) {}

  var actions = [];
  try {
    var rules = ((A.edgeRules || {}).cloudflare) || [];
    var seen = {};
    for (var ri = 0; ri < rules.length && actions.length < 6; ri++) {
      var r = rules[ri];
      var nm = String(r.name || '').replace(/^(Block|Challenge|Rate-limit|Observe)\s+/, '').split(' (')[0];
      if (!nm || seen[nm]) continue;
      seen[nm] = 1;
      var bCost = (c.byBot && c.byBot[nm] && c.byBot[nm].total) || 0;
      var risk = /BLOCK/i.test(r.act || '') ? 'None -- training' : /RATE-LIMIT/i.test(r.act || '') ? 'Medium -- citations if over-blocked' : /ALLOW/i.test(r.act || '') ? 'Do not block' : 'Low -- challenge first';
      actions.push({ bot: nm, action: r.act || '', saving: bCost, risk: risk });
    }
  } catch (e) {}

  var doNotBlock = ['OAI-SearchBot (search-index -- citations)', 'PerplexityBot (search-index -- best referral)', 'OAI-AdsBot (shopping ads -- revenue)', 'ChatGPT-User / Perplexity-User / Claude-User (user-triggered -- 429 = missing answer)'];

  var vs = (A && A.vs) || {};
  var spoof = (A && A.spoof) || { claimed: 0, unverified: 0, unverifiedPct: 0 };
  var ppcMonthly = 0;
  try {
    var trainHits = 0;
    for (var k in (A.botData || {})) { if (A.botData[k].tier === 'ai_training') trainHits += A.botData[k].count || 0; }
    var perMo = periodDays ? trainHits * (30 / periodDays) : trainHits;
    ppcMonthly = perMo * 0.002;
  } catch (e) {}

  var ciAbs = (c.ci && c.ci.abs) || 0;
  var ciRel = (c.ci && c.ci.rel) || 0;

  return {
    meta: {
      generated: new Date().toISOString().slice(0, 10),
      db: (typeof BOT_DB_VERSION !== 'undefined' ? BOT_DB_VERSION : '2026.09.17'),
      domain: opts.domain || opts.hostname || 'your-domain.com',
      file: opts.file || '',
      periodStart: isoDay(start), periodEnd: isoDay(end),
      periodDays: periodDays, records: records,
      badge: badge, preset: preset, cdnEgress: cdnEgress, req10k: req10k,
      ciAbs: ciAbs, ciRel: ciRel, scaledCapped: !!scaledCapped
    },
    kpis: {
      total: total, blockable: blockable, monthly: monthly, annual: annual,
      blockableShare: total > 0 ? blockable / total * 100 : 0,
      costPer1k: records > 0 ? total / records * 1000 : 0,
      monthlyFactor: monthlyFactor, ppcMonthly: ppcMonthly
    },
    tierRows: tierRows, topBots: topBots, traps: traps, actions: actions,
    doNotBlock: doNotBlock,
    verify: { verified: vs.verified || vs.matches || 0, suspicious: vs.suspicious || vs.unusual || 0, claimed: spoof.claimed || 0, unverified: spoof.unverified || 0, unverifiedPct: spoof.unverifiedPct || 0 },
    humanPct: s.humanPct || 0, botPct: s.botPct || 0,
    totalBytes: s.totalBytes || 0, uniqueIPs: s.uniqueIPs || 0, uniqueURLs: s.uniqueURLs || 0,
    method: 'Measured bytes x configured CDN pricing. Blockable = AI training + suspicious/unknown only. Search-index + user-fetch excluded (citation/revenue protection). 95% CI +/-' + money(ciAbs) + '. Logs prove fetch, not citation.'
  };
}

/* ---------- engine access (browser globals vs Node requires) ---------- */
function getJsPDFCtor() {
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try {
      var ns = require('jspdf');
      try { require('jspdf-autotable'); } catch (e2) { /* plugin optional in exotic envs */ }
      if (ns && ns.jsPDF) return ns.jsPDF;
    } catch (e) { /* fall through to globals */ }
  }
  var g = (root && root.jspdf) || {};
  if (g.jsPDF) return g.jsPDF;
  throw new Error('CFO PDF engine missing: load js/vendor/jspdf.umd.min.js + jspdf-autotable.min.js before js/cfo-pdf.js (browser) or npm install (Node).');
}

/* ---------- layout constants (M3 modern, airy, grid-aligned) ---------- */
var M = 44, PW = 595, PH = 842, CW = PW - M * 2; // A4 pt, 44pt side margins
var INK = [25, 28, 34], MUT = [68, 71, 78], FAINT = [116, 119, 127];
var ACC = [11, 87, 208], ACC_DK = [4, 66, 160], HDRF = [25, 28, 34];
var GRID = [220, 227, 238], ZEBRA = [243, 246, 251], RED = [179, 38, 30];
var GREEN_BG = [237, 255, 240], RED_BG = [249, 222, 220], BLUE_BG = [211, 227, 253], CYAN_BG = [224, 242, 245];
var TOTAL_PAGES = '{total_pages_count_string}';
var FOOT_Y = PH - 30, BODY_BOTTOM = PH - 62;

/* Chrome (header/footer) is stamped in ONE post-pass after all content is
 * laid out — exactly once per page with correct numbers. Never in didDrawPage
 * (fires once per page PER TABLE → duplicated/overlapping bands and stale
 * page numbers) and never inline in flow helpers. */
function drawHeader(doc, d) {
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.rect(0, 0, PW, 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text(san('BOT TRAFFIC COST - EXECUTIVE SUMMARY'), M, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(211, 227, 253);
  var meta = san(d.meta.domain + '  |  ' + d.meta.periodStart + ' to ' + d.meta.periodEnd + '  |  Generated ' + d.meta.generated);
  doc.text(meta, M, 39);
  // badge pill, right-aligned
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
  doc.text(san('Confidential  |  Measured bytes x configured CDN pricing. Blockable = training + suspicious only.'), M, y);
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
function h1(doc, d, y, t) {
  y = ensure(doc, d, y, 96);
  // numbered badge: "1" in accent circle, rest as title
  var m = /^(\d+)\s*-\s*(.*)$/.exec(t || '');
  var tx = M;
  if (m) {
    doc.setFillColor(ACC[0], ACC[1], ACC[2]);
    doc.circle(M + 8, y - 4, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(m[1], M + 8, y - 1, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.setTextColor(HDRF[0], HDRF[1], HDRF[2]);
    doc.text(san(m[2]), M + 22, y);
    y += 7;
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.setTextColor(HDRF[0], HDRF[1], HDRF[2]);
    doc.text(san(t), M, y);
    y += 7;
  }
  doc.setDrawColor(ACC[0], ACC[1], ACC[2]); doc.setLineWidth(1.2);
  doc.line(M, y, M + 34, y);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.5);
  doc.line(M + 34, y, PW - M, y);
  return y + 16;
}
function h2(doc, d, y, t) {
  y = ensure(doc, d, y, 64);
  // accent left bar + title
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.rect(M, y - 8.5, 3, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(HDRF[0], HDRF[1], HDRF[2]);
  doc.text(san(t), M + 9, y);
  return y + 14;
}
/* Keep blocks together: section titles never strand at a page bottom.
 * Adds a page WITHOUT chrome — stampChrome owns all chrome in post-pass. */
function ensure(doc, d, y, need) {
  if (y + need > BODY_BOTTOM) {
    doc.addPage();
    return 78;
  }
  return y;
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
function kpiGrid(doc, d, y) {
  var gap = 12, gw = (CW - gap) / 2, gh = 58;
  y = ensure(doc, d, y, gh * 2 + gap + 6);
  var kpis = [
    { l: 'TOTAL PERIOD COST', v: money(d.kpis.total), s: num(d.meta.records) + ' records  |  ' + bytesFmt(d.totalBytes), bg: BLUE_BG, bar: ACC },
    { l: 'BLOCKABLE (PERIOD)', v: money(d.kpis.blockable) + '  (' + pct(d.kpis.blockableShare) + ')', s: 'Training + suspicious only', bg: RED_BG, bar: RED },
    { l: 'PROJECTED MONTHLY SAVING', v: money(d.kpis.monthly) + ' / mo', s: 'Scaled x' + d.kpis.monthlyFactor.toFixed(2) + ' from ' + (d.meta.periodDays ? d.meta.periodDays.toFixed(0) + '-day window' : 'window'), bg: GREEN_BG, bar: [19, 115, 51] },
    { l: 'PROJECTED ANNUAL SAVING', v: money(d.kpis.annual) + ' / yr', s: '12 x monthly  |  95% CI +/-' + money(d.meta.ciAbs), bg: CYAN_BG, bar: [11, 114, 133] }
  ];
  for (var i = 0; i < 4; i++) {
    var x = M + (i % 2) * (gw + gap);
    var yy = y + Math.floor(i / 2) * (gh + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.6);
    doc.roundedRect(x, yy, gw, gh, 6, 6, 'FD');
    // top accent strip
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
    var sub = kpis[i].s;
    if (sub.length > 52) sub = sub.slice(0, 52);
    doc.text(sub, x + 12, yy + 49);
  }
  return y + gh * 2 + gap + 12;
}
var TABLE_BASE = {
  theme: 'grid',
  margin: { left: M, right: M },
  styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 5, right: 6, bottom: 5, left: 6 }, textColor: INK, lineColor: GRID, lineWidth: 0.5, valign: 'middle', overflow: 'linebreak' },
  headStyles: { fillColor: ACC, textColor: 255, fontStyle: 'bold', fontSize: 7.2, cellPadding: { top: 6, right: 6, bottom: 6, left: 6 } },
  alternateRowStyles: { fillColor: ZEBRA },
  showHead: 'everyPage'
};
function autoTable(doc, d, y, head, body, colStyles) {
  y = ensure(doc, d, y, 52);
  doc.autoTable(Object.assign({}, TABLE_BASE, {
    startY: y, head: [head.map(san)], body: body.map(function (r) { return r.map(san); }),
    columnStyles: colStyles || {}
  }));
  return doc.lastAutoTable.finalY + 12;
}
/* Data-driven next steps (owners + payoff) — the box that turns a report
 * into a decision. Plus a shaded callout for boxes that must stand out. */
function nextSteps(d) {
  var steps = [];
  var trainers = d.actions.filter(function (a) { return /BLOCK/i.test(a.action); });
  if (trainers.length) steps.push('Block ' + trainers.length + ' training crawler' + (trainers.length > 1 ? 's' : '') + ' at the edge (Module 6 copy-paste rules; est. ' + money(d.kpis.monthly) + '/mo recoverable). Owner: Eng. Effort: 30 min. Risk: none -- zero citation loss.');
  else steps.push('No training volume above the enforcement floor -- nothing to block this period. Owner: SEO (re-check next window).');
  if (d.traps.length) steps.push('Disallow "' + d.traps[0].name + '"' + (d.traps[1] ? ' + "' + d.traps[1].name + '"' : '') + ' in robots.txt and canonicalize faceted parameters (est. ' + money(d.traps[0].cost) + ' waste this period). Owner: Eng + SEO. Effort: half day.');
  if (d.verify.unverified > 0) steps.push('Verify ' + num(d.verify.unverified) + ' UNVERIFIED fetches with server-side reverse DNS (dig -x) before enforcing blocks -- never block on UA alone. Owner: Eng. Effort: 1 hr (Module 2 batch).');
  steps.push('Re-run after the next deploy and watch the 429 rate on search-index bots -- 429 there means lost citations, not savings. Owner: SEO. Effort: ongoing.');
  return steps.slice(0, 4);
}
function callout(doc, d, y, title, body, tint) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
  var lines = doc.splitTextToSize(san(body), CW - 28);
  var h = 28 + lines.length * 12;
  y = ensure(doc, d, y, h + 10);
  doc.setFillColor(tint[0], tint[1], tint[2]);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.6);
  doc.roundedRect(M, y, CW, h, 6, 6, 'FD');
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.roundedRect(M, y, 4.5, h, 6, 6, 'F');
  doc.rect(M + 2, y, 2.5, h, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8);
  doc.setTextColor(ACC_DK[0], ACC_DK[1], ACC_DK[2]);
  doc.text(san(title), M + 14, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (var i = 0; i < lines.length; i++) doc.text(lines[i], M + 14, y + 29 + i * 12);
  return y + h + 10;
}
function bars(doc, d, y) {
  if (!d.topBots.length) return y;
  y = h2(doc, d, y, 'Cost concentration (top bots)');
  var max = Math.max.apply(null, d.topBots.map(function (b) { return b.cost; }).concat([0.0001]));
  var labelX = M + 2, labelW = 208, barX = M + 218, barMax = 168, valX = PW - M - 2;
  for (var i = 0; i < Math.min(5, d.topBots.length); i++) {
    var b = d.topBots[i];
    y = ensure(doc, d, y, 18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(shortBot(b.bot, 34), labelX, y);
    // track
    doc.setFillColor(GRID[0], GRID[1], GRID[2]);
    doc.roundedRect(barX, y - 7.5, barMax, 8, 4, 4, 'F');
    var bw = Math.max(6, barMax * (b.cost / max));
    doc.setFillColor(ACC[0], ACC[1], ACC[2]);
    doc.roundedRect(barX, y - 7.5, bw, 8, 4, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8);
    doc.text(money(b.cost), valX, y, { align: 'right' });
    y += 16;
  }
  return y + 6;
}

function generateCFOPDFBytes(A, opts) {
  var d = buildCFOData(A, opts);
  var JsPDF = getJsPDFCtor();
  var doc = new JsPDF({ unit: 'pt', format: 'a4', compress: false });
  var y = 78; // header band occupies 0..54; post-pass stamps it on every page

  // Executive recommendation box (dynamic height, left accent, breathing room)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8);
  var recLines = doc.splitTextToSize(san('AI training bots consumed ' + money(d.kpis.blockable) + ' (' + pct(d.kpis.blockableShare) + ' of egress) with zero citation value. Blocking recovers ~' + money(d.kpis.monthly) + '/mo (' + money(d.kpis.annual) + '/yr). Search-index + user-fetch traffic must stay allowed -- blocking drops AI citations in 1-2 weeks and breaks shopping-ad verification.'), CW - 30);
  var recH = 30 + recLines.length * 12.5;
  y = ensure(doc, d, y, recH + 10);
  doc.setFillColor(BLUE_BG[0], BLUE_BG[1], BLUE_BG[2]);
  doc.setDrawColor(GRID[0], GRID[1], GRID[2]); doc.setLineWidth(0.6);
  doc.roundedRect(M, y, CW, recH, 6, 6, 'FD');
  doc.setFillColor(ACC[0], ACC[1], ACC[2]);
  doc.roundedRect(M, y, 4.5, recH, 6, 6, 'F');
  doc.rect(M + 2, y, 2.5, recH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
  doc.setTextColor(ACC_DK[0], ACC_DK[1], ACC_DK[2]);
  doc.text('EXECUTIVE RECOMMENDATION', M + 14, y + 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (var ri = 0; ri < recLines.length; ri++) doc.text(recLines[ri], M + 14, y + 30 + ri * 12.5);
  y += recH + 12;

  y = h1(doc, d, y, '1 - Financials (measured, auditable)');
  y = kpiGrid(doc, d, y);
  y = h2(doc, d, y, 'Cost breakdown by tier');
  y = autoTable(doc, d, y,
    ['Tier', 'Requests', 'Bandwidth', 'Cost', 'Share'],
    d.tierRows.map(function (r) { return [tierLabel(r.tier), num(r.reqs), bytesFmt(r.bytes), money(r.cost), pct(r.share)]; }),
    { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  y = para(doc, d, y, 'Pricing: ' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K. Origin-compute excluded unless opt-in. ' + d.meta.badge + ' analysis.' + (d.meta.scaledCapped ? ' Window <0.5d or >400d -- treat monthly/annual as directional, act on period savings.' : ''), 7);

  y = h1(doc, d, y, '2 - Where the waste is');
  y = h2(doc, d, y, 'Top cost bots (measured)');
  y = autoTable(doc, d, y,
    ['Bot', 'Tier', 'Reqs', 'Bytes', 'Cost'],
    d.topBots.map(function (b) { return [shortBot(b.bot, 40), tierLabel(b.tier), num(b.count), bytesFmt(b.bytes), money(b.cost)]; }),
    { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', textColor: RED, fontStyle: 'bold' } });
  y = bars(doc, d, y);
  y = h2(doc, d, y, 'Crawl traps -> $ waste (fix owners: Eng/SEO)');
  if (d.traps.length) {
    y = autoTable(doc, d, y,
      ['Trap', 'Reqs', 'Waste', 'Cost', 'Share'],
      d.traps.map(function (t) { return [t.name, num(t.count), bytesFmt(t.bytes), money(t.cost), pct(t.share)]; }),
      { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
  } else y = para(doc, d, y, 'No parameterized/faceted trap patterns above threshold in this window.', 8);

  y = h1(doc, d, y, '3 - Actions (finance-safe, eng-ready)');
  if (d.actions.length) {
    y = autoTable(doc, d, y,
      ['Bot', 'Edge action', 'Saving', 'Risk'],
      d.actions.map(function (a) { return [shortBot(a.bot, 30), a.action, money(a.saving), a.risk]; }),
      { 0: { fontStyle: 'bold' }, 2: { halign: 'right' } });
  } else y = para(doc, d, y, 'No training/suspicious volume above the >=2-request floor -- nothing to block. Re-run after a larger window.', 8);
  y = h2(doc, d, y, 'Do NOT block (revenue / citation protection)');
  for (var di = 0; di < d.doNotBlock.length; di++) y = para(doc, d, y, '- ' + d.doNotBlock[di], 7.5);
  if (d.kpis.ppcMonthly > 0.5) y = callout(doc, d, y, 'PAY PER CRAWL UPSIDE', '402 beta: $0.002 per training request = ~' + money(d.kpis.ppcMonthly) + '/mo recoverable instead of a pure block. Search-index + user-fetch always bypass the paywall.', [237, 255, 240]);
  y = h2(doc, d, y, 'Recommended next steps');
  var steps = nextSteps(d);
  for (var si = 0; si < steps.length; si++) y = para(doc, d, y, (si + 1) + '. ' + steps[si], 7.5);

  y = h1(doc, d, y, '4 - Trust, method and sign-off');
  y = para(doc, d, y, 'Verification: ' + num(d.verify.verified) + ' checks match expected patterns; ' + num(d.verify.suspicious) + ' unusual. Claimed AI fetches: ' + num(d.verify.claimed) + ', unverified ' + num(d.verify.unverified) + ' (' + pct(d.verify.unverifiedPct) + '). Confirm blocks with vendor IP JSON + server-side reverse DNS (dig -x) before enforcing.', 7.5);
  y = para(doc, d, y, 'Human ' + pct(d.humanPct) + ' / bot ' + pct(d.botPct) + '  |  IPs ' + num(d.uniqueIPs) + '  |  URLs ' + num(d.uniqueURLs) + '  |  File: ' + (d.meta.file || 'upload') + '  |  Tool v' + d.meta.db + ' client-side -- no log leaves this browser.', 7);
  y = para(doc, d, y, 'Method: ' + d.method, 7);
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
  doc.text('Full WAF + robots bundle lives in Module 6 (copy buttons) -- this PDF carries the business case, not raw regex.', M + 2, y);

  stampChrome(doc, d); // footers carry the {total} placeholder…
  if (typeof doc.putTotalPages === 'function') doc.putTotalPages(TOTAL_PAGES); // …resolved here, once
  var pages = doc.getNumberOfPages();
  var buf = doc.output('arraybuffer');
  return { bytes: new Uint8Array(buf), data: d, pages: pages };
}

function downloadCFOPDF(A, opts) {
  opts = opts || {};
  var res = generateCFOPDFBytes(A, opts);
  var d = res.data;
  var fname = 'cfo-bot-traffic-cost-' + d.meta.periodStart + '-to-' + d.meta.periodEnd + '.pdf';
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

var api = { buildCFOData: buildCFOData, generateCFOPDFBytes: generateCFOPDFBytes, downloadCFOPDF: downloadCFOPDF, san: san, tierLabel: tierLabel, nextSteps: nextSteps };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CFOPDF = api;

})(typeof window !== 'undefined' ? window : globalThis);
