/**
 * Reachability of a non-GitHub link. `fetch` is injected so tests stand in
 * for the network. 403 and 429 count as reachable: sites block bots that way.
 * A certificate or headers-overflow error is reachable too: the server answered.
 */

const TIMEOUT_MS = 10000;
const BOT_BLOCKS = new Set([403, 429]);
const CERT_NOTE = 'the certificate did not verify, check it by hand';
const ANSWER_ERRORS = new Map([
  ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', CERT_NOTE],
  ['CERT_HAS_EXPIRED', CERT_NOTE],
  ['SELF_SIGNED_CERT_IN_CHAIN', CERT_NOTE],
  ['DEPTH_ZERO_SELF_SIGNED_CERT', CERT_NOTE],
  ['ERR_TLS_CERT_ALTNAME_INVALID', CERT_NOTE],
  ['UND_ERR_HEADERS_OVERFLOW', 'the headers ran past the size limit, check it by hand'],
]);

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
 * @param {{ fetch?: Function, userAgent: string }} options - userAgent is the list's `owner/name`, sent in the browser-shaped form sites bot-block least
 * @returns {Promise<{ reachable: boolean, detail: string, note?: string }>}
 */
async function checkLink(url, { fetch = globalThis.fetch, userAgent } = {}) {
  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${userAgent})` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') return { reachable: false, detail: 'no answer within 10 seconds' };
    const code = error.code || error.cause?.code;
    if (ANSWER_ERRORS.has(code)) return { reachable: true, detail: `answered with ${code}`, note: ANSWER_ERRORS.get(code) };
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
