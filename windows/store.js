// History + settings, saved as one JSON index plus a folder of copied files.
// Everything stays on this PC. Writes are atomic so a crash never corrupts the history.
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  paused: false,
  maxItems: 2000,
  maxFileMB: 100,
  hotkey: 'Control+Alt+V',
  startWithWindows: false,
  ignorePatterns: [],
  homeCountry: 'UG',
  welcomed: false,
  closeToTray: true,
  trayHintShown: false,
  theme: 'system',
  accent: null,
  window: null,
};

const DEFAULT_PALETTES = [
  {
    id: 'brand',
    name: 'Bryt Ma Tech',
    colors: ['#042C53', '#378ADD', '#639922', '#BA7517', '#D3D1C7'],
  },
];

class Store {
  constructor(dir) {
    this.dir = dir;
    this.filesDir = path.join(dir, 'files');
    this.indexPath = path.join(dir, 'history.json');
    fs.mkdirSync(this.filesDir, { recursive: true });
    this.items = [];
    this.contacts = [];
    this.palettes = DEFAULT_PALETTES.map((p) => ({ ...p, colors: [...p.colors] }));
    this.emoji = { recent: [], counts: {}, favorites: [], tone: 0 };
    this.settings = { ...DEFAULT_SETTINGS };
    this._timer = null;
    this.trash = new Map();
    this._load();
  }

  _load() {
    if (!fs.existsSync(this.indexPath)) return;
    try {
      const saved = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
      this.items = Array.isArray(saved.items) ? saved.items : [];
      this.contacts = Array.isArray(saved.contacts) ? saved.contacts : [];
      if (Array.isArray(saved.palettes) && saved.palettes.length) this.palettes = saved.palettes;
      this.emoji = { ...this.emoji, ...(saved.emoji || {}) };
      this.settings = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
    } catch {
      // Keep the unreadable file instead of overwriting it, then start fresh.
      try {
        fs.renameSync(this.indexPath, path.join(this.dir, `history.corrupt-${Date.now()}.json`));
      } catch {}
    }
  }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 400);
  }

  flush() {
    clearTimeout(this._timer);
    const tmp = this.indexPath + '.tmp';
    try {
      fs.writeFileSync(
        tmp,
        JSON.stringify({
          items: this.items,
          contacts: this.contacts,
          palettes: this.palettes,
          emoji: this.emoji,
          settings: this.settings,
        })
      );
      fs.renameSync(tmp, this.indexPath);
    } catch (e) {
      console.error('Could not save history:', e.message);
    }
  }

  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  find(id) {
    return this.items.find((i) => i.id === id);
  }

  findByHash(hash) {
    return this.items.find((i) => i.hash === hash);
  }

  // Adds an item, or moves an identical one to the top. Returns 'added' | 'moved'.
  add(item) {
    const existing = this.findByHash(item.hash);
    if (existing) {
      if (item.file && item.file.stored && existing.file && item.file.path !== existing.file.path) {
        this._deleteStored(item);
      }
      existing.createdAt = Date.now();
      this.items = [existing, ...this.items.filter((i) => i !== existing)];
      this.save();
      return 'moved';
    }
    this.items.unshift(item);
    this._prune();
    this.save();
    return 'added';
  }

  touch(id) {
    const it = this.find(id);
    if (!it) return;
    it.createdAt = Date.now();
    this.items = [it, ...this.items.filter((i) => i !== it)];
    this.save();
  }

  togglePin(id) {
    const it = this.find(id);
    if (it) {
      it.pinned = !it.pinned;
      this.save();
    }
  }

  remove(id) {
    const it = this.find(id);
    if (!it) return;
    this._deleteStored(it);
    this.items = this.items.filter((i) => i !== it);
    this.save();
  }

  // Delete that can be undone for a few seconds. The file on disk is removed only afterwards.
  removeSoft(id) {
    const it = this.find(id);
    if (!it) return false;
    this.items = this.items.filter((i) => i !== it);
    const timer = setTimeout(() => {
      this._deleteStored(it);
      this.trash.delete(id);
    }, 15000);
    this.trash.set(id, { it, timer });
    this.save();
    return true;
  }

  restore(id) {
    const t = this.trash.get(id);
    if (!t) return false;
    clearTimeout(t.timer);
    this.trash.delete(id);
    this.items.push(t.it);
    this.items.sort((a, b) => b.createdAt - a.createdAt);
    this.save();
    return true;
  }

  purgeTrash() {
    for (const [id, t] of this.trash) {
      clearTimeout(t.timer);
      this._deleteStored(t.it);
    }
    this.trash.clear();
  }

  clear(keepPinned = true) {
    const gone = this.items.filter((i) => !(keepPinned && i.pinned));
    gone.forEach((i) => this._deleteStored(i));
    this.items = this.items.filter((i) => keepPinned && i.pinned);
    this.save();
  }

  setSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this._prune();
    this.save();
  }

  _deleteStored(item) {
    if (item.file && item.file.stored) {
      try {
        fs.unlinkSync(item.file.path);
      } catch {}
    }
  }

  _prune() {
    const max = Math.max(10, this.settings.maxItems);
    if (this.items.length <= max) return;
    const pinned = this.items.filter((i) => i.pinned).length;
    let room = Math.max(max - pinned, 0);
    const keep = [];
    for (const it of this.items) {
      if (it.pinned) keep.push(it);
      else if (room > 0) {
        keep.push(it);
        room--;
      } else this._deleteStored(it);
    }
    this.items = keep;
  }

  // Newest first, pinned on top. Every word in the query must appear.
  search(query = '', filter = 'all', limit = 300) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const it of this.items) {
      if (filter === 'media' && it.kind !== 'audio' && it.kind !== 'video') continue;
      if (filter !== 'all' && filter !== 'media' && it.kind !== filter) continue;
      if (words.length) {
        let hay = ((it.text || '') + ' ' + (it.file ? it.file.name : '')).toLowerCase();
        if (it.meta) {
          hay += ' ' + Object.values(it.meta).filter((v) => typeof v === 'string').join(' ').toLowerCase();
        }
        const digits = hay.replace(/\D/g, '');
        if (!words.every((w) => hay.includes(w) || (/^\d+$/.test(w) && digits.includes(w)))) continue;
      }
      out.push(it);
    }
    const pinned = out.filter((i) => i.pinned);
    const rest = out.filter((i) => !i.pinned);
    return [...pinned, ...rest].slice(0, limit);
  }
}

