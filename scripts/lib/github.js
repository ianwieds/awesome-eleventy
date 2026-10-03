/**
 * GitHub repository lookup through the REST API: stars, archived, last push.
 * `fetch` is injected so tests stand in for the network.
 */
const { normalizeUrl } = require('./readme');

const API = 'https://api.github.com';

/**
 * Read a repository URL: `github.com/<owner>/<name>` with nothing after the name.
 * @param {string} url
 * @returns {{ owner: string, name: string } | null}
 */
function parseRepo(url) {
  const match = normalizeUrl(url).match(/^https?:\/\/github\.com\/([^/?#]+)\/([^/?#]+)$/);
  return match ? { owner: match[1], name: match[2] } : null;
}

/**
 * Look up one repository. Sends `GITHUB_TOKEN` as a bearer token when set.
 * @param {{ owner: string, name: string }} repo
 * @param {{ fetch?: Function }} [options]
 * @returns {Promise<{ stars: number, archived: boolean, pushedAt: Date } | null>} null when missing
 */
async function lookupRepo({ owner, name }, { fetch = globalThis.fetch } = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'awesome-template' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`${API}/repos/${owner}/${name}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API answered ${res.status} for ${owner}/${name}`);

  const body = await res.json();
  return { stars: body.stargazers_count, archived: body.archived, pushedAt: new Date(body.pushed_at) };
}

module.exports = { parseRepo, lookupRepo };
