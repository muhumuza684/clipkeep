const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../store');

const fresh = () => new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'clipkeep-')));
const text = (s, t) => ({ id: s.newId(), kind: 'text', hash: 'txt:' + t, pinned: false, createdAt: Date.now(), text: t });

test('copying the same thing twice moves it to the top instead of duplicating', () => {
  const s = fresh();
  s.add(text(s, 'alpha'));
  s.add(text(s, 'beta'));
  assert.equal(s.add(text(s, 'alpha')), 'moved');
  assert.deepEqual(s.items.map((i) => i.text), ['alpha', 'beta']);
});

test('the oldest unpinned items are removed first and pinned items are kept', () => {
  const s = fresh();
  const pinned = text(s, 'keep me');
  s.add(pinned);
  s.togglePin(pinned.id);
  s.setSettings({ maxItems: 50 });
  for (let i = 0; i < 80; i++) s.add(text(s, 'item ' + i));
  assert.equal(s.items.length, 50);
  assert.ok(s.items.some((i) => i.id === pinned.id));
});

test('search needs every word and also matches digits in phone numbers', () => {
  const s = fresh();
  s.add({ ...text(s, '0772123456'), kind: 'phone', meta: { national: '0772 123456', countryName: 'Uganda', e164: '+256772123456' } });
  assert.equal(s.search('772123').length, 1);
  assert.equal(s.search('uganda').length, 1);
  assert.equal(s.search('uganda kenya').length, 0);
});

test('a deleted item can be restored', () => {
  const s = fresh();
  const it = text(s, 'oops');
  s.add(it);
  s.removeSoft(it.id);
  assert.equal(s.items.length, 0);
  assert.equal(s.restore(it.id), true);
  assert.equal(s.items.length, 1);
  s.purgeTrash();
});

test('contacts are counted once per number and can be named', () => {
  const s = fresh();
  const c = { type: 'phone', value: '+256772123456', display: '+256 772 123456', country: 'UG', countryName: 'Uganda' };
  s.noteContacts([c]);
  s.noteContacts([c]);
  assert.equal(s.contacts.length, 1);
  assert.equal(s.contacts[0].count, 2);
  s.renameContact(s.contacts[0].id, 'Sarah');
  assert.equal(s.searchContacts('sarah').length, 1);
});

test('a damaged history file is kept aside and a fresh one is started', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipkeep-'));
  fs.writeFileSync(path.join(dir, 'history.json'), '{broken');
  const s = new Store(dir);
  assert.equal(s.items.length, 0);
  assert.ok(fs.readdirSync(dir).some((n) => n.startsWith('history.corrupt')));
});
