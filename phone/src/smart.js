// Works out what copied text is: phone number, email, colour, link or plain text.
import { findPhoneNumbersInText, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import COUNTRIES from './countries';

export const countryName = (code) => (COUNTRIES[code] ? COUNTRIES[code][0] : code);

export function flagEmoji(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const EMAIL_ONE = /^[A-Z0-9._%+'-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i;
const EMAIL_ALL = /[A-Z0-9._%+'-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const URL_ONE = /^(https?:\/\/|www\.)\S+$/i;
const PHONE_SHAPE = /^[+()\d\s.\-]{7,24}$/;

// ---------- colours ----------

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round);
}

function colorMeta(r, g, b, a) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const alpha = a == null || a === 1 ? null : Math.round(a * 100) / 100;
  return {
    hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`,
    rgb: alpha == null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`,
    hsl: alpha == null ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${alpha})`,
  };
}

export function parseColor(text) {
  const t = text.trim();
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return colorMeta(r, g, b, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : null);
  }
  m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i.exec(t);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if (r > 255 || g > 255 || b > 255) return null;
    const a = m[4] == null ? null : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return colorMeta(r, g, b, a);
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i.exec(t);
  if (m) {
    const [r, g, b] = hslToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    const a = m[4] == null ? null : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return colorMeta(r, g, b, a);
  }
  return null;
}

// ---------- phones ----------

function phoneMeta(pn) {
  return {
    country: pn.country,
    countryName: countryName(pn.country),
    dial: pn.countryCallingCode,
    e164: pn.number,
    international: pn.formatInternational(),
    national: pn.formatNational(),
  };
}

function parseWholePhone(text, home) {
  const t = text.trim();
  if (!PHONE_SHAPE.test(t)) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  const pn = parsePhoneNumberFromString(t, home || 'UG');
  if (!pn || !pn.isValid() || !pn.country) return null;
  return phoneMeta(pn);
}

// ---------- public ----------

export function classify(text, home) {
  const t = text.trim();
  if (t.length === 0 || t.length > 300 || t.includes('\n')) {
    return { kind: URL_ONE.test(t) && !t.includes('\n') ? 'link' : 'text', meta: null };
  }
  if (URL_ONE.test(t)) return { kind: 'link', meta: null };
  if (EMAIL_ONE.test(t)) {
    const [local, domain] = t.split('@');
    return { kind: 'email', meta: { address: t.toLowerCase(), local, domain: domain.toLowerCase() } };
  }
  const color = parseColor(t);
  if (color) return { kind: 'color', meta: color };
  const phone = parseWholePhone(t, home);
  if (phone) return { kind: 'phone', meta: phone };
  return { kind: 'text', meta: null };
}

// Finds every phone number and email inside a longer text (a signature, a message).
export function extractContacts(text, home) {
  if (!text || text.length > 20000) return [];
  const found = new Map();
  for (const m of text.match(EMAIL_ALL) || []) {
    const address = m.toLowerCase();
    if (found.size >= 40) break;
    found.set('email:' + address, { type: 'email', value: address, display: address, domain: address.split('@')[1] });
  }
  // Scan each piece separately. Otherwise a comma between two numbers is read as "extension".
  const pieces = text.split(/[,;|\n\r\t]+|\s\/\s/);
  try {
    for (const piece of pieces) {
      for (const r of findPhoneNumbersInText(piece, home || 'UG')) {
        const pn = r.number;
        if (!pn || !pn.isValid() || !pn.country) continue;
        if (found.size >= 80) break;
        const meta = phoneMeta(pn);
        found.set('phone:' + meta.e164, {
          type: 'phone',
          value: meta.e164,
          display: meta.international.replace(/\s*ext\.?\s*\d+$/i, ''),
          country: meta.country,
          countryName: meta.countryName,
          national: meta.national.replace(/\s*ext\.?\s*\d+$/i, ''),
          dial: meta.dial,
        });
      }
    }
  } catch {}
  return [...found.values()];
}
