const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

test('sampleTargetRecords scales with size', () => {
  const small = A.sampleTargetRecords(1);
  const big = A.sampleTargetRecords(500);
  assert.ok(small >= 100);
  assert.ok(big > small * 100, '500MB needs 100x+ records of 1MB');
  // 500MB must stay streamable: batches of 20k => each chunk string ~5MB, far under string limits
  assert.ok(big / 20000 < 2000, 'batch count sane');
});

test('genSampleStream yields valid NDJSON in order, no giant string', async () => {
  const chunks = [];
  let doneTotal = 0;
  await new Promise((resolve, reject) => {
    A.genSampleStream(1, (chunk, doneCount, total) => {
      assert.ok(chunk.length < 32 * 1024 * 1024, 'single chunk must stay small');
      chunks.push(chunk);
    }, (total) => { doneTotal = total; resolve(); }, reject);
  });
  const lines = chunks.join('').split('\n').filter(Boolean);
  assert.equal(lines.length, doneTotal);
  assert.equal(lines.length, A.sampleTargetRecords(1));
  for (const ln of lines.slice(0, 50)) {
    const r = JSON.parse(ln); // throws if malformed
    assert.ok(r.ClientIP && r.Timestamp && r.RequestURI !== undefined && r.UserAgent);
  }
  const uas = lines.map((ln) => JSON.parse(ln).UserAgent).join('\n');
  assert.ok(/GPTBot|CCBot|Bytespider/.test(uas), 'bots present');
  assert.ok(/Chrome\/126|Version\/17\.5/.test(uas), 'humans present');
});
