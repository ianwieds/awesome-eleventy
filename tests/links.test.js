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

test('every request carries a timeout signal and follows redirects', async () => {
  const { fetch, calls } = routeFetch({ [LINK]: { status: 200 } });
  await checkLink(LINK, { fetch });
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(calls[0].init.redirect, 'follow');
});
