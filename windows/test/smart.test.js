// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, extractContacts, parseColor } = require('../smart');

test('a Ugandan number typed locally is read as Uganda', () => {
  const r = classify('0772123456', 'UG');
  assert.equal(r.kind, 'phone');
  assert.equal(r.meta.country, 'UG');
  assert.equal(r.meta.e164, '+256772123456');
});

test('a Kenyan number with a country code is read as Kenya', () => {
  const r = classify('+254 712 345678', 'UG');
  assert.equal(r.kind, 'phone');
  assert.equal(r.meta.country, 'KE');
});

test('plain digits that are not a phone number stay text', () => {
  assert.equal(classify('1234567890', 'UG').kind, 'text');
  assert.equal(classify('2024-01-31', 'UG').kind, 'text');
});

test('emails are detected and lower-cased', () => {
  const r = classify('Bright@Brytma.Tech', 'UG');
  assert.equal(r.kind, 'email');
  assert.equal(r.meta.address, 'bright@brytma.tech');
  assert.equal(r.meta.domain, 'brytma.tech');
});

test('links are detected', () => {
  assert.equal(classify('https://example.com/page', 'UG').kind, 'link');
  assert.equal(classify('www.example.com', 'UG').kind, 'link');
});

test('colours in hex, rgb and hsl are detected and converted', () => {
  const hex = classify('#378ADD', 'UG');
  assert.equal(hex.kind, 'color');
  assert.equal(hex.meta.hex, '#378ADD');
  assert.equal(hex.meta.rgb, 'rgb(55, 138, 221)');
  assert.equal(parseColor('rgb(55, 138, 221)').hex, '#378ADD');
  assert.equal(parseColor('#FFF').hex, '#FFFFFF');
  assert.equal(parseColor('rgb(300, 0, 0)'), null);
});

test('words that look like hex without a # are not colours', () => {
  assert.equal(classify('fade', 'UG').kind, 'text');
  assert.equal(classify('deadbeef', 'UG').kind, 'text');
});

test('contacts are found inside longer text, one per number', () => {
  const found = extractContacts('Sarah +44 20 7946 0958, +256 700 000 111, +254 712 345678, 0772 123456, a@b.co', 'UG');
  const phones = found.filter((c) => c.type === 'phone').map((c) => c.value);
  assert.deepEqual(phones.sort(), ['+256700000111', '+256772123456', '+254712345678', '+442079460958'].sort());
  assert.equal(found.filter((c) => c.type === 'email').length, 1);
});

test('a comma between numbers is not read as an extension', () => {
  const found = extractContacts('+254 712 345678, 0772 123456', 'UG');
  assert.equal(found.length, 2);
  assert.ok(found.every((c) => !/ext/i.test(c.display)));
});
