const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sweep } = require('../scripts/sweep');
const { routeFetch, repoAnswer, api } = require('./helpers');

const README = fs.readFileSync(path.join(__dirname, 'fixtures', 'base.md'), 'utf8');
const LEARN = 'https://nodejs.org/en/learn';
const CONFIG = { minStars: 10, maxInactiveMonths: 0 };
const TWO_YEARS_AGO = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString();
const lastLine = (report) => report.trimEnd().split('\n').pop();

const healthy = () => ({
  [api('expressjs/express')]: repoAnswer(),
  [api('fastify/fastify')]: repoAnswer(),
  [api('prettier/prettier')]: repoAnswer(),
  [LEARN]: { status: 200 },
});

test('a healthy list has no findings', async () => {
  const { findings, report } = await sweep({ readme: README, config: CONFIG, fetch: routeFetch(healthy()).fetch });
  assert.deepEqual(findings, []);
  assert.match(report, /checked 4 entries and found nothing to review/);
  assert.equal(lastLine(report), 'verdict: pass');
});

test('archived, missing and dead entries are findings; the star bar does not apply', async () => {
  const routes = {
    ...healthy(),
    [api('expressjs/express')]: repoAnswer({ archived: true }),
    [api('fastify/fastify')]: repoAnswer({ stars: 1 }),
    [api('prettier/prettier')]: { status: 404 },
    [LEARN]: { status: 410 },
  };
  const { findings, report } = await sweep({ readme: README, config: CONFIG, fetch: routeFetch(routes).fetch });
  assert.deepEqual(findings.map((f) => f.entry.name), ['Express', 'Prettier', 'Node.js Learn']);
  assert.match(report, /- \[Express\]\(https:\/\/github.com\/expressjs\/express\) in Libraries\. Failed: repository is not archived\./);
  assert.match(report, /- \[Node.js Learn\]\(https:\/\/nodejs.org\/en\/learn\) in Guides\. Failed: link answers \(answered 410\)\./);
  assert.equal(lastLine(report), 'verdict: fail');
});

test('an inactive repository is a finding only when maxInactiveMonths is above 0', async () => {
  const routes = { ...healthy(), [api('fastify/fastify')]: repoAnswer({ pushedAt: TWO_YEARS_AGO }) };
  const strict = await sweep({ readme: README, config: { ...CONFIG, maxInactiveMonths: 12 }, fetch: routeFetch(routes).fetch });
  assert.deepEqual(strict.findings.map((f) => f.entry.name), ['Fastify']);

  const lenient = await sweep({ readme: README, config: CONFIG, fetch: routeFetch(routes).fetch });
  assert.deepEqual(lenient.findings, []);
});
