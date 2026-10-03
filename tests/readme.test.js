const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, parseReadme, diffReadmes } = require('../scripts/lib/readme');

const README = `# Ignored

- [Before any section](https://example.com/before) - Not an entry.

## Contents

- [Libraries](#libraries)

## Libraries

- [Express](https://github.com/expressjs/express) - Web framework.
- Koa without a link

## Tools

### Formatters

- [Prettier](https://github.com/prettier/prettier) - Code formatter.

## Contributing

Contributions are welcome.
`;

test('normalizeUrl lowercases the host and drops www, the fragment and a trailing slash', () => {
  assert.equal(normalizeUrl('https://WWW.GitHub.com/Foo/Bar/#readme'), 'https://github.com/Foo/Bar');
  assert.equal(normalizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(normalizeUrl(' not a url '), 'not a url');
});

test('parseReadme reads ## and ### sections and skips Contents and lines before any section', () => {
  const { sections, entries } = parseReadme(README);
  assert.deepEqual(sections.map((s) => s.heading), ['Contents', 'Libraries', 'Tools', 'Formatters', 'Contributing']);
  assert.deepEqual(entries.map((e) => e.name), ['Express', null, 'Prettier']);
  assert.equal(entries[2].section, 'Formatters');
  assert.equal(entries[2].url, 'https://github.com/prettier/prettier');
  assert.equal(entries[0].lineNumber, 11);
});

test('parseReadme keeps a bullet without a link as an entry so the rules can judge it', () => {
  const entry = parseReadme(README).entries[1];
  assert.equal(entry.line, '- Koa without a link');
  assert.equal(entry.url, null);
  assert.equal(entry.key, null);
});

test('diffReadmes splits touched lines into new URLs and changed lines', () => {
  const head = README
    .replace('Web framework.', 'Minimal web framework.')
    .replace('- Koa without a link', '- [Koa](https://github.com/koajs/koa) - Middleware framework.');
  const { added, changed } = diffReadmes(parseReadme(README), parseReadme(head));
  assert.deepEqual(added.map((e) => e.name), ['Koa']);
  assert.deepEqual(changed.map((e) => e.name), ['Express']);
});

test('diffReadmes treats a URL differing only in www or a trailing slash as the same entry', () => {
  const head = README.replace('https://github.com/expressjs/express)', 'https://www.github.com/expressjs/express/)');
  const { added, changed } = diffReadmes(parseReadme(README), parseReadme(head));
  assert.equal(added.length, 0);
  assert.equal(changed.length, 1);
});
