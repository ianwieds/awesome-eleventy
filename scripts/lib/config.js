/**
 * Load awesome.json, the one home of the list's defining details, and fail
 * loudly on a missing or mistyped value so no check runs against a bad bar.
 */
const fs = require('node:fs');

const STRINGS = ['topic', 'repo', 'tagline', 'scope', 'heroAlt'];
const COUNTS = ['minStars', 'maxInactiveMonths'];

/**
 * Read and validate a config file.
 * @param {string} file - path to awesome.json
 * @returns {object} the parsed config
 */
function loadConfig(file) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = [];

  for (const key of STRINGS) {
    if (typeof config[key] !== 'string' || !config[key].trim()) problems.push(`${key} must be a non-empty string`);
  }
  for (const key of COUNTS) {
    if (!Number.isInteger(config[key]) || config[key] < 0) problems.push(`${key} must be a whole number, 0 or more`);
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(config.repo)) problems.push('repo must be "owner/name"');
  if (!/^[0-9A-Fa-f]{6}$/.test(config.accent)) problems.push('accent must be a six-digit hex color without #');
  if (typeof config.maintainer?.name !== 'string' || typeof config.maintainer?.url !== 'string') {
    problems.push('maintainer must have a name and a url');
  }

  if (problems.length) throw new Error(`${file}: ${problems.join('; ')}`);
  return config;
}

module.exports = { loadConfig };
