// Tiny external store: one JSON index in AsyncStorage, files on disk under Documents/clips.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { newId } from './util';

const KEY = 'clipkeep:v1';

export const DEFAULT_SETTINGS = {
  paused: false,
  maxItems: 500,
  maxFileMB: 50,
  homeCountry: 'UG',
  tipDismissed: false,
  theme: 'system',
  accent: null,
};

let state = { ready: false, items: [], contacts: [], settings: { ...DEFAULT_SETTINGS } };
const listeners = new Set();
const trash = new Map();
let saveTimer = null;

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(next) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(
      KEY,
      JSON.stringify({ items: state.items, contacts: state.contacts, settings: state.settings })
    ).catch(() => {});
  }, 250);
}

export function clipsDir() {
  const dir = new Directory(Paths.document, 'clips');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function deleteFileOf(item) {
  if (!item.file) return;
  try {
    const f = new File(item.file.uri);
    if (f.exists) f.delete();
  } catch {}
}

export async function init() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      set({
        ready: true,
        items: Array.isArray(saved.items) ? saved.items : [],
        contacts: Array.isArray(saved.contacts) ? saved.contacts : [],
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
      });
      return;
    }
  } catch {}
  set({ ready: true });
}

function prune(items, maxItems) {
  if (items.length <= maxItems) return items;
  const pinnedCount = items.filter((i) => i.pinned).length;
  let room = Math.max(maxItems - pinnedCount, 0);
  const keep = [];
  for (const it of items) {
    if (it.pinned) keep.push(it);
    else if (room > 0) {
      keep.push(it);
      room--;
    } else deleteFileOf(it);
  }
  return keep;
}

// Adds an item, or moves an identical one to the top. Returns 'added' | 'moved'.
export function addItem(item) {
  const existing = state.items.find((i) => i.hash === item.hash);
  if (existing) {
    if (item.file && existing.file && item.file.uri !== existing.file.uri) deleteFileOf(item);
    const moved = { ...existing, createdAt: Date.now() };
    set({ items: [moved, ...state.items.filter((i) => i.id !== existing.id)] });
    return 'moved';
  }
  set({ items: prune([item, ...state.items], state.settings.maxItems) });
  return 'added';
}

export const hasHash = (hash) => state.items.some((i) => i.hash === hash);

export function togglePin(id) {
  set({ items: state.items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)) });
}

// Delete that can be undone for a few seconds. The file is removed afterwards.
export function removeSoft(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  set({ items: state.items.filter((i) => i.id !== id) });
  trash.set(id, setTimeout(() => {
    deleteFileOf(it);
    trash.delete(id);
  }, 12000));
  trash.set(id + ':item', it);
}

export function restoreItem(id) {
  const it = trash.get(id + ':item');
  if (!it) return;
  clearTimeout(trash.get(id));
  trash.delete(id);
  trash.delete(id + ':item');
  set({ items: [...state.items, it].sort((a, b) => b.createdAt - a.createdAt) });
}

export function clearAll({ keepPinned = true } = {}) {
  const gone = state.items.filter((i) => !(keepPinned && i.pinned));
  gone.forEach(deleteFileOf);
  set({ items: state.items.filter((i) => keepPinned && i.pinned) });
}

export function setSetting(key, value) {
  set({ settings: { ...state.settings, [key]: value } });
}

// ---------- contacts ----------

export function noteContacts(found) {
  if (!found || !found.length) return;
  const now = Date.now();
  let contacts = [...state.contacts];
  for (const f of found) {
    const key = f.type + ':' + f.value;
    const i = contacts.findIndex((c) => c.key === key);
    if (i >= 0) contacts[i] = { ...contacts[i], count: contacts[i].count + 1, lastSeen: now };
    else {
      contacts.unshift({
        key,
        id: newId(),
        type: f.type,
        value: f.value,
        display: f.display,
        country: f.country || null,
        countryName: f.countryName || null,
        national: f.national || null,
        domain: f.domain || null,
        name: '',
        count: 1,
        lastSeen: now,
      });
    }
  }
  if (contacts.length > 3000) contacts = contacts.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 3000);
  set({ contacts });
}

export function renameContact(id, name) {
  set({ contacts: state.contacts.map((c) => (c.id === id ? { ...c, name: String(name || '').trim().slice(0, 80) } : c)) });
}

export function removeContact(id) {
  const c = state.contacts.find((x) => x.id === id);
  set({ contacts: state.contacts.filter((x) => x.id !== id) });
  return c;
}

export function restoreContact(c) {
  if (!c || state.contacts.some((x) => x.key === c.key)) return;
  set({ contacts: [...state.contacts, c] });
}

export function clearContacts() {
  set({ contacts: [] });
}
