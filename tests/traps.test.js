const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

function rec(uri) {
  return { ip: '1.2.3.4', tstamp: new Date(), method: 'GET', uri, status: 200, ua: 'x', bytes: 1000, rt: null, referer: '', tls: '', cache: '' };
}

test('ecomm traps detected: gclid/fbclid/currency/filter/page', () => {
  const traps = A.detectTraps([
    rec('/p?gclid=abc'), rec('/p?fbclid=x'), rec('/p?currency=USD'),
    rec('/filter/red'), rec('/page/99'), rec('/p?srsltid=123'),
  ]);
  assert.ok(traps['Ad/Attribution Click IDs'], 'gclid/fbclid trap');
  assert.ok(traps['Currency/Locale Variants'], 'currency trap');
  assert.ok(traps['Filter Path Segments'], 'filter/page trap');
});

test('security: .git/HEAD, .aws/credentials, actuator flagged', () => {
  const s = A.security([
    rec('/.git/HEAD'), rec('/.aws/credentials'), rec('/actuator/health'), rec('/'),
  ]);
  const types = s.threats.map((t) => t.type);
  assert.ok(types.includes('Git/Cloud Credential Probe'));
  assert.ok(types.includes('Actuator/Health Probe'));
});

test('robots.txt splits training Disallow vs search Allow', () => {
  const txt = A.genRobotsTxt();
  assert.match(txt, /User-agent: GPTBot\nDisallow: \//);
  assert.match(txt, /User-agent: Google-Extended\nDisallow: \//);
  assert.match(txt, /User-agent: DeepSeekBot\nDisallow: \//);
  assert.match(txt, /User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(txt, /User-agent: Claude-SearchBot\nAllow: \//);
  assert.match(txt, /most-specific group wins/, 'explains * Allow does not override Disallows');
});

test('2026 traps: cart/variant, _next/data, price sliders', () => {
  const traps = A.detectTraps([
    rec('/shop?add-to-cart=123'), rec('/p?variant=456'), rec('/_next/data/abc/home.json'),
    rec('/shop?price_min=50&price_max=200'),
  ]);
  assert.ok(traps['Cart / Variant Combos (ecomm)']);
  assert.ok(traps['Next.js Data Routes']);
  assert.ok(traps['Price-Slider Facets']);
});

test('2026 threats: well-known/svn, vendor, spring/env, graphql, metadata', () => {
  const s = A.security([
    rec('/.well-known/security.txt'), rec('/.svn/entries'), rec('/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php'),
    rec('/actuator/env'), rec('/graphql/console'), rec('/latest/meta-data/iam/security-credentials/'),
  ]);
  const types = s.threats.map((t) => t.type);
  assert.ok(types.includes('Well-Known / VCS Probe'));
  assert.ok(types.includes('Exposed Env / Vendor Probe'));
  assert.ok(types.includes('Spring / Env Endpoint Probe'));
  assert.ok(types.includes('Cloud Metadata Probe (SSRF)'));
});
