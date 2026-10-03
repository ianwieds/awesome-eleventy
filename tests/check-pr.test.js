const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkPr } = require('../scripts/check-pr');
const { routeFetch, repoAnswer, api } = require('./helpers');

const FIXTURES = path.join(__dirname, 'fixtures');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-pr.js');
const CONFIG = {
  topic: 'Fixture',
  repo: 'someone/awesome-fixture',
  tagline: 'A fixture list.',
  scope: 'It is about the fixture.',
  accent: 'FFA000',
  minStars: 10,
  maxInactiveMonths: 0,
  maintainer: { name: 'Someone', url: 'https://example.com' },
  heroAlt: 'A fixture.',
};
const KOA = api('koajs/koa');
const REFERENCE = 'https://nodejs.org/docs/latest/api/';
const TWO_YEARS_AGO = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString();

const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const lastLine = (report) => report.trimEnd().split('\n').pop();

/** Check a head (a fixture name or README text) against base.md, answering fetches from routes. */
function run(head, routes = {}, config = CONFIG) {
  const text = head.endsWith('.md') ? read(head) : head;
  return checkPr({ base: read('base.md'), head: text, config, fetch: routeFetch(routes).fetch });
}

/** Assert a fail verdict whose report holds a failing check matching pattern. */
function assertFails({ pass, report }, pattern) {
  assert.equal(pass, false);
  assert.ok(report.split('\n').some((line) => line.startsWith('- fail: ') && pattern.test(line)), report);
  assert.match(report, /a fixed pull request is welcome/);
  assert.equal(lastLine(report), 'verdict: fail');
}

