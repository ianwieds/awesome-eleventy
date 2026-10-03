#!/usr/bin/env node
/**
 * The sweep: re-check every entry on the list (repository state and link
 * reachability; the star bar does not apply to entries already listed) and
 * print the findings as markdown whose last line is the verdict.
 * Usage: node scripts/sweep.js README.md awesome.json
 */
const fs = require('node:fs');
const { loadConfig } = require('./lib/config');
const { parseReadme } = require('./lib/readme');
const { remoteChecks } = require('./check-pr');

/**
 * Check every entry of a README.
 * @param {{ readme: string, config: object, fetch?: Function }} input
 * @returns {Promise<{ findings: object[], report: string }>}
 */
async function sweep({ readme, config, fetch }) {
  const { entries } = parseReadme(readme);
  const findings = [];

  for (const entry of entries) {
    const checks = entry.url
      ? await remoteChecks(entry.url, config, { fetch, stars: false })
      : [{ ok: false, text: 'entry has a link' }];
    const failed = checks.filter((check) => !check.ok);
    if (failed.length) findings.push({ entry, failed });
  }

  return { findings, report: renderReport(entries.length, findings) };
}

/**
 * The markdown findings; the last line is `verdict: pass` or `verdict: fail`.
 * @param {number} total - entries checked
 * @param {object[]} findings
 * @returns {string}
 */
function renderReport(total, findings) {
  if (!findings.length) return `The sweep checked ${total} entries and found nothing to review.\n\nverdict: pass\n`;

  const out = [`The sweep checked ${total} entries. ${findings.length} need a look:`, ''];
  for (const { entry, failed } of findings) {
    const label = entry.name ? `[${entry.name}](${entry.url})` : `\`${entry.line.trim()}\``;
    out.push(`- ${label} in ${entry.section}. Failed: ${failed.map((check) => check.text).join('; ')}.`);
  }
  out.push('', 'Fix or remove each entry; the next sweep closes this issue when it finds nothing.', '', 'verdict: fail');
  return `${out.join('\n')}\n`;
}

/**
 * CLI entry: read the files and print the findings.
 * @param {string[]} args - README.md awesome.json
 */
async function main(args) {
  const [readmePath, configPath] = args;
  if (!configPath) {
    console.error('usage: node scripts/sweep.js README.md awesome.json');
    process.exit(2);
  }
  const { report } = await sweep({ readme: fs.readFileSync(readmePath, 'utf8'), config: loadConfig(configPath) });
  process.stdout.write(report);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { sweep };
