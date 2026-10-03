const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRepo, lookupRepo } = require('../scripts/lib/github');
const { routeFetch, repoAnswer, api } = require('./helpers');

/**
 * Run fn with GITHUB_TOKEN set to value (undefined unsets it), then restore it.
 */
async function withToken(value, fn) {
  const saved = process.env.GITHUB_TOKEN;
  if (value === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = value;
  try {
    await fn();
  } finally {
    if (saved === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = saved;
  }
}

test('parseRepo reads github.com/<owner>/<name> with nothing after the name', () => {
  assert.deepEqual(parseRepo('https://github.com/koajs/koa'), { owner: 'koajs', name: 'koa' });
  assert.deepEqual(parseRepo('https://www.GitHub.com/koajs/koa/#readme'), { owner: 'koajs', name: 'koa' });
  assert.equal(parseRepo('https://github.com/koajs'), null);
  assert.equal(parseRepo('https://github.com/koajs/koa/tree/master/docs'), null);
  assert.equal(parseRepo('https://github.com/koajs/koa?tab=readme'), null);
  assert.equal(parseRepo('https://koajs.com'), null);
});

test('lookupRepo reads stars, archived and the last push from the REST API', async () => {
  const { fetch, calls } = routeFetch({ [api('koajs/koa')]: repoAnswer({ stars: 35000, archived: true, pushedAt: '2026-01-02T03:04:05Z' }) });
  const repo = await lookupRepo({ owner: 'koajs', name: 'koa' }, { fetch });
  assert.deepEqual(repo, { stars: 35000, archived: true, pushedAt: new Date('2026-01-02T03:04:05Z') });
  assert.equal(calls[0].url, 'https://api.github.com/repos/koajs/koa');
});

test('lookupRepo sends GITHUB_TOKEN as a bearer token when it is set', async () => {
  const { fetch, calls } = routeFetch({ [api('koajs/koa')]: repoAnswer() });
  await withToken('secret-token', () => lookupRepo({ owner: 'koajs', name: 'koa' }, { fetch }));
  await withToken(undefined, () => lookupRepo({ owner: 'koajs', name: 'koa' }, { fetch }));
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.equal(calls[1].init.headers.Authorization, undefined);
});

test('lookupRepo answers null for a missing repository', async () => {
  const { fetch } = routeFetch({ [api('nobody/nothing')]: { status: 404 } });
  assert.equal(await lookupRepo({ owner: 'nobody', name: 'nothing' }, { fetch }), null);
});

test('lookupRepo throws on any other API failure instead of guessing', async () => {
  const { fetch } = routeFetch({ [api('koajs/koa')]: { status: 403 } });
  await assert.rejects(lookupRepo({ owner: 'koajs', name: 'koa' }, { fetch }), /GitHub API answered 403 for koajs\/koa/);
});
