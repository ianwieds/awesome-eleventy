const test = require('node:test');
const assert = require('node:assert/strict');
const { checkEntryLine } = require('../scripts/lib/rules');

const failed = (line) => checkEntryLine(line).filter((c) => !c.ok).map((c) => c.text);

test('a well-formed entry passes every rule', () => {
  const checks = checkEntryLine('- [Koa](https://github.com/koajs/koa) - Expressive middleware framework for Node.js.');
  assert.equal(checks.length, 4);
  assert.deepEqual(failed('- [Koa](https://github.com/koajs/koa) - Expressive middleware framework for Node.js.'), []);
});

test('a line that breaks the format fails on format alone', () => {
  for (const line of [
    '* [Koa](https://github.com/koajs/koa) - Middleware framework.',
    '- [Koa](https://github.com/koajs/koa): Middleware framework.',
    '- Koa: https://github.com/koajs/koa',
    '- [Koa](github.com/koajs/koa) - Middleware framework.',
    '  - [Koa](https://github.com/koajs/koa) - Middleware framework.',
  ]) {
    const checks = checkEntryLine(line);
    assert.equal(checks.length, 1, line);
    assert.match(checks[0].text, /^format is/);
    assert.equal(checks[0].ok, false, line);
  }
});

test('a description must end with a period', () => {
  assert.deepEqual(failed('- [Koa](https://koajs.com) - Middleware framework'), ['description ends with a period']);
});

test('a description may run 100 characters, not 101', () => {
  const at = `${'a'.repeat(99)}.`;
  const over = `${'a'.repeat(100)}.`;
  assert.deepEqual(failed(`- [Koa](https://koajs.com) - ${at}`), []);
  assert.deepEqual(failed(`- [Koa](https://koajs.com) - ${over}`), ['description is 100 characters or fewer (it is 101)']);
});

test('a description holds no em dash', () => {
  const dash = String.fromCharCode(0x2014);
  assert.deepEqual(failed(`- [Koa](https://koajs.com) - Middleware ${dash} small core.`), ['description holds no em dash']);
});