test('one well-formed new entry above the bar passes, and the report states the bar', async () => {
  const { pass, report } = await run('pass.md', { [KOA]: repoAnswer({ stars: 500 }) });
  assert.equal(pass, true, report);
  assert.match(report, /### New: \[Koa\]\(https:\/\/github.com\/koajs\/koa\) in Libraries/);
  assert.match(report, /- pass: at least 10 stars \(it has 500\)/);
  assert.match(report, /The bar: A GitHub repository needs at least 10 stars/);
  assert.doesNotMatch(report, /What to fix/);
  assert.equal(lastLine(report), 'verdict: pass');
});

test('more than one new entry fails', async () => {
  const result = await run('two-new.md', { [KOA]: repoAnswer(), [api('honojs/hono')]: repoAnswer() });
  assertFails(result, /one new entry per pull request \(found 2\)/);
});

test('a URL already on the list fails, even spelled with www and a trailing slash', async () => {
  assertFails(await run('duplicate.md'), /link is on the list once \(found 2\)/);
});

test('a touched section out of alphabetical order fails', async () => {
  const result = await run('order.md', { [api('axios/axios')]: repoAnswer() });
  assertFails(result, /section "Libraries" is in alphabetical order by name \("Axios" belongs before "Fastify"\)/);
});

test('a line that breaks the format fails without touching the network', async () => {
  assertFails(await run('format.md'), /format is `- \[Name\]\(https:\/\/link\) - Description.`/);
});

test('a description without a final period fails', async () => {
  assertFails(await run('period.md', { [KOA]: repoAnswer() }), /description ends with a period/);
});

test('a description over 100 characters fails', async () => {
  assertFails(await run('long.md', { [KOA]: repoAnswer() }), /description is 100 characters or fewer \(it is 1\d\d\)/);
});

test('a description holding an em dash fails', async () => {
  const head = read('pass.md').replace('Expressive middleware', `Expressive ${String.fromCharCode(0x2014)} middleware`);
  assertFails(await run(head, { [KOA]: repoAnswer() }), /description holds no em dash/);
});

test('a repository below the star bar fails', async () => {
  assertFails(await run('pass.md', { [KOA]: repoAnswer({ stars: 3 }) }), /at least 10 stars \(it has 3\)/);
  assertFails(await run('pass.md', { [KOA]: repoAnswer({ stars: 24 }) }, { ...CONFIG, minStars: 25 }), /at least 25 stars \(it has 24\)/);
  assert.equal((await run('pass.md', { [KOA]: repoAnswer({ stars: 25 }) }, { ...CONFIG, minStars: 25 })).pass, true);
});

test('an archived repository fails', async () => {
  assertFails(await run('pass.md', { [KOA]: repoAnswer({ archived: true }) }), /repository is not archived/);
});

test('a missing repository fails', async () => {
  assertFails(await run('pass.md', { [KOA]: { status: 404 } }), /repository koajs\/koa exists/);
});

test('an old last push fails only when maxInactiveMonths is above 0', async () => {
  const old = { [KOA]: repoAnswer({ pushedAt: TWO_YEARS_AGO }) };
  assertFails(await run('pass.md', old, { ...CONFIG, maxInactiveMonths: 12 }), /a push in the last 12 months/);

  const { pass, report } = await run('pass.md', old);
  assert.equal(pass, true, report);
  assert.doesNotMatch(report, /a push in the last/);
});

test('a dead or silent non-GitHub link fails', async () => {
  for (const route of [{ status: 404 }, { status: 410 }, { status: 503 }, new DOMException('timeout', 'TimeoutError')]) {
    assertFails(await run('link.md', { [REFERENCE]: route }), /link answers/);
  }
});

test('a 403 or 429 link counts as reachable and is noted', async () => {
  for (const status of [403, 429]) {
    const { pass, report } = await run('link.md', { [REFERENCE]: { status } });
    assert.equal(pass, true, report);
    assert.match(report, new RegExp(`- pass: link answers \\(answered ${status}; likely a bot block`));
  }
});

test('a GitHub product page takes the plain link check, not a repository lookup', async () => {
  const copilot = 'https://github.com/features/copilot';
  const { pass, report } = await run(read('pass.md').replace('https://github.com/koajs/koa', copilot), { [copilot]: { status: 200 } });
  assert.equal(pass, true, report);
  assert.match(report, /- pass: link answers \(answered 200\)/);
});

test('every request names the list from awesome.json as its User-Agent', async () => {
  const { fetch, calls } = routeFetch({ [KOA]: repoAnswer(), [REFERENCE]: { status: 200 } });
  await checkPr({ base: read('base.md'), head: read('pass.md'), config: CONFIG, fetch });
  await checkPr({ base: read('base.md'), head: read('link.md'), config: CONFIG, fetch });
  assert.deepEqual(calls.map((call) => call.url), [KOA, REFERENCE]);
  assert.equal(calls[0].init.headers['User-Agent'], 'someone/awesome-fixture');
  assert.equal(calls[1].init.headers['User-Agent'], 'Mozilla/5.0 (compatible; someone/awesome-fixture)');
});

test('a changed description is checked by the rules but not re-checked on the network', async () => {
  const { pass, report } = await run('changed.md');
  assert.equal(pass, true, report);
  assert.match(report, /### Changed: \[Fastify\]/);
});

test('a pull request that touches no entry passes', async () => {
  const { pass, report } = await run('base.md');
  assert.equal(pass, true);
  assert.match(report, /No entries were added or changed\./);
});

test('the CLI exits 1 on fail and 0 on pass, the verdict on the last line', () => {
  const config = path.join(__dirname, '..', 'awesome.json');
  const cli = (head) => spawnSync(process.execPath, [SCRIPT, path.join(FIXTURES, 'base.md'), path.join(FIXTURES, head), config], { encoding: 'utf8' });

  const fail = cli('format.md');
  assert.equal(fail.status, 1, fail.stderr);
  assert.equal(lastLine(fail.stdout), 'verdict: fail');

  const pass = cli('base.md');
  assert.equal(pass.status, 0, pass.stderr);
  assert.equal(lastLine(pass.stdout), 'verdict: pass');
});
