const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sync } = require('../scripts/sync');

const ROOT = path.join(__dirname, '..');
const DOCS = ['README.md', 'contributing.md', '.github/pull_request_template.md'];
const FRAGMENT = /(<!-- awesome:([a-z-]+) -->)[\s\S]*?(<!-- \/awesome:\2 -->)/g;

/** Copy the real config and docs into a temp folder. */
function tempCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-sync-'));
  for (const file of ['awesome.json', ...DOCS]) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  }
  return dir;
}
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const editConfig = (dir, changes) => {
  const config = JSON.parse(read(dir, 'awesome.json'));
  fs.writeFileSync(path.join(dir, 'awesome.json'), JSON.stringify({ ...config, ...changes }));
};
const outside = (text) => text.replace(FRAGMENT, '$1$3');

test('the shipped docs already match the shipped awesome.json', () => {
  assert.deepEqual(sync(tempCopy()), []);
});

test('sync writes every value from awesome.json into its fragments', () => {
  const dir = tempCopy();
  editConfig(dir, {
    topic: 'Rust',
    repo: 'someone/awesome-rust',
    tagline: 'Crates & tools for Rust.',
    scope: 'It is about Rust itself.',
    accent: '123ABC',
    minStars: 25,
    maxInactiveMonths: 12,
    maintainer: { name: 'Jane Doe', url: 'https://example.com/jane' },
    heroAlt: 'A crab on a gear.',
  });
  assert.deepEqual(sync(dir), DOCS);

  const readme = read(dir, 'README.md');
  assert.match(readme, /<img src=".github\/assets\/hero.gif" width="100%" alt="A crab on a gear.">/);
  assert.match(readme, /<h1 align="center">Awesome Rust<\/h1>/);
  assert.match(readme, /Crates &amp; tools for Rust\./);
  assert.match(readme, /PRs-welcome-123ABC/);
  assert.match(readme, /github.com\/someone\/awesome-rust\/commits\/main/);
  assert.match(readme, /last-commit\/someone\/awesome-rust\?color=123ABC/);
  assert.match(readme, /\nMaintained by \[Jane Doe\]\(https:\/\/example.com\/jane\)\.\n/);

  const contributing = read(dir, 'contributing.md');
  assert.match(contributing, /has <!-- awesome:stars -->at least 25 stars<!-- \/awesome:stars --> when/);
  assert.match(contributing, /not marked deprecated by its owner, and with a commit in the last 12 months/);

  const template = read(dir, '.github/pull_request_template.md');
  assert.match(template, /<!-- awesome:scope -->It is about Rust itself\.<!-- \/awesome:scope -->/);
  assert.match(template, /at least 25 stars/);
});

test('sync leaves everything outside the fragments alone', () => {
  const dir = tempCopy();
  const before = DOCS.map((file) => read(dir, file));
  editConfig(dir, { topic: 'Rust', minStars: 25, maxInactiveMonths: 12 });
  sync(dir);
  assert.deepEqual(DOCS.map((file) => outside(read(dir, file))), before.map(outside));
});

test('running sync twice equals running it once', () => {
  const dir = tempCopy();
  editConfig(dir, { topic: 'Rust', accent: '123ABC', maxInactiveMonths: 6 });
  sync(dir);
  const once = DOCS.map((file) => read(dir, file));
  assert.deepEqual(sync(dir), []);
  assert.deepEqual(DOCS.map((file) => read(dir, file)), once);
});

test('maxInactiveMonths 0 words the Maintained bullet as archived or deprecated only', () => {
  const dir = tempCopy();
  editConfig(dir, { maxInactiveMonths: 12 });
  sync(dir);
  editConfig(dir, { maxInactiveMonths: 0 });
  sync(dir);
  assert.match(read(dir, 'contributing.md'), /for a repository, <!-- awesome:inactive -->not archived and not marked deprecated by its owner<!-- \/awesome:inactive -->\./);
});

test('an unknown, unclosed or missing fragment fails loudly and writes nothing', () => {
  const cases = [
    [(text) => `${text}<!-- awesome:mystery -->x<!-- /awesome:mystery -->\n`, /unknown fragment "mystery"/],
    [(text) => `${text}<!-- awesome:title -->no close\n`, /1 fragment\(s\) without a closing marker/],
    [(text) => text.replace(FRAGMENT, (m, open, name) => (name === 'maintainer' ? '' : m)), /fragments missing from every file: maintainer/],
  ];
  for (const [breakIt, message] of cases) {
    const dir = tempCopy();
    fs.writeFileSync(path.join(dir, 'README.md'), breakIt(read(dir, 'README.md')));
    editConfig(dir, { topic: 'Rust' });
    const before = DOCS.map((file) => read(dir, file));
    assert.throws(() => sync(dir), message);
    assert.deepEqual(DOCS.map((file) => read(dir, file)), before);
  }
});
