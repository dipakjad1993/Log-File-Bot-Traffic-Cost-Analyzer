#!/usr/bin/env node
/* Enterprise CLI — exact mode for 500MB-50GB logs + Parquet/BQ bridge.
 * Browser = <500MB Fast Triage (sampled, capped 300k). CLI = 500MB-50GB exact,
 * streaming aggregation (constant memory, no all.push(...spread) blowup).
 * BigQuery = 50GB+ (upload logs.csv / parquet + run bigquery-pack.sql).
 *
 * Usage:
 *   node tools/cli.js --in access.log --exact --out summary.json
 *   node tools/cli.js --in access.log.gz --exact --out summary.json --logs-csv logs.csv --bq-sql bq-pack.sql
 *   node tools/cli.js --in a.log --in b.log.1 --exact --out summary.json
 *   node tools/cli.js --verify-rdns 66.249.66.1   (forward-DNS confirm via Node dns)
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const dns = require('dns').promises;
const A = require('../js/analyzer.js');

function args() {
  const a = process.argv.slice(2);
  const o = { in: [], exact: false, out: null, logsCsv: null, bqSql: null, verifyRdns: null, sampleCap: 300000 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--in') o.in.push(a[++i]);
    else if (a[i] === '--exact') o.exact = true;
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--logs-csv') o.logsCsv = a[++i];
    else if (a[i] === '--bq-sql') o.bqSql = a[++i];
    else if (a[i] === '--verify-rdns') o.verifyRdns = a[++i];
    else if (a[i] === '--sample-cap') o.sampleCap = parseInt(a[++i], 10);
  }
  return o;
}

async function verifyRdns(ip) {
  // Forward-DNS confirm (CLI, server-side): PTR then A/AAAA must resolve back.
  const ptrs = await dns.reverse(ip).catch(() => []);
  const ptr = ptrs[0] || '(no PTR)';
  let fwd = [];
  if (ptrs[0]) {
    try { fwd = await dns.resolve4(ptrs[0]).catch(() => []); } catch (e) {}
    try { const v6 = await dns.resolve6(ptrs[0]).catch(() => []); fwd = fwd.concat(v6); } catch (e) {}
  }
  const match = fwd.includes(ip);
  console.log(JSON.stringify({ ip, ptr, forward: fwd, match }, null, 2));
  process.exit(match ? 0 : 2);
}

function openLines(file) {
  const stream = fs.createReadStream(file);
  const input = /\.gz$/i.test(file) ? stream.pipe(zlib.createGunzip()) : stream;
  return readline.createInterface({ input, crlfDelay: Infinity });
}

async function main() {
  const o = args();
  if (o.verifyRdns) return verifyRdns(o.verifyRdns);
  if (!o.in.length) {
    console.error('Usage: node tools/cli.js --in access.log [--in b.log.1] --exact --out summary.json [--logs-csv logs.csv --bq-sql bq-pack.sql]');
    console.error('Browser = <500MB triage (sampled). CLI --exact = 500MB-50GB streaming exact. 50GB+ = BigQuery.');
    process.exit(1);
  }
  // Streaming aggregation: constant memory — never hold all records.
  // We aggregate via A.norm/classifyBot per line, mirroring A.analyze() tiers.
  let totalLines = 0, kept = 0, stride = 1;
  // Two-pass stride: first count lines if not --exact? For --exact stride=1 always.
  const exact = o.exact;
  const botCounts = {}, botBytes = {}, tierCounts = {};
  const jsShellRows = [];
  let totalBytes = 0;
  const cfg = { cdnEgress: 0.09, request10K: 0.0075, ssr1K: 0 };
  const csvRows = o.logsCsv ? ['ip,tstamp,method,uri,status,ua,bytes,rt,referer,tls,cache,bot,tier'] : null;

  for (const file of o.in) {
    const rl = openLines(file);
    const ctx = { w3c: null, format: 'unknown' };
    for await (const line of rl) {
      const p = A.parseLine(line, ctx);
      if (!p || p.skip) continue;
      totalLines++;
      if (!exact && totalLines > o.sampleCap) continue; // triage cap
      const n = A.norm(p.rec);
      const c = A.classifyBot(n.ua);
      kept++;
      totalBytes += n.bytes;
      botCounts[c.name] = (botCounts[c.name] || 0) + 1;
      botBytes[c.name] = (botBytes[c.name] || 0) + n.bytes;
      const t = A.normalizeTier(c.tier);
      tierCounts[t] = (tierCounts[t] || 0) + 1;
      if ((t === 'ai_training' || t === 'ai_search_index') && n.status >= 200 && n.status < 300 && n.bytes < 5120) {
        if (jsShellRows.length < 200) jsShellRows.push({ bot: c.name, uri: String(n.uri).slice(0, 120), bytes: n.bytes, ip: n.ip });
      }
      if (csvRows && csvRows.length < 100001) {
        const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        csvRows.push([n.ip, n.tstamp ? n.tstamp.toISOString() : '', n.method, n.uri, n.status, q(n.ua), n.bytes, n.rt == null ? '' : n.rt, q(n.referer), n.tls, n.cache, q(c.name), c.tier].join(','));
      }
    }
  }
  const egGB = totalBytes / 1073741824;
  const total = egGB * cfg.cdnEgress + (kept / 10000) * cfg.request10K;
  const summary = {
    v: 1, mode: exact ? 'exact' : 'triage-sampled', db: A.BOT_DB_VERSION,
    when: new Date().toISOString(), files: o.in, totalLines, kept, stride,
    totalBytes, totalUSD: +total.toFixed(4),
    botCounts, tierCounts,
    jsShell: { total: jsShellRows.length, rows: jsShellRows.slice(0, 50) },
    note: exact ? 'Exact streaming totals (no sampling).' : `Triage cap ${o.sampleCap} — re-run with --exact for full totals.`,
    scale: 'browser=<500MB sampled | cli=500MB-50GB exact | bigquery=50GB+'
  };
  if (o.out) { fs.writeFileSync(o.out, JSON.stringify(summary, null, 2)); console.log('wrote ' + o.out + ' (' + kept + '/' + totalLines + ')'); }
  else console.log(JSON.stringify(summary, null, 2));
  if (o.logsCsv) { fs.writeFileSync(o.logsCsv, csvRows.join('\n')); console.log('wrote ' + o.logsCsv); }
  if (o.bqSql) { const p = A.genBQPack(); fs.writeFileSync(o.bqSql, p.ddl + '\n' + p.queries); console.log('wrote ' + o.bqSql); }
  // Parquet note: Parquet is columnar — for native export use DuckDB:
  //   CREATE TABLE logs AS SELECT * FROM read_csv('logs.csv', header=true);
  //   COPY logs TO 'logs.parquet' (FORMAT PARQUET, PARTITION_BY (date));
  console.log('Parquet: load logs.csv in DuckDB/BigQuery, then COPY TO parquet (see BIGQUERY.md).');
}

main().catch((e) => { console.error('CLI error:', e.message); process.exit(1); });
