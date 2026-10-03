/**
 * The format rules for one entry line: `- [Name](https://link) - Description.`
 * Each rule yields a check; a line that breaks the format is judged on that alone.
 */

const ENTRY = /^- \[([^\]]+)\]\((https?:\/\/[^\s)]+)\) - (\S.*)$/;
const MAX_DESCRIPTION = 100;
const EM_DASH = String.fromCharCode(0x2014);

/**
 * Check one entry line against the format rules.
 * @param {string} line - the raw markdown line
 * @returns {Array<{ ok: boolean, text: string }>}
 */
function checkEntryLine(line) {
  const match = line.match(ENTRY);
  if (!match) {
    return [{ ok: false, text: 'format is `- [Name](https://link) - Description.`' }];
  }

  const description = match[3];
  return [
    { ok: true, text: 'format is `- [Name](https://link) - Description.`' },
    { ok: description.endsWith('.'), text: 'description ends with a period' },
    {
      ok: description.length <= MAX_DESCRIPTION,
      text: `description is ${MAX_DESCRIPTION} characters or fewer (it is ${description.length})`,
    },
    { ok: !description.includes(EM_DASH), text: 'description holds no em dash' },
  ];
}

module.exports = { checkEntryLine };
