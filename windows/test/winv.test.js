const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRegQuery, hasLetter, addLetter, removeLetter } = require('../winv');

test('reads the letters from reg query output', () => {
  const out = '\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced\r\n    DisabledHotkeys    REG_SZ    VX\r\n';
  assert.equal(parseRegQuery(out), 'VX');
  assert.equal(parseRegQuery(''), '');
  assert.equal(parseRegQuery('ERROR: The system was unable to find the specified registry key or value.'), '');
});

test('adding V keeps the letters the user already had', () => {
  assert.equal(addLetter('', 'V'), 'V');
  assert.equal(addLetter('X', 'V'), 'XV');
  assert.equal(addLetter('XV', 'V'), 'XV');
  assert.equal(hasLetter('xv', 'V'), true);
});

test('removing V leaves every other letter alone', () => {
  assert.equal(removeLetter('XV', 'V'), 'X');
  assert.equal(removeLetter('V', 'V'), '');
  assert.equal(removeLetter('X', 'V'), 'X');
});
