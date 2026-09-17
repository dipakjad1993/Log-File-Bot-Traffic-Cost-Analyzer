/* ============================================================
   CFO PDF engine — zero-dependency, 100% client-side.
   Generates a REAL .pdf download (PDF 1.4, Helvetica only).
   No CDN, no fonts, no network — keeps the offline/privacy audit green.
   Used by js/analyzer.js exportCFOPDF(). Node-testable via module.exports.
   ============================================================ */
(function (root) {
'use strict';

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
      var risk = /BLOCK/i.test(r.act || '') ? 'None — training' : /RATE-LIMIT/i.test(r.act || '') ? 'Medium — citations if over-blocked' : /ALLOW/i.test(r.act || '') ? 'Do not block' : 'Low — challenge first';
      actions.push({ bot: nm, action: r.act || '', saving: bCost, risk: risk });
    }
  } catch (e) {}

  // Do-not-block guardrails (revenue protection)
  var doNotBlock = ['OAI-SearchBot (search-index — citations)', 'PerplexityBot (search-index — best referral)', 'OAI-AdsBot (shopping ads — revenue)', 'ChatGPT-User / Perplexity-User / Claude-User (user-triggered — 429 = missing answer)'];

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

/* ---------- minimal PDF 1.4 writer (Helvetica only) ---------- */
function pdfEsc(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r?\n/g, ' ');
}
function wrap(s, n) {
  s = String(s == null ? '' : s);
  var words = s.split(/\s+/), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (cur.length > n * 2) { lines.push(cur.slice(0, n)); cur = cur.slice(n); }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function PdfDoc() {
  this.W = 595; this.H = 842; this.M = 40;
  this.pages = [[]]; // array of op-arrays per page
  this.y = 0;
  this.pageNo = 0;
  this.fonts = { R: 'F1', B: 'F2' };
  this.resetPage = function () { this.y = this.H - 46; };
  this.resetPage();
  this.op = function (s) { this.pages[this.pageNo].push(s); };
  this.newPage = function () { this.pages.push([]); this.pageNo++; this.resetPage(); };
  this.need = function (h) { if (this.y - h < 52) this.newPage(); };
  this.text = function (x, str, size, bold, color) {
    var f = bold ? 'F2' : 'F1';
    var c = color || [0.1, 0.11, 0.17];
    this.op('BT /' + f + ' ' + size + ' Tf ' + c[0].toFixed(2) + ' ' + c[1].toFixed(2) + ' ' + c[2].toFixed(2) + ' rg ' + x.toFixed(1) + ' ' + this.y.toFixed(1) + ' Td (' + pdfEsc(str) + ') Tj ET');
  };
  this.rect = function (x, y, w, h, fill, stroke) {
    var ops = '';
    if (fill) ops += fill[0].toFixed(2) + ' ' + fill[1].toFixed(2) + ' ' + fill[2].toFixed(2) + ' rg ';
    // draw as filled rect path
    this.op((fill ? fill[0].toFixed(2) + ' ' + fill[1].toFixed(2) + ' ' + fill[2].toFixed(2) + ' rg ' : '') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1) + ' re f');
    if (stroke) this.op(stroke[0].toFixed(2) + ' ' + stroke[1].toFixed(2) + ' ' + stroke[2].toFixed(2) + ' RG 0.7 w ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1) + ' re S');
    return ops;
  };
  this.line = function (x1, y1, x2, y2) {
    this.op('0.78 0.80 0.86 RG 0.7 w ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' m ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' l S');
  };
}

function drawHeader(doc, d) {
  var W = doc.W, M = doc.M;
  // brand band
  doc.op('0.31 0.27 0.90 rg 0 786 595 56 re f');
  doc.y = 818;
  doc.text(M, 'BOT TRAFFIC COST  —  EXECUTIVE SUMMARY', 11, true, [1, 1, 1]);
  doc.y = 804;
  doc.text(M, d.meta.domain + '   |   ' + d.meta.periodStart + ' to ' + d.meta.periodEnd + '   |   Generated ' + d.meta.generated, 7.5, false, [0.88, 0.89, 0.97]);
  var b = d.meta.badge;
  doc.text(W - M - b.length * 4.6 - 14, b, 7.5, true, [1, 1, 1]);
  doc.y = 772;
}
function drawFooter(doc, idx, total, d) {
  var M = doc.M;
  doc.op('0.78 0.80 0.86 RG 0.6 w ' + M + ' 44 m ' + (doc.W - M) + ' 44 l S');
  var ySave = doc.y; doc.y = 32;
  doc.text(M, 'Confidential  |  ' + d.method.slice(0, 118), 6.5, false, [0.49, 0.51, 0.62]);
  var pg = 'Page ' + (idx + 1) + ' of ' + total;
  doc.text(doc.W - M - pg.length * 4.2, pg, 6.5, false, [0.49, 0.51, 0.62]);
  doc.y = ySave;
}
function h1(doc, t) {
  doc.need(26);
  doc.text(doc.M, t, 12, true, [0.10, 0.11, 0.17]);
  doc.y -= 6;
  doc.line(doc.M, doc.y, doc.W - doc.M, doc.y);
  doc.y -= 12;
}
function h2(doc, t) {
  doc.need(20);
  doc.text(doc.M, t, 9.5, true, [0.31, 0.27, 0.90]);
  doc.y -= 11;
}
function para(doc, t, size, color) {
  var lines = wrap(t, 104);
  for (var i = 0; i < lines.length; i++) {
    doc.need(11);
    doc.text(doc.M, lines[i], size || 8.5, false, color);
    doc.y -= 10.5;
  }
  doc.y -= 2;
}
function kpiGrid(doc, d) {
  var M = doc.M, W = doc.W;
  var gw = (W - M * 2 - 12) / 2, gh = 44;
  var kpis = [
    { l: 'TOTAL PERIOD COST', v: money(d.kpis.total), s: num(d.meta.records) + ' records  |  ' + bytesFmt(d.totalBytes), c: [0.96, 0.96, 1.0] },
    { l: 'BLOCKABLE (PERIOD)', v: money(d.kpis.blockable) + '  (' + pct(d.kpis.blockableShare) + ')', s: 'Training + suspicious only', c: [1.0, 0.93, 0.93] },
    { l: 'PROJECTED MONTHLY SAVING', v: money(d.kpis.monthly) + ' / mo', s: 'Scaled x' + d.kpis.monthlyFactor.toFixed(2) + ' from ' + (d.meta.periodDays ? d.meta.periodDays.toFixed(0) + '-day window' : 'window'), c: [0.93, 1.0, 0.94] },
    { l: 'PROJECTED ANNUAL SAVING', v: money(d.kpis.annual) + ' / yr', s: '12 x monthly  |  95% CI +-' + money(d.meta.ciAbs), c: [0.93, 0.98, 1.0] }
  ];
  for (var i = 0; i < 4; i++) {
    var col = i % 2, row = Math.floor(i / 2);
    var x = M + col * (gw + 12);
    var yTop = doc.y - row * (gh + 8);
    if (row === 1 && i === 2) { /* same doc.y base */ }
    doc.need(gh + 10);
    var yRect = yTop - gh;
    doc.rect(x, yRect, gw, gh, kpis[i].c, [0.78, 0.80, 0.86]);
    var ySave = doc.y;
    doc.y = yTop - 13; doc.text(x + 8, kpis[i].l, 6.5, true, [0.49, 0.51, 0.62]);
    doc.y = yTop - 28; doc.text(x + 8, kpis[i].v, 11, true, [0.10, 0.11, 0.17]);
    doc.y = yTop - 39; doc.text(x + 8, kpis[i].s.slice(0, 52), 7, false, [0.29, 0.31, 0.41]);
    doc.y = ySave;
    if (i === 1) doc.y = yTop - gh - 8;
    if (i === 3) doc.y = yTop - gh - 10;
  }
}
function table(doc, cols, rows, opts) {
  opts = opts || {};
  var M = doc.M, W = doc.W;
  var avail = W - M * 2;
  var widths = cols.map(function (c) { return avail * c.w; });
  var rh = opts.rowH || 13;
  function headerRow() {
    doc.need(rh + 4);
    var x = M;
    doc.rect(M, doc.y - rh + 2, avail, rh, [0.16, 0.18, 0.28], null);
    var ySave = doc.y;
    doc.y -= 0.5;
    for (var i = 0; i < cols.length; i++) {
      doc.text(x + 4, cols[i].t.toUpperCase().slice(0, 30), 6.5, true, [1, 1, 1]);
      x += widths[i];
    }
    doc.y = ySave - rh - 1;
  }
  headerRow();
  for (var r = 0; r < rows.length; r++) {
    doc.need(rh + 1);
    if (r % 2 === 1) doc.rect(M, doc.y - rh + 2, avail, rh, [0.96, 0.97, 0.99], null);
    var x2 = M, ySave2 = doc.y;
    doc.y -= 0.5;
    for (var cI = 0; cI < cols.length; cI++) {
      var cell = String(rows[r][cI] == null ? '' : rows[r][cI]);
      var maxCh = Math.max(8, Math.floor(widths[cI] / 4.6) - 2);
      if (cell.length > maxCh) cell = cell.slice(0, maxCh - 1) + '.';
      var bold = !!opts.boldCol0 && cI === 0;
      var color = (opts.redLast && cI === cols.length - 1) ? [0.86, 0.15, 0.15] : undefined;
      doc.text(x2 + 4, cell, opts.fontSize || 7.5, bold, color);
      x2 += widths[cI];
    }
    doc.y = ySave2 - rh - 0.5;
  }
  doc.y -= 6;
}
function bars(doc, d) {
  if (!d.topBots.length) return;
  h2(doc, 'Cost concentration (top bots)');
  var max = Math.max.apply(null, d.topBots.map(function (b) { return b.cost; }).concat([0.0001]));
  for (var i = 0; i < Math.min(5, d.topBots.length); i++) {
    var b = d.topBots[i];
    doc.need(16);
    doc.text(doc.M, (b.bot || '').slice(0, 26), 7.5, true);
    var bw = 260 * (b.cost / max);
    doc.rect(doc.M + 170, doc.y - 3, Math.max(3, bw), 8, [0.31, 0.27, 0.90], null);
    doc.text(doc.M + 438, money(b.cost), 7.5, true);
    doc.y -= 14;
  }
  doc.y -= 2;
}

function generateCFOPDFBytes(A, opts) {
  var d = buildCFOData(A, opts);
  var doc = new PdfDoc();
  drawHeader(doc, d);

  // Executive narrative
  doc.op('0.93 0.95 1.0 rg 40 ' + (doc.y - 52).toFixed(1) + ' 515 52 re f');
  var yBox = doc.y;
  doc.text(doc.M + 8, 'EXECUTIVE RECOMMENDATION', 7.5, true, [0.31, 0.27, 0.90]);
  doc.y = yBox - 15;
  para(doc, 'AI training bots consumed ' + money(d.kpis.blockable) + ' (' + pct(d.kpis.blockableShare) + ' of egress) with zero citation value. Blocking recovers ~' + money(d.kpis.monthly) + '/mo (' + money(d.kpis.annual) + '/yr). Search-index + user-fetch traffic must stay allowed — blocking drops AI citations in 1-2 weeks and breaks shopping-ad verification.', 8.5);
  doc.y -= 2;

  h1(doc, '1  |  Financials (measured, auditable)');
  kpiGrid(doc, d);
  h2(doc, 'Cost breakdown by tier');
  table(doc, [{ t: 'Tier', w: 0.34 }, { t: 'Requests', w: 0.16 }, { t: 'Bandwidth', w: 0.16 }, { t: 'Cost', w: 0.17 }, { t: 'Share', w: 0.17 }],
    d.tierRows.map(function (r) { return [r.tier, num(r.reqs), bytesFmt(r.bytes), money(r.cost), pct(r.share)]; }),
    { boldCol0: true });
  para(doc, 'Pricing: ' + d.meta.preset + ' @ $' + d.meta.cdnEgress.toFixed(3) + '/GB + $' + d.meta.req10k.toFixed(4) + '/10K. Origin-compute excluded unless opt-in. ' + d.meta.badge + ' analysis.' + (d.meta.scaledCapped ? ' Window <0.5d or >400d — treat monthly/annual as directional, act on period savings.' : ''), 7);

  h1(doc, '2  |  Where the waste is');
  h2(doc, 'Top cost bots (measured)');
  table(doc, [{ t: 'Bot', w: 0.32 }, { t: 'Tier', w: 0.24 }, { t: 'Reqs', w: 0.15 }, { t: 'Bytes', w: 0.14 }, { t: 'Cost', w: 0.15 }],
    d.topBots.map(function (b) { return [b.bot, b.tier, num(b.count), bytesFmt(b.bytes), money(b.cost)]; }),
    { boldCol0: true, redLast: true });
  bars(doc, d);
  h2(doc, 'Crawl traps → $ waste (fix owners: Eng/SEO)');
  if (d.traps.length) {
    table(doc, [{ t: 'Trap', w: 0.36 }, { t: 'Reqs', w: 0.15 }, { t: 'Waste', w: 0.15 }, { t: 'Cost', w: 0.17 }, { t: '%', w: 0.17 }],
      d.traps.map(function (t) { return [t.name, num(t.count), bytesFmt(t.bytes), money(t.cost), pct(t.share)]; }),
      { boldCol0: true });
  } else para(doc, 'No parameterized/faceted trap patterns above threshold in this window.', 8);

  h1(doc, '3  |  Actions (finance-safe, eng-ready)');
  if (d.actions.length) {
    table(doc, [{ t: 'Bot', w: 0.28 }, { t: 'Edge action', w: 0.28 }, { t: 'Saving', w: 0.16 }, { t: 'Risk', w: 0.28 }],
      d.actions.map(function (a) { return [a.bot, a.action, money(a.saving), a.risk]; }),
      { boldCol0: true });
  } else para(doc, 'No training/suspicious volume above the >=2-request floor — nothing to block. Re-run after a larger window.', 8);
  h2(doc, 'Do NOT block (revenue / citation protection)');
  d.doNotBlock.forEach(function (x) { para(doc, '- ' + x, 7.5); });
  try {
    if (d.kpis.ppcMonthly > 0.5) para(doc, 'Pay Per Crawl upside (402 beta, $0.002/req on training hits): ~' + money(d.kpis.ppcMonthly) + '/mo recoverable instead of pure block.', 7.5);
  } catch (e) {}

  h1(doc, '4  |  Trust, method & sign-off');
  para(doc, 'Verification: ' + num(d.verify.verified) + ' checks match expected patterns; ' + num(d.verify.suspicious) + ' unusual. Claimed AI fetches: ' + num(d.verify.claimed) + ', unverified ' + num(d.verify.unverified) + ' (' + pct(d.verify.unverifiedPct) + '). Confirm blocks with vendor IP JSON + server-side reverse DNS (dig -x) before enforcing.', 7.5);
  para(doc, 'Human ' + pct(d.humanPct) + ' / bot ' + pct(d.botPct) + '  |  IPs ' + num(d.uniqueIPs) + '  |  URLs ' + num(d.uniqueURLs) + '  |  File: ' + (d.meta.file || 'upload') + '  |  Tool v' + d.meta.db + ' client-side — no log leaves this browser.', 7);
  para(doc, 'Method: ' + d.method, 7);
  doc.need(30);
  doc.text(doc.M, 'Approved: ______________________    Date: __________    Owner: __________', 8, false);
  doc.y -= 14;
  doc.text(doc.M, 'Full WAF + robots bundle lives in Module 6 (copy buttons) — this PDF carries the business case, not raw regex.', 7, false, [0.49, 0.51, 0.62]);

  // footers + build
  var total = doc.pages.length;
  for (var p = 0; p < total; p++) { doc.pageNo = p; }
  return { bytes: assemble(doc, d), data: d, pages: total };
}

function assemble(doc, d) {
  var objs = [];
  // 1 catalog, 2 pages, 3.. fonts, then page+content pairs
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
  for (var p = 0; p < nPages; p++) {
    // inject footer ops into page content copy
    var saveNo = doc.pageNo; doc.pageNo = p;
    // footer drawn at assemble time with known total
    var ops = doc.pages[p].slice();
    // rebuild footer text with total pages
    var footOps = [];
    var tmp = { op: function (s) { footOps.push(s); }, W: doc.W, M: doc.M, y: 32, text: doc.text.bind({ op: function (s) { footOps.push(s); }, y: 32 }) };
    // manual footer (avoid rebinding complexity): replicate drawFooter strings
    footOps.push('0.78 0.80 0.86 RG 0.6 w ' + doc.M + ' 44 m ' + (doc.W - doc.M) + ' 44 l S');
    footOps.push('BT /F1 6.5 Tf 0.49 0.51 0.62 rg ' + doc.M.toFixed(1) + ' 32.0 Td (Confidential  |  Measured bytes x configured CDN pricing. Blockable = training + suspicious only.) Tj ET');
    var pg = 'Page ' + (p + 1) + ' of ' + nPages;
    footOps.push('BT /F1 6.5 Tf 0.49 0.51 0.62 rg ' + (doc.W - doc.M - pg.length * 4.2).toFixed(1) + ' 32.0 Td (' + pdfEsc(pg) + ') Tj ET');
    var stream = ops.concat(footOps).join('\n');
    pushObj(contentObjNums[p], '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    pushObj(pageObjNums[p], '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentObjNums[p] + ' 0 R >>');
    doc.pageNo = saveNo;
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
  // latin-1 bytes
  var bytes = new Uint8Array(str.length);
  for (var b = 0; b < str.length; b++) bytes[b] = str.charCodeAt(b) & 0xff;
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

var api = { buildCFOData: buildCFOData, generateCFOPDFBytes: generateCFOPDFBytes, downloadCFOPDF: downloadCFOPDF };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CFOPDF = api;

})(typeof window !== 'undefined' ? window : globalThis);
