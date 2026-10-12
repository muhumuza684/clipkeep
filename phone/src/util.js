// Small helpers shared by the store and the capture code.

export function hashString(s) {
  // Cheap, stable fingerprint. Long strings are sampled, and the length is part of the key.
  let h = 5381;
  const step = Math.max(1, Math.floor(s.length / 4096));
  for (let i = 0; i < s.length; i += step) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const URL_RE = /^(https?:\/\/|www\.)\S+$/i;
export function looksLikeUrl(text) {
  const t = text.trim();
  return !t.includes('\n') && URL_RE.test(t);
}

export function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(ts).toLocaleDateString();
}

export function kindFromMime(mime, fallback = 'file') {
  if (!mime) return fallback;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('text/')) return 'text';
  return fallback;
}

export function extOf(name = '') {
  const i = name.lastIndexOf('.');
  return i > 0 && i > name.length - 8 ? name.slice(i) : '';
}
