#!/usr/bin/env node
/**
 * The pull request verdict: compare the base and head READMEs, check every new
 * or changed entry, and print a markdown report whose last line is the verdict.
 * Usage: node scripts/check-pr.js base.md head.md awesome.json (exit 0 pass, 1 fail)
 */
const fs = require('node:fs');
const { loadConfig } = require('./lib/config');
const { parseReadme, diffReadmes } = require('./lib/readme');
const { checkEntryLine } = require('./lib/rules');
const { parseRepo, lookupRepo } = require('./lib/github');
const { checkLink } = require('./lib/links');

/**
 * The date a number of months before now.
 * @param {number} months
 * @returns {Date}
 */
function monthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

/**
 * Check an entry's URL against the world: repository state for a GitHub
 * repository, reachability for any other link.
 * @param {string} url
 * @param {object} config - awesome.json
 * @param {{ fetch?: Function, stars: boolean }} options - stars applies the star bar
 * @returns {Promise<Array<{ ok: boolean, text: string }>>}
 */
async function remoteChecks(url, config, { fetch, stars }) {
  const repo = parseRepo(url);
  if (!repo) {
    const link = await checkLink(url, { fetch });
    const note = link.note ? `; ${link.note}` : '';
    return [{ ok: link.reachable, text: `link answers (${link.detail}${note})` }];
  }

  const found = await lookupRepo(repo, { fetch });
  if (!found) return [{ ok: false, text: `repository ${repo.owner}/${repo.name} exists` }];

  const checks = [
    { ok: true, text: `repository ${repo.owner}/${repo.name} exists` },
    { ok: !found.archived, text: 'repository is not archived' },
  ];
  if (stars) {
    checks.push({ ok: found.stars >= config.minStars, text: `at least ${config.minStars} stars (it has ${found.stars})` });
  }
  if (config.maxInactiveMonths > 0) {
    checks.push({
      ok: found.pushedAt >= monthsAgo(config.maxInactiveMonths),
      text: `a push in the last ${config.maxInactiveMonths} months (last push ${found.pushedAt.toISOString().slice(0, 10)})`,
    });
  }
  return checks;
}

/**
 * Whether a section's entries are in case-insensitive alphabetical order.
 * @param {{ heading: string, entries: object[] }} section
 * @returns {{ ok: boolean, text: string }}
 */
function orderCheck(section) {
  const names = section.entries.map((entry) => entry.name).filter((name) => name !== null);
  const text = `section "${section.heading}" is in alphabetical order by name`;
  for (let i = 1; i < names.length; i++) {
    if (names[i - 1].toLowerCase() > names[i].toLowerCase()) {
      return { ok: false, text: `${text} ("${names[i]}" belongs before "${names[i - 1]}")` };
    }
  }
  return { ok: true, text };
}

/**
 * The bar the check applies, in one paragraph.
 * @param {object} config
 * @returns {string}
 */
function describeBar(config) {
  const inactive = config.maxInactiveMonths > 0
    ? `and must have a push in the last ${config.maxInactiveMonths} months`
    : 'and has no inactivity limit';
  return [
    `A GitHub repository needs at least ${config.minStars} stars, must exist and not be archived, ${inactive}.`,
    'Any other link fails on 404, 410, a 5xx or no answer within 10 seconds; 403 and 429 count as reachable.',
    'A description ends with a period, runs 100 characters or fewer, and holds no em dash.',
  ].join(' ');
}

/**
 * Check every new or changed entry of a pull request.
 * @param {{ base: string, head: string, config: object, fetch?: Function }} input - README texts and config
 * @returns {Promise<{ pass: boolean, report: string }>}
 */
async function checkPr({ base, head, config, fetch }) {
  const headList = parseReadme(head);
  const { added, changed } = diffReadmes(parseReadme(base), headList);
  const results = [];

  for (const entry of [...added, ...changed]) {
    const isNew = added.includes(entry);
    const checks = checkEntryLine(entry.line);
    const formatOk = checks[0].ok;
    if (entry.key) {
      const copies = headList.entries.filter((other) => other.key === entry.key).length;
      checks.push({ ok: copies === 1, text: `link is on the list once (found ${copies})` });
    }
    checks.push(orderCheck(headList.sections.find((section) => section.entries.includes(entry))));
    if (isNew && formatOk) checks.push(...await remoteChecks(entry.url, config, { fetch, stars: true }));
    results.push({ entry, isNew, checks });
  }

  const prChecks = [{ ok: added.length <= 1, text: `one new entry per pull request (found ${added.length})` }];
  const failures = [
    ...results.flatMap(({ entry, checks }) => checks.filter((c) => !c.ok).map((c) => `${entry.name || entry.line.trim()}: ${c.text}`)),
    ...prChecks.filter((c) => !c.ok).map((c) => c.text),
  ];
  const pass = failures.length === 0;
  return { pass, report: renderReport({ config, results, prChecks, failures, pass }) };
}

/**
 * The markdown report; its last line is `verdict: pass` or `verdict: fail`.
 * @param {object} parts
 * @returns {string}
 */
function renderReport({ config, results, prChecks, failures, pass }) {
  const line = (c) => `- ${c.ok ? 'pass' : 'fail'}: ${c.text}`;
  const out = ['## Pull request check', '', `The bar: ${describeBar(config)}`, ''];

  if (!results.length) out.push('No entries were added or changed.', '');
  for (const { entry, isNew, checks } of results) {
    const label = entry.name ? `[${entry.name}](${entry.url})` : `\`${entry.line.trim()}\``;
    out.push(`### ${isNew ? 'New' : 'Changed'}: ${label} in ${entry.section}`, '', ...checks.map(line), '');
  }
  out.push('### The pull request', '', ...prChecks.map(line), '');

  if (!pass) {
    out.push('### What to fix', '', ...failures.map((f) => `- ${f}`), '');
    out.push('Fix the items above and open a new pull request; a fixed pull request is welcome.', '');
  }
  out.push(`verdict: ${pass ? 'pass' : 'fail'}`);
  return `${out.join('\n')}\n`;
}

/**
 * CLI entry: read the files, print the report, exit 0 on pass and 1 on fail.
 * @param {string[]} args - base.md head.md awesome.json
 */
async function main(args) {
  const [basePath, headPath, configPath] = args;
  if (!configPath) {
    console.error('usage: node scripts/check-pr.js base.md head.md awesome.json');
    process.exit(2);
  }
  const { pass, report } = await checkPr({
    base: fs.readFileSync(basePath, 'utf8'),
    head: fs.readFileSync(headPath, 'utf8'),
    config: loadConfig(configPath),
  });
  process.stdout.write(report);
  process.exitCode = pass ? 0 : 1;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { checkPr, remoteChecks };
