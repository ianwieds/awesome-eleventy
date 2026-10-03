/**
 * Reachability of a non-GitHub link. `fetch` is injected so tests stand in
 * for the network. 403 and 429 count as reachable: sites block bots that way.
 */

const TIMEOUT_MS = 10000;
const BOT_BLOCKS = new Set([403, 429]);
const USER_AGENT = 'Mozilla/5.0 (compatible; awesome-list-check)';

/**
 * Whether a status means the link is dead.
 * @param {number} status
 * @returns {boolean}
 */
function isDead(status) {
  return status === 404 || status === 410 || status >= 500;
}

/**
 * Request a link and judge whether it answers.
 * @param {string} url
 * @param {{ fetch?: Function }} [options]
 * @returns {Promise<{ reachable: boolean, detail: string, note?: string }>}
 */
async function checkLink(url, { fetch = globalThis.fetch } = {}) {
  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') return { reachable: false, detail: 'no answer within 10 seconds' };
    return { reachable: false, detail: `no answer (${error.cause?.code || error.message})` };
  }
  await res.body?.cancel();

  if (isDead(res.status)) return { reachable: false, detail: `answered ${res.status}` };
  if (BOT_BLOCKS.has(res.status)) {
    return { reachable: true, detail: `answered ${res.status}`, note: 'likely a bot block, check it by hand' };
  }
  return { reachable: true, detail: `answered ${res.status}` };
}

module.exports = { checkLink };
