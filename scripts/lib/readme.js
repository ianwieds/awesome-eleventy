/**
 * Parse an awesome-list README into sections and entries, and diff two
 * READMEs by entry URL. Parsing is lenient: any bullet under a section is an
 * entry, so a malformed line is still seen and judged by the format rules.
 */

const HEADING = /^(#{2,3})\s+(.+?)\s*$/;
const BULLET = /^\s*[-*+]\s/;
const LINK = /\[([^\]]*)\]\(([^)\s]*)\)/;
const SKIPPED_SECTIONS = new Set(['contents']);

/**
 * Normalize a URL for comparison: lowercase host, no `www.`, no fragment,
 * no trailing slash. A string that is not a URL comes back trimmed.
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return url.trim();
  }
  const host = parsed.host.toLowerCase().replace(/^www\./, '');
  return `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}`.replace(/\/+$/, '');
}

/**
 * Split a README into its `##`/`###` sections and the entries under each.
 * @param {string} markdown
 * @returns {{ sections: Array<{ heading: string, entries: object[] }>, entries: object[] }}
 */
function parseReadme(markdown) {
  const sections = [];
  const entries = [];
  let section = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const heading = line.match(HEADING);
    if (heading) {
      section = { heading: heading[2], entries: [] };
      sections.push(section);
      return;
    }
    if (!section || SKIPPED_SECTIONS.has(section.heading.toLowerCase()) || !BULLET.test(line)) return;

    const link = line.match(LINK);
    const entry = {
      line,
      lineNumber: index + 1,
      section: section.heading,
      name: link ? link[1] : null,
      url: link ? link[2] : null,
      key: link ? normalizeUrl(link[2]) : null,
    };
    section.entries.push(entry);
    entries.push(entry);
  });

  return { sections, entries };
}

/**
 * Diff two parsed READMEs. A touched entry is a head line not found among the
 * base lines; it is new when its normalized URL is not in base, else changed.
 * @param {object} base - parseReadme result
 * @param {object} head - parseReadme result
 * @returns {{ added: object[], changed: object[] }}
 */
function diffReadmes(base, head) {
  const baseLines = new Set(base.entries.map((entry) => entry.line));
  const baseKeys = new Set(base.entries.map((entry) => entry.key).filter(Boolean));
  const touched = head.entries.filter((entry) => !baseLines.has(entry.line));

  return {
    added: touched.filter((entry) => !entry.key || !baseKeys.has(entry.key)),
    changed: touched.filter((entry) => entry.key && baseKeys.has(entry.key)),
  };
}

module.exports = { normalizeUrl, parseReadme, diffReadmes };
