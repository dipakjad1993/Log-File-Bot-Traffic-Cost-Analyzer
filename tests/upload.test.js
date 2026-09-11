const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

test('parseLine: JSON, array-comma lines, brackets, blanks', () => {
  const ctx = {};
  assert.equal(A.parseLine('{"a":1}', ctx).fmt, 'json');
  assert.equal(A.parseLine('{"a":1},', ctx).fmt, 'json');
  assert.deepEqual(A.parseLine('[', ctx), { skip: true });
  assert.deepEqual(A.parseLine(']', ctx), { skip: true });
  assert.deepEqual(A.parseLine('   ', ctx), { skip: true });
  assert.deepEqual(A.parseLine('#Version: 1.0', ctx), { skip: true });
});

test('parseLine: combined standard + resilient variants', () => {
  const ctx = {};
  const r = A.parseLine('127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /a.gif HTTP/1.0" 200 2326 "-" "Mozilla/5.0"', ctx);
  assert.equal(r.fmt, 'combined');
  assert.equal(r.rec.request_uri, '/a.gif');
  assert.equal(r.rec.user_agent, 'Mozilla/5.0');
  const dash = A.parseLine('1.2.3.4 - - [25/Jul/2026:10:00:00 +0000] "-" 408 - "-" "-"', ctx);
  assert.equal(dash.fmt, 'combined');
  assert.equal(dash.rec.bytes_sent, 0);
  assert.equal(dash.rec.request_uri, '/');
  const noUA = A.parseLine('1.2.3.4 - - [25/Jul/2026:10:00:00 +0000] "GET /x HTTP/1.1" 200 1234', ctx);
  assert.equal(noUA.fmt, 'combined');
  assert.equal(noUA.rec.status, '200');
});

test('parseLine: W3C with #Fields header', () => {
  const ctx = {};
  A.parseLine('#Fields: date time c-ip cs-method cs-uri-stem cs-uri-query sc-status sc-bytes cs(User-Agent)', ctx);
  assert.deepEqual(ctx.w3c.slice(0, 3), ['date', 'time', 'c-ip']);
  const r = A.parseLine('2026-09-01 10:00:00 1.2.3.4 GET /search q=bot 200 1234 "Mozilla/5.0 (compatible; Googlebot/2.1)"', ctx);
  assert.equal(r.fmt, 'w3c');
  assert.equal(r.rec.remote_addr, '1.2.3.4');
  assert.equal(r.rec.request_uri, '/search?q=bot');
  assert.match(r.rec.user_agent, /Googlebot/);
  assert.ok(A.parseTime(r.rec.time_local) instanceof Date);
});

test('readFileRecords: NDJSON blob streams with progress', async () => {
  const lines = [
    '{"ClientIP":"1.1.1.1","Timestamp":"2026-07-25T10:00:00Z","RequestURI":"/","HttpStatus":200,"Bytes":100,"UserAgent":"GPTBot/1.0"}',
    '66.249.66.1 - - [25/Jul/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 24500 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
    '',
  ].join('\n');
  const seen = [];
  const out = await A.readFileRecords(new Blob([lines]), (f) => seen.push(f));
  assert.equal(out.records.length, 2);
  assert.equal(out.stride, 1);
  assert.equal(out.totalLines, 2);
  assert.ok(seen.length >= 1 && seen[seen.length - 1] === 1);
});

test('norm extracts path from full request-line `request` field', () => {
  const A2 = require('../js/analyzer.js');
  const r = A2.norm({ remote_addr: '1.1.1.1', request: 'GET /products/widget-pro HTTP/1.1', status: 200, user_agent: 'x' });
  assert.equal(r.uri, '/products/widget-pro');
  const r2 = A2.norm({ request_uri: '/plain-path', request: 'GET /ignored HTTP/1.1', status: 200, user_agent: 'x' });
  assert.equal(r2.uri, '/plain-path');
});

test('readFileRecords: pretty JSON array + empty file', async () => {
  const arr = await A.readFileRecords(new Blob(['[\n{"a":1},\n{"a":2}\n]']), () => {});
  assert.equal(arr.format, 'json-array');
  assert.equal(arr.records.length, 2);
  const empty = await A.readFileRecords(new Blob(['   \n']), () => {});
  assert.equal(empty.records.length, 0);
  assert.equal(empty.totalLines, 0);
});
