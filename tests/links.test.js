const test = require('node:test');
const assert = require('node:assert/strict');
const { checkLink } = require('../scripts/lib/links');
const { routeFetch } = require('./helpers');

const LINK = 'https://nodejs.org/en/learn';
const check = (route) => checkLink(LINK, { fetch: routeFetch({ [LINK]: route }).fetch });

test('a link that answers 200 is reachable', async () => {
  assert.deepEqual(await check({ status: 200 }), { reachable: true, detail: 'answered 200' });
});

test('404, 410 and a 5xx are dead', async () => {
  for (const status of [404, 410, 500, 503]) {
    assert.deepEqual(await check({ status }), { reachable: false, detail: `answered ${status}` });
  }
});

test('403 and 429 count as reachable, with a note', async () => {
  for (const status of [403, 429]) {
    const result = await check({ status });
    assert.equal(result.reachable, true);
    assert.match(result.note, /bot block/);
  }
});

test('no answer within 10 seconds is dead', async () => {
  const result = await check(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  assert.deepEqual(result, { reachable: false, detail: 'no answer within 10 seconds' });
});

test('a network failure is dead and names its cause', async () => {
  const error = new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  assert.deepEqual(await check(error), { reachable: false, detail: 'no answer (ENOTFOUND)' });
});

test('a certificate or headers-overflow error is an answer: reachable, with a note', async () => {
  const codes = [
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UND_ERR_HEADERS_OVERFLOW',
  ];
  for (const code of codes) {
    const viaCause = await check(new TypeError('fetch failed', { cause: { code } }));
    const direct = await check(Object.assign(new Error('fetch failed'), { code }));
    for (const result of [viaCause, direct]) {
      assert.equal(result.reachable, true, code);
      assert.match(result.detail, new RegExp(code));
      assert.match(result.note, /check it by hand/);
    }
  }
});

test('an answer error is matched on its code, never on the message text', async () => {
  const result = await check(new TypeError('CERT_HAS_EXPIRED', { cause: { code: 'ECONNRESET' } }));
  assert.deepEqual(result, { reachable: false, detail: 'no answer (ECONNRESET)' });
});

test('every request carries a timeout signal and follows redirects', async () => {
  const { fetch, calls } = routeFetch({ [LINK]: { status: 200 } });
  await checkLink(LINK, { fetch });
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(calls[0].init.redirect, 'follow');
});
