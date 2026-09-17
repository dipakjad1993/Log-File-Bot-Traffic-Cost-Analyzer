/* ============================================================
   CFO PDF engine — zero-dependency, 100% client-side.
   Generates a REAL .pdf download (PDF 1.4, Helvetica only).
   No CDN, no fonts, no network — keeps the offline/privacy audit green.
   Used by js/analyzer.js exportCFOPDF(). Node-testable via module.exports.

   v1.0.1: WinAnsi-safe output (all text sanitized to ASCII before it hits
   the content stream) + real table grid with right-aligned numerics,
   wrapping rows, non-overlapping KPI cards, smart bar labels.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- ASCII sanitizer: Helvetica Base-14 = WinAnsi only ----------
   Any char outside printable ASCII is mapped BEFORE pdfEsc runs, so the
   stream Length, xref offsets and byte conversion (all ASCII-based) stay
   exact and viewers never render mojibake like "[116;5u". */
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
  // Prefer the head token: "Human Browser (Chrome on Windows)" -> "Human Browser (Chrome...)"
  var cut = t.slice(0, max - 3);
  var sp = cut.lastIndexOf(' ');
  if (sp > max * 0.5) cut = cut.slice(0, sp);
  return cut + '...';
}

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
  // Guard absurd extrapolation: cap scaling display, always label the base window.
  var scaledCapped = periodDays && (periodDays < 0.5 || periodDays > 400);

  var total = +((c.total && c.total.all) || 0);
  var blockable = +((c.savings && c.savings.botBlocking) || 0);
  var monthly = blockable * monthlyFactor;
  var annual = monthly * 12;
  var records = s.totalRecords || 0;
  var stride = (A && A.stride) || 1;
  var sampled = !!(stride && stride > 1) || !!((A && A.vs && A.vs.sampled));
  var badge = sampled ? ('SAMPLED 1-in-' + stride) : 'EXACT';

  // Cost by tier (display taxonomy)
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

  // Top bots by measured cost
  var topBots = Object.keys(c.byBot || {}).map(function (bn) {
    var v = c.byBot[bn];
    return { bot: bn, tier: (A.botData && A.botData[bn] && A.botData[bn].tier) || '', count: v.count || 0, bytes: v.totalBytes || 0, cost: v.total || 0 };
  }).sort(function (a, b) { return b.cost - a.cost; }).slice(0, 8);

  // Traps with $ attribution (same rate math as calcCosts)
  var traps = [];
  try {
    var entries = Object.entries(A.traps || {}).sort(function (a, b) { return b[1].count - a[1].count; }).slice(0, 5);
    for (var i = 0; i < entries.length; i++) {
      var tn = entries[i][0], tv = entries[i][1];
      var tCost = (tv.bytes / 1073741824) * cdnEgress + (tv.count / 10000) * req10k;
      traps.push({ name: tn, count: tv.count, bytes: tv.bytes, cost: tCost, share: total > 0 ? tCost / total * 100 : 0, sev: tv.sev || '' });
    }
  } catch (e) {}

  // Safe business actions (NEVER raw truncated UA): derive from edge rules but
  // rewrite as finance-safe rows with risk + savings lookup.
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

  // Do-not-block guardrails (revenue protection)
  var doNotBlock = ['OAI-SearchBot (search-index -- citations)', 'PerplexityBot (search-index -- best referral)', 'OAI-AdsBot (shopping ads -- revenue)', 'ChatGPT-User / Perplexity-User / Claude-User (user-triggered -- 429 = missing answer)'];

  var vs = (A && A.vs) || {};
  var spoof = (A && A.spoof) || { claimed: 0, unverified: 0, unverifiedPct: 0 };
  var ppcMonthly = 0;
  try {
    var trainHits = 0;
    for (var k in (A.botData || {})) { if (A.botData[k].tier === 'ai_training') trainHits += A.botData[k].count || 0; }
    var perMo = periodDays ? trainHits * (30 / periodDays) : trainHits;
    ppcMonthly = perMo * 0.002; // $0.002/request Pay Per Crawl beta
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

/* ---------- minimal PDF 1.4 writer (Helvetica only, ASCII-only stream) ---------- */
function pdfEsc(s) {
  return san(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function wrap(s, n) {
  s = san(s);
  var words = s.split(/\s+/), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (!w) continue;
    if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    while (cur.length > n * 2) { lines.push(cur.slice(0, n)); cur = cur.slice(n); }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function PdfDoc() {
  this.W = 595; this.H = 842; this.M = 40;
  this.pages = [[]]; // array of op-arrays per page
  this.y = 0;
  this.pageNo = 0;
  this.resetPage = function () { this.y = this.H - 46; };
  this.resetPage();
  this.op = function (s) { this.pages[this.pageNo].push(s); };
  this.newPage = function () { this.pages.push([]); this.pageNo++; this.resetPage(); };
  this.need = function (h) { if (this.y - h < 56) this.newPage(); };
  this.text = function (x, str, size, bold, color) {
    var f = bold ? 'F2' : 'F1';
    var c = color || [0.10, 0.11, 0.17];
    this.op('BT /' + f + ' ' + size + ' Tf ' + c[0].toFixed(2) + ' ' + c[1].toFixed(2) + ' ' + c[2].toFixed(2) + ' rg ' + x.toFixed(1) + ' ' + this.y.toFixed(1) + ' Td (' + pdfEsc(str) + ') Tj ET');
  };
  // Right-aligned text ending at xRight (for numeric columns / badges / values)
  this.textR = function (xRight, str, size, bold, color) {
    var t = san(str);
    var w = t.length * size * 0.55; // Helvetica avg advance ~0.55em
    this.text(xRight - w, t, size, bold, color);
  };
  this.fillRect = function (x, y, w, h, fill) {
    this.op(fill[0].toFixed(2) + ' ' + fill[1].toFixed(2) + ' ' + fill[2].toFixed(2) + ' rg ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1) + ' re f');
  };
  this.box = function (x, y, w, h, fill, stroke) {
    if (fill) this.fillRect(x, y, w, h, fill);
    var s = stroke || [0.78, 0.80, 0.86];
    this.op(s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' ' + s[2].toFixed(2) + ' RG 0.7 w ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1) + ' re S');
  };
  this.hline = function (x1, x2, y) {
    this.op('0.78 0.80 0.86 RG 0.7 w ' + x1.toFixed(1) + ' ' + y.toFixed(1) + ' m ' + x2.toFixed(1) + ' ' + y.toFixed(1) + ' l S');
  };
  this.vline = function (x, y1, y2) {
    this.op('0.78 0.80 0.86 RG 0.6 w ' + x.toFixed(1) + ' ' + y1.toFixed(1) + ' m ' + x.toFixed(1) + ' ' + y2.toFixed(1) + ' l S');
  };
}

var INK = [0.10, 0.11, 0.17], MUT = [0.29, 0.31, 0.41], FAINT = [0.49, 0.51, 0.62];
var ACC = [0.31, 0.27, 0.90], HDR = [0.16, 0.18, 0.28], RED = [0.86, 0.15, 0.15];

function drawHeader(doc, d) {
  var W = doc.W, M = doc.M;
  doc.op('0.31 0.27 0.90 rg 0 786 595 56 re f');
  doc.y = 818;
  doc.text(M, 'BOT TRAFFIC COST - EXECUTIVE SUMMARY', 11, true, [1, 1, 1]);
  doc.y = 804;
  doc.text(M, san(d.meta.domain) + '  |  ' + d.meta.periodStart + ' to ' + d.meta.periodEnd + '  |  Generated ' + d.meta.generated, 7.5, false, [0.88, 0.89, 0.97]);
  doc.textR(W - M, san(d.meta.badge), 7.5, true, [1, 1, 1]);
  doc.y = 772;
}
function h1(doc, t) {
  doc.need(28);
  doc.text(doc.M, t, 12, true, INK);
  doc.y -= 6;
  doc.hline(doc.M, doc.W - doc.M, doc.y);
  doc.y -= 12;
}
function h2(doc, t) {
  doc.need(20);
  doc.text(doc.M, t, 9.5, true, ACC);
  doc.y -= 11;
}
function para(doc, t, size, color) {
  var lines = wrap(t, 102);
  for (var i = 0; i < lines.length; i++) {
    doc.need(12);
    doc.text(doc.M, lines[i], size || 8.5, false, color);
    doc.y -= 10.5;
  }
  doc.y -= 2;
}

/* KPI cards: reserve the whole grid up front so page breaks never split it,
   then lay out row by row from a fixed top. */
function kpiGrid(doc, d) {
  var M = doc.M, W = doc.W;
  var gw = (W - M * 2 - 12) / 2, gh = 46, gap = 8;
  var kpis = [
    { l: 'TOTAL PERIOD COST', v: money(d.kpis.total), s: num(d.meta.records) + ' records  |  ' + bytesFmt(d.totalBytes), c: [0.96, 0.96, 1.0] },
    { l: 'BLOCKABLE (PERIOD)', v: money(d.kpis.blockable) + '  (' + pct(d.kpis.blockableShare) + ')', s: 'Training + suspicious only', c: [1.0, 0.93, 0.93] },
    { l: 'PROJECTED MONTHLY SAVING', v: money(d.kpis.monthly) + ' / mo', s: 'Scaled x' + d.kpis.monthlyFactor.toFixed(2) + ' from ' + (d.meta.periodDays ? d.meta.periodDays.toFixed(0) + '-day window' : 'window'), c: [0.93, 1.0, 0.94] },
    { l: 'PROJECTED ANNUAL SAVING', v: money(d.kpis.annual) + ' / yr', s: '12 x monthly  |  95% CI +/-' + money(d.meta.ciAbs), c: [0.93, 0.98, 1.0] }
  ];
  doc.need(gh * 2 + gap + 6);
  var yTop = doc.y;
  for (var i = 0; i < 4; i++) {
    var col = i % 2, row = Math.floor(i / 2);
    var x = M + col * (gw + 12);
    var top = yTop - row * (gh + gap);
    doc.box(x, top - gh, gw, gh, kpis[i].c, [0.78, 0.80, 0.86]);
    var ySave = doc.y;
    doc.y = top - 13; doc.text(x + 8, kpis[i].l, 6.5, true, FAINT);
    doc.y = top - 28; doc.text(x + 8, kpis[i].v, 11, true, INK);
    doc.y = top - 40; doc.text(x + 8, kpis[i].s.slice(0, 54), 7, false, MUT);
    doc.y = ySave;
  }
  doc.y = yTop - (gh * 2 + gap) - 8;
}

/* Enterprise table: header band, zebra rows, full grid (outer box, row
   rules, column rules), left-aligned text columns, right-aligned numeric
   columns, and word-wrapped cells with dynamic row height. No truncation. */
function table(doc, cols, rows, opts) {
  opts = opts || {};
  var M = doc.M, W = doc.W;
  var avail = W - M * 2;
  var widths = cols.map(function (c) { return avail * c.w; });
  var fs = opts.fontSize || 7.5, lh = 9.5;
  var pad = 4;

  function rowLines(row) {
    var max = 1;
    for (var i = 0; i < cols.length; i++) {
      var maxCh = Math.max(10, Math.floor((widths[i] - pad * 2) / (fs * 0.55)));
      var ls = wrap(row[i], maxCh);
      row['_w' + i] = ls;
      if (ls.length > max) max = ls.length;
    }
    return max;
  }
  function drawHeaderRow() {
    var hh = 15;
    doc.need(hh + 4);
    doc.fillRect(M, doc.y - hh + 2, avail, hh, HDR);
    var ySave = doc.y, x = M;
    for (var i = 0; i < cols.length; i++) {
      doc.y = ySave - 1;
      doc.text(x + pad, san(cols[i].t).toUpperCase(), 6.5, true, [1, 1, 1]);
      x += widths[i];
    }
    // column rules over header
    var xx = M;
    for (var j = 0; j < cols.length; j++) { doc.vline(xx, ySave - hh + 2, ySave + 2); xx += widths[j]; }
    doc.vline(M + avail, ySave - hh + 2, ySave + 2);
    doc.y = ySave - hh - 1;
  }
  drawHeaderRow();
  for (var r = 0; r < rows.length; r++) {
    var nlines = rowLines(rows[r]);
    var rh = Math.max(14, nlines * lh + 5);
    doc.need(rh + 1);
    var top = doc.y;
    if (r % 2 === 1) doc.fillRect(M, top - rh + 2, avail, rh, [0.96, 0.97, 0.99]);
    var ySave2 = doc.y, x2 = M;
    for (var cI = 0; cI < cols.length; cI++) {
      var lines = rows[r]['_w' + cI];
      var right = (cols[cI].a === 'r');
      var col = (opts.redLast && cI === cols.length - 1) ? RED : (cI === 0 && opts.boldCol0 ? INK : MUT);
      for (var li = 0; li < lines.length; li++) {
        doc.y = top - 3 - li * lh - 7;
        if (right) doc.textR(x2 + widths[cI] - pad, lines[li], fs, cI === 0 && opts.boldCol0, col);
        else doc.text(x2 + pad, lines[li], fs, cI === 0 && !!opts.boldCol0, col);
      }
      x2 += widths[cI];
    }
    // grid: row rule + column rules
    doc.hline(M, M + avail, top - rh + 2);
    var gx = M;
    for (var g = 0; g < cols.length; g++) { doc.vline(gx, top - rh + 2, top + 2); gx += widths[g]; }
    doc.vline(M + avail, top - rh + 2, top + 2);
    doc.y = ySave2 - rh - 0.5;
  }
  doc.y -= 6;
}

function bars(doc, d) {
  if (!d.topBots.length) return;
  h2(doc, 'Cost concentration (top bots)');
  var max = Math.max.apply(null, d.topBots.map(function (b) { return b.cost; }).concat([0.0001]));
  var M = doc.M, W = doc.W;
  var labelW = 225, barW = 195;
  var valX = W - M;
  for (var i = 0; i < Math.min(5, d.topBots.length); i++) {
    var b = d.topBots[i];
    doc.need(15);
    doc.text(M, shortBot(b.bot, 38), 7.5, true, INK);
    var bw = barW * (b.cost / max);
    doc.fillRect(M + labelW, doc.y - 2, Math.max(3, bw), 8, ACC);
    doc.textR(valX, money(b.cost), 7.5, true, INK);
    doc.y -= 13.5;
  }
  doc.y -= 2;
}

function generateCFOPDFBytes(A, opts) {
  var d = buildCFOData(A, opts);
  var doc = new PdfDoc();
  drawHeader(doc, d);

  // Executive narrative
  doc.need(66);
  doc.fillRect(doc.M, doc.y - 54, doc.W - doc.M * 2, 54, [0.93, 0.95, 1.0]);
  doc.box(doc.M, doc.y - 54, doc.W - doc.M * 2, 54, null, [0.78, 0.80, 0.86]);
  var yBox = doc.y;
  doc.y = yBox - 12; doc.text(doc.M + 8, 'EXECUTIVE RECOMMENDATION', 7.5, true, ACC);
  doc.y = yBox - 15;
  para(doc, '    AI training bots consumed ' + money(d.kpis.blockable) + ' (' + pct(d.kpis.blockableShare) + ' of egress) with zero citation value. Blocking recovers ~' + money(d.kpis.monthly) + '/mo (' + money(d.kpis.annual) + '/yr). Search-index + user-fetch traffic must stay allowed -- blocking drops AI citations in 1-2 weeks and breaks shopping-ad verification.', 8.5);
  doc.y -= 2;

  h1(doc, '1 - Financials (measured, auditable)');
  kpiGrid(doc, d);
  h2(doc, 'Cost breakdown by tier');
  table(doc, [{ t: 'Tier', w: 0.34 }, { t: 'Requests', w: 0.16, a: 'r' }, { t: 'Bandwidth', w: 0.16, a: 'r' }, { t: 'Cost', w: 0.17, a: 'r' }, { t: 'Share', w: 0.17, a: 'r' }],
    d.tierRows.map(function (r) { return [r.tier, num(r.reqs), bytesFmt(r.bytes), money(r.cost), pct(r.share)]; }),
    { boldCol0: true });
  para(doc, 'Pricing: ' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K. Origin-compute excluded unless opt-in. ' + d.meta.badge + ' analysis.' + (d.meta.scaledCapped ? ' Window <0.5d or >400d -- treat monthly/annual as directional, act on period savings.' : ''), 7);

  h1(doc, '2 - Where the waste is');
  h2(doc, 'Top cost bots (measured)');
  table(doc, [{ t: 'Bot', w: 0.32 }, { t: 'Tier', w: 0.24 }, { t: 'Reqs', w: 0.15, a: 'r' }, { t: 'Bytes', w: 0.14, a: 'r' }, { t: 'Cost', w: 0.15, a: 'r' }],
    d.topBots.map(function (b) { return [b.bot, b.tier, num(b.count), bytesFmt(b.bytes), money(b.cost)]; }),
    { boldCol0: true, redLast: true });
  bars(doc, d);
  h2(doc, 'Crawl traps -> $ waste (fix owners: Eng/SEO)');
  if (d.traps.length) {
    table(doc, [{ t: 'Trap', w: 0.36 }, { t: 'Reqs', w: 0.15, a: 'r' }, { t: 'Waste', w: 0.15, a: 'r' }, { t: 'Cost', w: 0.17, a: 'r' }, { t: 'Share', w: 0.17, a: 'r' }],
      d.traps.map(function (t) { return [t.name, num(t.count), bytesFmt(t.bytes), money(t.cost), pct(t.share)]; }),
      { boldCol0: true });
  } else para(doc, 'No parameterized/faceted trap patterns above threshold in this window.', 8);

  h1(doc, '3 - Actions (finance-safe, eng-ready)');
  if (d.actions.length) {
    table(doc, [{ t: 'Bot', w: 0.28 }, { t: 'Edge action', w: 0.28 }, { t: 'Saving', w: 0.16, a: 'r' }, { t: 'Risk', w: 0.28 }],
      d.actions.map(function (a) { return [a.bot, a.action, money(a.saving), a.risk]; }),
      { boldCol0: true });
  } else para(doc, 'No training/suspicious volume above the >=2-request floor -- nothing to block. Re-run after a larger window.', 8);
  h2(doc, 'Do NOT block (revenue / citation protection)');
  d.doNotBlock.forEach(function (x) { para(doc, '- ' + x, 7.5); });
  try {
    if (d.kpis.ppcMonthly > 0.5) para(doc, 'Pay Per Crawl upside (402 beta, $0.002/req on training hits): ~' + money(d.kpis.ppcMonthly) + '/mo recoverable instead of pure block.', 7.5);
  } catch (e) {}

  h1(doc, '4 - Trust, method and sign-off');
  para(doc, 'Verification: ' + num(d.verify.verified) + ' checks match expected patterns; ' + num(d.verify.suspicious) + ' unusual. Claimed AI fetches: ' + num(d.verify.claimed) + ', unverified ' + num(d.verify.unverified) + ' (' + pct(d.verify.unverifiedPct) + '). Confirm blocks with vendor IP JSON + server-side reverse DNS (dig -x) before enforcing.', 7.5);
  para(doc, 'Human ' + pct(d.humanPct) + ' / bot ' + pct(d.botPct) + '  |  IPs ' + num(d.uniqueIPs) + '  |  URLs ' + num(d.uniqueURLs) + '  |  File: ' + (d.meta.file || 'upload') + '  |  Tool v' + d.meta.db + ' client-side -- no log leaves this browser.', 7);
  para(doc, 'Method: ' + d.method, 7);
  doc.need(30);
  doc.text(doc.M, 'Approved: ______________________    Date: __________    Owner: __________', 8, false);
  doc.y -= 14;
  doc.text(doc.M, 'Full WAF + robots bundle lives in Module 6 (copy buttons) -- this PDF carries the business case, not raw regex.', 7, false, FAINT);

  var total = doc.pages.length;
  for (var p = 0; p < total; p++) { doc.pageNo = p; }
  return { bytes: assemble(doc, d), data: d, pages: total };
}

function assemble(doc, d) {
  var nPages = doc.pages.length;
  // object numbering: 1 catalog, 2 pages, 3 fontR, 4 fontB, then 5.. pairs
  var pageObjNums = [], contentObjNums = [];
  var next = 5;
  for (var i = 0; i < nPages; i++) { pageObjNums.push(next++); contentObjNums.push(next++); }
  var out = ['%PDF-1.4', '%enterprise-cfo'];
  var offsets = [0];
  function pushObj(n, body) {
    offsets[n] = out.join('\n').length + 1;
    out.push(n + ' 0 obj');
    out.push(body);
    out.push('endobj');
  }
  pushObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  pushObj(2, '<< /Type /Pages /Kids [' + pageObjNums.map(function (n) { return n + ' 0 R'; }).join(' ') + '] /Count ' + nPages + ' >>');
  pushObj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pushObj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  var footL = san('Confidential  |  Measured bytes x configured CDN pricing. Blockable = training + suspicious only.');
  for (var p = 0; p < nPages; p++) {
    var ops = doc.pages[p].slice();
    var footOps = [];
    footOps.push('0.78 0.80 0.86 RG 0.6 w ' + doc.M + ' 44 m ' + (doc.W - doc.M) + ' 44 l S');
    footOps.push('BT /F1 6.5 Tf 0.49 0.51 0.62 rg ' + doc.M.toFixed(1) + ' 32.0 Td (' + pdfEsc(footL) + ') Tj ET');
    var pg = 'Page ' + (p + 1) + ' of ' + nPages;
    var pgW = san(pg).length * 6.5 * 0.55;
    footOps.push('BT /F1 6.5 Tf 0.49 0.51 0.62 rg ' + (doc.W - doc.M - pgW).toFixed(1) + ' 32.0 Td (' + pdfEsc(pg) + ') Tj ET');
    var stream = ops.concat(footOps).join('\n');
    pushObj(contentObjNums[p], '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    pushObj(pageObjNums[p], '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentObjNums[p] + ' 0 R >>');
  }
  var xrefPos = out.join('\n').length + 1;
  var maxObj = next - 1;
  out.push('xref');
  out.push('0 ' + (maxObj + 1));
  out.push('0000000000 65535 f ');
  for (var o = 1; o <= maxObj; o++) {
    var off = offsets[o] || 0;
    out.push(String(off).padStart(10, '0') + ' 00000 n ');
  }
  out.push('trailer');
  out.push('<< /Size ' + (maxObj + 1) + ' /Root 1 0 R >>');
  out.push('startxref');
  out.push(String(xrefPos));
  out.push('%%EOF');
  var str = out.join('\n');
  // Stream is pure ASCII by construction (san() at every emit point).
  var bytes = new Uint8Array(str.length);
  for (var b = 0; b < str.length; b++) bytes[b] = str.charCodeAt(b) & 0x7f;
  return bytes;
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

var api = { buildCFOData: buildCFOData, generateCFOPDFBytes: generateCFOPDFBytes, downloadCFOPDF: downloadCFOPDF, san: san };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CFOPDF = api;

})(typeof window !== 'undefined' ? window : globalThis);
