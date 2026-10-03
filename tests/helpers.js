/**
 * Test helpers: a fetch that answers from a route table (the network
 * boundary, the only stub), and a GitHub API repository body.
 */

/**
 * Build a fetch that answers each URL from its route and records every call.
 * A route is `{ status, json }` or an Error to throw; an unknown URL throws.
 * @param {Record<string, object>} routes
 * @returns {{ fetch: Function, calls: Array<{ url: string, init: object }> }}
 */
function routeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (!(url in routes)) throw new Error(`unexpected fetch: ${url}`);
    const route = routes[url];
    if (route instanceof Error) throw route;
    const body = route.json ? JSON.stringify(route.json) : null;
    return new Response(body, { status: route.status || 200 });
  };
  return { fetch, calls };
}

/**
 * A `GET /repos/{owner}/{name}` answer.
 * @param {{ stars?: number, archived?: boolean, pushedAt?: string }} [fields]
 * @returns {{ status: number, json: object }}
 */
function repoAnswer({ stars = 500, archived = false, pushedAt = new Date().toISOString() } = {}) {
  return { status: 200, json: { stargazers_count: stars, archived, pushed_at: pushedAt } };
}

/**
 * The API URL of a repository.
 * @param {string} slug - owner/name
 * @returns {string}
 */
function api(slug) {
  return `https://api.github.com/repos/${slug}`;
}

module.exports = { routeFetch, repoAnswer, api };