// ---------- contacts, palettes, emoji ----------

Store.prototype.noteContacts = function noteContacts(found) {
  if (!found || !found.length) return;
  const now = Date.now();
  for (const f of found) {
    const key = f.type + ':' + f.value;
    let c = this.contacts.find((x) => x.key === key);
    if (c) {
      c.count += 1;
      c.lastSeen = now;
    } else {
      c = {
        key,
        id: this.newId(),
        type: f.type,
        value: f.value,
        display: f.display,
        country: f.country || null,
        countryName: f.countryName || null,
        national: f.national || null,
        domain: f.domain || null,
        name: '',
        count: 1,
        firstSeen: now,
        lastSeen: now,
      };
      this.contacts.unshift(c);
    }
  }
  if (this.contacts.length > 5000) {
    this.contacts.sort((a, b) => b.lastSeen - a.lastSeen);
    this.contacts = this.contacts.slice(0, 5000);
  }
  this.save();
};

Store.prototype.searchContacts = function searchContacts(query = '', filter = 'all') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = this.contacts.filter((c) => {
    if (filter === 'phone' && c.type !== 'phone') return false;
    if (filter === 'email' && c.type !== 'email') return false;
    if (!words.length) return true;
    const hay = [c.name, c.display, c.value, c.national, c.countryName, c.country, c.domain]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const digits = hay.replace(/\D/g, '');
    return words.every((w) => hay.includes(w) || (/^\d+$/.test(w) && digits.includes(w)));
  });
  return out.sort((a, b) => b.lastSeen - a.lastSeen);
};

Store.prototype.renameContact = function renameContact(id, name) {
  const c = this.contacts.find((x) => x.id === id);
  if (c) {
    c.name = String(name || '').trim().slice(0, 80);
    this.save();
  }
};

Store.prototype.removeContact = function removeContact(id) {
  const c = this.contacts.find((x) => x.id === id) || null;
  this.contacts = this.contacts.filter((x) => x.id !== id);
  this.save();
  return c;
};

Store.prototype.restoreContact = function restoreContact(c) {
  if (!c || !c.key || this.contacts.some((x) => x.key === c.key)) return;
  this.contacts.push(c);
  this.save();
};

Store.prototype.clearContacts = function clearContacts() {
  this.contacts = [];
  this.save();
};

const HEX = /^#[0-9A-F]{6}$/i;

Store.prototype.addPalette = function addPalette(name) {
  const p = { id: this.newId(), name: String(name || 'New palette').trim().slice(0, 40) || 'New palette', colors: [] };
  this.palettes.push(p);
  this.save();
  return p;
};

Store.prototype.removePalette = function removePalette(id) {
  if (this.palettes.length <= 1) return;
  this.palettes = this.palettes.filter((p) => p.id !== id);
  this.save();
};

Store.prototype.paletteAdd = function paletteAdd(id, hex) {
  const p = this.palettes.find((x) => x.id === id);
  if (!p || !HEX.test(hex)) return;
  hex = hex.toUpperCase();
  if (!p.colors.includes(hex) && p.colors.length < 60) p.colors.push(hex);
  this.save();
};

Store.prototype.paletteRemove = function paletteRemove(id, hex) {
  const p = this.palettes.find((x) => x.id === id);
  if (!p) return;
  p.colors = p.colors.filter((c) => c !== hex);
  this.save();
};

Store.prototype.emojiUsed = function emojiUsed(e) {
  const em = this.emoji;
  em.recent = [e, ...em.recent.filter((x) => x !== e)].slice(0, 40);
  em.counts[e] = (em.counts[e] || 0) + 1;
  this.save();
};

Store.prototype.emojiFavorite = function emojiFavorite(e) {
  const em = this.emoji;
  em.favorites = em.favorites.includes(e) ? em.favorites.filter((x) => x !== e) : [...em.favorites, e].slice(0, 120);
  this.save();
};

Store.prototype.emojiTone = function emojiTone(n) {
  this.emoji.tone = Math.min(Math.max(Math.round(n) || 0, 0), 5);
  this.save();
};

module.exports = { Store, DEFAULT_SETTINGS };
