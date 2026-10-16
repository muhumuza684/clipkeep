(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const COUNTRIES = window.COUNTRIES || []; // [iso2, iso3, name, dial, currency, currencyName]
  const COUNTRY = Object.fromEntries(COUNTRIES.map((c) => [c[0], c]));
  const EM = window.EMOJI || { groups: [], items: [] }; // items: [emoji, label, words, group, version, skins]
  const EMOJI_MAX_VERSION = 14; // older Windows cannot draw newer emoji

  const clip = window.clip;
  let info = null;
  let settings = {};
  let page = 'clipboard';
  let toastTimer = null;
  let searchTimer = null;

  // ---------- icons (simple outlines, drawn inline so nothing needs downloading) ----------

  const ICONS = {
    clipboard: '<path d="M9 4h6v3H9z"/><path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V7a1.5 1.5 0 0 1 1.5-1.5H9"/>',
    contacts: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.4 2.2 4 2.2s3-.7 4-2.2"/><path d="M9 9.6h.01M15 9.6h.01"/>',
    drop: '<path d="M12 3c3.5 4.2 6 7.2 6 10.2A6 6 0 0 1 6 13.2C6 10.2 8.5 7.2 12 3z"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    send: '<path d="M4 12h11"/><path d="M11 8l4 4-4 4"/><path d="M19 5v14"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3-1-6z"/><path d="M12 13v7"/>',
    trash: '<path d="M5 7h14"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/>',
    chat: '<path d="M4 20l1.5-4A8 8 0 1 1 9 19z"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5H5V6h5"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
    eyedrop: '<path d="M14 5l5 5"/><path d="M15.5 3.5a2 2 0 0 1 3 3L9 16l-4 1 1-4z"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    audio: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="16" r="2.2"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    file: '<path d="M7 3h7l4 4v13H7z"/><path d="M14 3v4h4"/>',
    text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  };
  const NS = 'http://www.w3.org/2000/svg';
  function icon(name, size = 18) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  // ---------- helpers ----------

  function btn(label, iconName, opts = {}) {
    const b = el('button', 'btn' + (opts.primary ? ' primary' : '') + (opts.danger ? ' danger' : '') + (opts.iconOnly ? ' icon' : '') + (opts.on ? ' on' : ''));
    if (iconName) b.appendChild(icon(iconName, 16));
    if (!opts.iconOnly) b.appendChild(document.createTextNode(label));
    else {
      b.title = label;
      b.setAttribute('aria-label', label);
    }
    if (opts.title) b.title = opts.title;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.run && opts.run(e);
    });
    return b;
  }

  function timeAgo(ts) {
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

  function formatSize(b) {
    if (b == null) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  }

  function toast(msg, actionLabel, actionRun, ms) {
    $('toastText').textContent = msg;
    const a = $('toastAction');
    a.hidden = !actionLabel;
    a.onclick = null;
    if (actionLabel) {
      a.textContent = actionLabel;
      a.onclick = () => {
        $('toast').hidden = true;
        actionRun && actionRun();
      };
    }
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('toast').hidden = true), ms || (actionLabel ? 7000 : 2600));
  }

  const copied = (what) => toast(`${what || 'Copied'}. Press Ctrl+V where you want it.`);
  function copyValue(text, what) {
    return clip.copyText(text).then(() => copied(what));
  }

  const flagEmoji = (code) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

  function flagImg(code, small) {
    const i = el('img', 'flag' + (small ? ' sm' : ''));
    i.src = `flags/${code}.svg`;
    i.alt = '';
    i.loading = 'lazy';
    i.addEventListener('error', () => (i.style.visibility = 'hidden'));
    return i;
  }

  const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);

  function twoStep(button, armedLabel, action) {
    const original = button.textContent;
    let armed = false;
    let timer = null;
    button.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        button.textContent = armedLabel;
        timer = setTimeout(() => {
          armed = false;
          button.textContent = original;
        }, 4000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      button.textContent = original;
      action();
    });
  }

  function buildChips(container, defs, current, onPick) {
    container.textContent = '';
    for (const [key, label] of defs) {
      const b = el('button', 'chip', label);
      b.setAttribute('aria-pressed', String(current === key));
      b.addEventListener('click', () => onPick(key));
      container.appendChild(b);
    }
  }

  function select(container, id, scroll) {
    for (const row of container.querySelectorAll('[data-id]')) {
      const on = row.dataset.id === id;
      row.setAttribute('aria-selected', String(on));
      if (on && scroll) row.scrollIntoView({ block: 'nearest' });
    }
  }

  function leadBox(child, cls) {
    const d = el('div', 'lead' + (cls ? ' ' + cls : ''));
    d.appendChild(child);
    return d;
  }

  // =====================================================
  //  Clipboard page
  // =====================================================

  const CLIP_FILTERS = [
    ['all', 'All'], ['text', 'Text'], ['link', 'Links'], ['phone', 'Phone numbers'], ['email', 'Emails'],
    ['color', 'Colours'], ['image', 'Images'], ['media', 'Audio and video'], ['file', 'Files'],
  ];
  const KIND_LABEL = { text: 'Text', link: 'Link', phone: 'Phone number', email: 'Email', color: 'Colour', image: 'Image', audio: 'Audio', video: 'Video', file: 'File' };
  const KIND_ICON = { text: 'text', link: 'link', phone: 'contacts', email: 'mail', color: 'drop', image: 'image', audio: 'audio', video: 'video', file: 'file' };

  let clipFilter = 'all';
  let items = [];
  let total = 0;
  let selected = null;

  async function refreshClipboard() {
    const res = await clip.list($('search').value, clipFilter);
    items = res.items;
    total = res.total;
    settings.paused = res.paused;
    if (!items.find((i) => i.id === selected)) selected = items.length ? items[0].id : null;
    renderClipboard();
    renderStatus();
  }

  async function deleteItem(id) {
    const i = items.findIndex((x) => x.id === id);
    const next = items[i + 1] || items[i - 1];
    if (selected === id) selected = next ? next.id : null;
    await clip.remove(id);
    toast('Item deleted', 'Undo', async () => {
      await clip.undoRemove(id);
      refreshClipboard();
    });
  }

  function clipButtons(it) {
    const m = it.meta || {};
    const out = [];
    const copyBtn = (label, run) => out.push(btn(label, 'copy', { primary: true, run }));
    const pasteBtn = (run) => out.push(btn('Paste', 'send', { title: 'Paste into the app you were using', run }));

    if (it.kind === 'phone') {
      copyBtn('Copy number', () => copyValue(m.e164, 'Number copied'));
      pasteBtn(() => clip.pasteText(m.e164));
      out.push(btn('WhatsApp', 'chat', { run: () => clip.openUrl('whatsapp', m.e164) }));
      out.push(btn('Local format', 'copy', { run: () => copyValue(m.national, 'Copied') }));
    } else if (it.kind === 'email') {
      copyBtn('Copy email', () => copyValue(m.address, 'Email copied'));
      pasteBtn(() => clip.pasteText(m.address));
      out.push(btn('Write email', 'mail', { run: () => clip.openUrl('mailto', m.address) }));
      out.push(btn('Copy domain', 'copy', { run: () => copyValue(m.domain, 'Domain copied') }));
    } else if (it.kind === 'color') {
      copyBtn('Copy hex', () => copyValue(m.hex, 'Hex copied'));
      pasteBtn(() => clip.pasteText(m.hex));
      out.push(btn('RGB', 'copy', { title: 'Copy as RGB', run: () => copyValue(m.rgb, 'RGB copied') }));
      out.push(btn('HSL', 'copy', { title: 'Copy as HSL', run: () => copyValue(m.hsl, 'HSL copied') }));
      out.push(btn('Edit colour', 'drop', { run: () => { goPage('colours'); setHex(m.hex); } }));
    } else {
      copyBtn('Copy', async () => {
        const r = await clip.copy(it.id);
        if (r && r.ok) copied();
      });
      pasteBtn(() => clip.paste(it.id));
      if (it.kind === 'link') out.push(btn('Open link', 'open', { run: () => clip.openUrl('link', it.preview) }));
    }
    out.push(btn(it.pinned ? 'Unpin' : 'Pin to keep it', 'pin', { iconOnly: true, on: it.pinned, run: () => clip.pin(it.id) }));
    out.push(btn('Delete', 'trash', { iconOnly: true, run: () => deleteItem(it.id) }));
    return out;
  }

  function renderClipboard() {
    $('tip').hidden = !!settings.welcomed;
    const list = $('list');
    list.textContent = '';
    if (!items.length) {
      const e = el('li', 'empty');
      e.appendChild(el('strong', null, total ? 'Nothing matches your search' : 'Nothing saved yet'));
      e.appendChild(el('span', null, total ? 'Try different words, or choose All above.' : 'Copy some text in any app and it will appear here.'));
      list.appendChild(e);
      return;
    }

    for (const it of items) {
      const m = it.meta;
      const row = el('li', 'row');
      row.dataset.id = it.id;
      row.setAttribute('role', 'option');

      // lead picture
      if (it.thumb) {
        const img = el('img', 'thumb');
        img.src = it.thumb;
        img.alt = '';
        row.appendChild(leadBox(img));
      } else if (it.kind === 'phone' && m) {
        row.appendChild(leadBox(flagImg(m.country), 'flagLead'));
      } else if (it.kind === 'color' && m) {
        const sw = el('div', 'swatchFill');
        sw.style.background = m.rgb;
        row.appendChild(leadBox(sw));
      } else {
        row.appendChild(leadBox(icon(KIND_ICON[it.kind] || 'text', 22)));
      }

      // text
      const col = el('div', 'main-col');
      const sub = el('div', 'sub');
      sub.appendChild(el('span', 'kind', KIND_LABEL[it.kind] || 'Item'));
      if (it.kind === 'phone' && m) {
        col.appendChild(el('div', 'title', m.international));
        sub.appendChild(el('span', null, m.countryName));
        if (m.national) sub.appendChild(el('span', null, `Local: ${m.national}`));
      } else if (it.kind === 'color' && m) {
        col.appendChild(el('div', 'title', m.hex));
        sub.appendChild(el('span', null, m.rgb));
        sub.appendChild(el('span', null, m.hsl));
      } else if (it.kind === 'email' && m) {
        col.appendChild(el('div', 'title', m.address));
        sub.appendChild(el('span', null, `Domain: ${m.domain}`));
      } else if (it.preview != null) {
        const code = /[{};=<>]/.test(it.preview) && it.preview.includes('\n');
        col.appendChild(el('div', 'title plain' + (code ? ' mono' : ''), it.preview));
        if (it.length != null && it.length > 700) sub.appendChild(el('span', null, `${it.length.toLocaleString()} characters`));
      } else {
        col.appendChild(el('div', 'title', it.name || 'File'));
        if (it.size != null) sub.appendChild(el('span', null, formatSize(it.size)));
        if (it.external) sub.appendChild(el('span', 'warn', 'Not copied, location only'));
      }
      if (it.pinned) sub.appendChild(el('span', null, 'Pinned'));
      sub.appendChild(el('span', null, timeAgo(it.createdAt)));
      col.appendChild(sub);
      row.appendChild(col);

      const actions = el('div', 'rowActions');
      clipButtons(it).forEach((b) => actions.appendChild(b));
      row.appendChild(actions);

      row.addEventListener('click', () => {
        selected = it.id;
        select(list, selected, false);
      });
      row.addEventListener('dblclick', async () => {
        const r = await clip.copy(it.id);
        if (r && r.ok) copied();
      });
      list.appendChild(row);
    }
    select(list, selected, false);
  }

  // =====================================================
  //  Contacts page
  // =====================================================

  const CONTACT_FILTERS = [['all', 'All'], ['phone', 'Phone numbers'], ['email', 'Emails']];
  let contactFilter = 'all';
  let contacts = [];
  let contactOrder = [];
  let selContact = null;
  let renaming = null;

  async function refreshContacts() {
    contacts = await clip.contacts($('search').value, contactFilter);
    renderContacts();
    renderStatus();
  }

  async function removeContact(c) {
    const i = contactOrder.indexOf(c.id);
    selContact = contactOrder[i + 1] || contactOrder[i - 1] || null;
    const removed = await clip.removeContact(c.id);
    refreshContacts();
    toast('Contact removed', 'Undo', async () => {
      await clip.restoreContact(removed || c);
      refreshContacts();
    });
  }

  function renderContacts() {
    const box = $('contactList');
    box.textContent = '';
    contactOrder = [];

    if (!contacts.length) {
      const e = el('div', 'empty');
      e.appendChild(el('strong', null, $('search').value ? 'No contacts match your search' : 'No contacts yet'));
      e.appendChild(el('span', null, $('search').value ? 'Try a name, a number, or a country.' : 'Copy a phone number or an email address and it is kept here, grouped by country.'));
      box.appendChild(e);
      return;
    }

    const phones = contacts.filter((c) => c.type === 'phone');
    const emails = contacts.filter((c) => c.type === 'email');
    const byCountry = new Map();
    for (const c of phones) {
      if (!byCountry.has(c.country)) byCountry.set(c.country, []);
      byCountry.get(c.country).push(c);
    }
    for (const [code, list] of [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const head = el('div', 'groupHead');
      head.appendChild(flagImg(code, true));
      head.appendChild(el('span', null, list[0].countryName || (COUNTRY[code] && COUNTRY[code][2]) || code));
      head.appendChild(el('span', 'count', list.length === 1 ? '1 number' : `${list.length} numbers`));
      box.appendChild(head);
      list.forEach((c) => box.appendChild(contactRow(c)));
    }
    if (emails.length) {
      const head = el('div', 'groupHead');
      head.appendChild(icon('mail', 16));
      head.appendChild(el('span', null, 'Email addresses'));
      head.appendChild(el('span', 'count', emails.length === 1 ? '1 address' : `${emails.length} addresses`));
      box.appendChild(head);
      emails.forEach((c) => box.appendChild(contactRow(c)));
    }
    if (!contactOrder.includes(selContact)) selContact = contactOrder[0] || null;
    select(box, selContact, false);
  }

  function contactRow(c) {
    contactOrder.push(c.id);
    const row = el('div', 'row');
    row.dataset.id = c.id;
    row.appendChild(c.type === 'phone' ? leadBox(flagImg(c.country), 'flagLead') : leadBox(icon('mail', 22)));

    const col = el('div', 'main-col');
    const actions = el('div', 'rowActions');
    const finish = async (save, input) => {
      if (renaming !== c.id) return;
      renaming = null;
      if (save) await clip.renameContact(c.id, input.value);
      refreshContacts();
    };

    if (renaming === c.id) {
      const inp = el('input', 'renameInput');
      inp.value = c.name || '';
      inp.placeholder = 'Type a name for this contact';
      inp.maxLength = 80;
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true, inp); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false, inp); }
      });
      col.appendChild(inp);
      actions.appendChild(btn('Save name', 'check', { primary: true, run: () => finish(true, inp) }));
      actions.appendChild(btn('Cancel', 'x', { run: () => finish(false, inp) }));
      setTimeout(() => { inp.focus(); inp.select(); }, 0);
    } else {
      col.appendChild(el('div', 'title', c.name || c.display));
      if (c.type === 'phone') {
        actions.appendChild(btn('Copy number', 'copy', { primary: true, run: () => copyValue(c.value, 'Number copied') }));
        actions.appendChild(btn('Paste', 'send', { title: 'Paste into the app you were using', run: () => clip.pasteText(c.value) }));
        actions.appendChild(btn('WhatsApp', 'chat', { run: () => clip.openUrl('whatsapp', c.value) }));
      } else {
        actions.appendChild(btn('Copy email', 'copy', { primary: true, run: () => copyValue(c.value, 'Email copied') }));
        actions.appendChild(btn('Paste', 'send', { title: 'Paste into the app you were using', run: () => clip.pasteText(c.value) }));
        actions.appendChild(btn('Write email', 'mail', { run: () => clip.openUrl('mailto', c.value) }));
      }
      actions.appendChild(btn(c.name ? 'Rename' : 'Add name', 'edit', { run: () => { renaming = c.id; renderContacts(); } }));
      actions.appendChild(btn('Remove contact', 'trash', { iconOnly: true, run: () => removeContact(c) }));
    }

    const sub = el('div', 'sub');
    sub.appendChild(el('span', 'kind', c.type === 'phone' ? 'Phone number' : 'Email'));
    if (c.name) sub.appendChild(el('span', null, c.display));
    if (c.type === 'phone' && c.national) sub.appendChild(el('span', null, `Local: ${c.national}`));
    sub.appendChild(el('span', null, c.count === 1 ? 'Copied once' : `Copied ${c.count} times`));
    sub.appendChild(el('span', null, timeAgo(c.lastSeen)));
    col.appendChild(sub);
    row.appendChild(col);
    row.appendChild(actions);
    row.addEventListener('click', () => {
      selContact = c.id;
      select($('contactList'), selContact, false);
    });
    return row;
  }

  // =====================================================
  //  Emoji page
  // =====================================================

  const EMOJI_ROWS = EM.items.filter((r) => r[4] <= EMOJI_MAX_VERSION);
  const BY_CHAR = new Map();
  for (const r of EMOJI_ROWS) {
    BY_CHAR.set(r[0], r);
    if (r[5]) r[5].forEach((s) => BY_CHAR.set(s, r));
  }
  const TONE_COLORS = ['#ffcc4d', '#f7dece', '#f3d2a2', '#d5ab88', '#af7e57', '#7c533e'];
  const TONE_NAMES = ['Default yellow', 'Light', 'Medium light', 'Medium', 'Medium dark', 'Dark'];
  const EMOJI_CATS = [['recent', 'Recent'], ['fav', 'Favourites'], ['0', 'Smileys'], ['1', 'People'], ['3', 'Animals and nature'], ['4', 'Food and drink'], ['5', 'Travel'], ['6', 'Activities'], ['7', 'Objects'], ['8', 'Symbols']];

  let emo = { recent: [], counts: {}, favorites: [], tone: 0 };
  let emoCat = 'recent';
  let picked = [];

  const shown = (r) => (emo.tone > 0 && r[5] ? r[5][emo.tone - 1] : r[0]);

  function renderEmojiChrome() {
    buildChips($('emojiCats'), EMOJI_CATS, emoCat, (k) => {
      emoCat = k;
      $('search').value = '';
      renderEmojiChrome();
      renderEmoji();
    });
    const tones = $('tones');
    tones.textContent = '';
    TONE_COLORS.forEach((c, i) => {
      const b = el('button', 'tone');
      b.style.background = c;
      b.title = TONE_NAMES[i];
      b.setAttribute('aria-label', `Skin tone: ${TONE_NAMES[i]}`);
      b.setAttribute('aria-pressed', String(emo.tone === i));
      b.addEventListener('click', async () => {
        emo = await clip.emojiTone(i);
        renderEmojiChrome();
        renderEmoji();
      });
      tones.appendChild(b);
    });
  }

  function emojiSections() {
    const q = words($('search').value);
    if (q.length) {
      const out = [];
      for (const r of EMOJI_ROWS) {
        if (q.every((w) => `${r[1]} ${r[2]}`.toLowerCase().includes(w))) out.push(shown(r));
        if (out.length >= 240) break;
      }
      return [{ title: 'Search results', list: out, empty: 'No emoji match that search. Try a simpler word, like smile or heart.' }];
    }
    if (emoCat === 'fav') return [{ title: 'Your favourites', list: emo.favorites, empty: 'No favourites yet. Hover over any emoji and press its star.' }];
    if (emoCat === 'recent') {
      const top = Object.entries(emo.counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map((x) => x[0]);
      const out = [{ title: 'Recently used', list: emo.recent, empty: 'Emoji you use appear here. Choose a category above to start.' }];
      if (top.length) out.push({ title: 'Most used', list: top });
      return out;
    }
    const g = Number(emoCat);
    return [{ title: EM.groups[g], list: EMOJI_ROWS.filter((r) => r[3] === g).map(shown) }];
  }

  function renderEmoji() {
    const host = $('emojiGrid');
    const top = host.scrollTop;
    host.textContent = '';
    for (const sec of emojiSections()) {
      if (!sec.list.length) {
        if (sec.empty) host.appendChild(el('div', 'empty', sec.empty));
        continue;
      }
      host.appendChild(el('div', 'secTitle', sec.title));
      const grid = el('div', 'emojiGrid');
      for (const ch of sec.list) {
        const cell = el('div', 'emoCell');
        const b = el('button', 'emo', ch);
        const r = BY_CHAR.get(ch);
        b.title = r ? r[1] : ch;
        b.setAttribute('aria-label', `Copy ${r ? r[1] : 'emoji'}`);
        b.addEventListener('click', () => pick(ch));
        const fav = emo.favorites.includes(ch);
        const star = el('button', 'starBtn' + (fav ? ' on' : ''));
        star.appendChild(icon('star', 13));
        star.title = fav ? 'Remove from favourites' : 'Add to favourites';
        star.setAttribute('aria-label', star.title);
        star.addEventListener('click', async (e) => {
          e.stopPropagation();
          emo = await clip.emojiFavorite(ch);
          renderEmoji();
        });
        cell.appendChild(b);
        cell.appendChild(star);
        grid.appendChild(cell);
      }
      host.appendChild(grid);
    }
    host.scrollTop = top;
    renderPicked();
  }

  function pick(ch) {
    if (picked.length < 40) picked.push(ch);
    clip.copyText(picked.join(''));
    clip.emojiUsed([ch]);
    renderPicked();
  }

  function renderPicked() {
    const bar = $('emojiBar');
    bar.textContent = '';
    if (!picked.length) {
      const h = el('div', 'hint');
      h.appendChild(document.createTextNode('Click an emoji to copy it. Click more to build a message. Then press '));
      h.appendChild(el('b', null, 'Ctrl+V'));
      h.appendChild(document.createTextNode(' where you want it.'));
      bar.appendChild(h);
      return;
    }
    bar.appendChild(el('div', 'picked', picked.join('')));
    const h = el('div', 'hint');
    h.appendChild(document.createTextNode('Copied to your clipboard. Press '));
    h.appendChild(el('b', null, 'Ctrl+V'));
    h.appendChild(document.createTextNode(' to paste.'));
    bar.appendChild(h);
    bar.appendChild(btn('Paste into last app', 'send', { primary: true, run: () => { clip.pasteText(picked.join('')); } }));
    bar.appendChild(btn('Remove last', 'x', { run: () => { picked.pop(); clip.copyText(picked.join('')); renderPicked(); } }));
    bar.appendChild(btn('Clear', 'trash', { run: () => { picked = []; renderPicked(); } }));
  }

  // =====================================================
  //  Colours page
  // =====================================================

  let hsv = { h: 210, s: 0.75, v: 0.85 };
  let palettes = [];
  let palId = null;

  function hsvToRgb(h, s, v) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return { h, s: max ? d / max : 0, v: max };
  }
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
  const toHex = (rgb) => '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  function luminance(rgb) {
    const c = rgb.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const currentHex = () => toHex(hsvToRgb(hsv.h, hsv.s, hsv.v));

  function setHex(hex, fromInput) {
    let h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return false;
    hsv = rgbToHsv(...[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
    updateColourUI(fromInput);
    return true;
  }

  function updateColourUI(skipHexInput) {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const hex = toHex(rgb);
    const [hh, ss, ll] = rgbToHsl(...rgb);
    $('sv').style.background = `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${Math.round(hsv.h)}, 100%, 50%))`;
    $('svCursor').style.left = `${hsv.s * 100}%`;
    $('svCursor').style.top = `${(1 - hsv.v) * 100}%`;
    $('hueCursor').style.left = `${(hsv.h / 360) * 100}%`;
    $('bigSwatch').style.background = hex;
    if (!skipHexInput) $('cHex').value = hex;
    $('cRgb').value = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    $('cHsl').value = `hsl(${hh}, ${ss}%, ${ll}%)`;
    const L = luminance(rgb);
    const white = 1.05 / (L + 0.05);
    const black = (L + 0.05) / 0.05;
    const verdict = (r) => (r >= 7 ? 'passes AAA' : r >= 4.5 ? 'passes AA' : 'fails AA');
    $('contrast').textContent = `White text on this colour: ${white.toFixed(1)}:1, ${verdict(white)}. Black text: ${black.toFixed(1)}:1, ${verdict(black)}.`;
  }

  function dragOn(target, onMove) {
    target.addEventListener('pointerdown', (e) => {
      target.setPointerCapture(e.pointerId);
      const run = (ev) => {
        const r = target.getBoundingClientRect();
        onMove(Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1));
        updateColourUI(false);
      };
      run(e);
      const up = () => {
        target.removeEventListener('pointermove', run);
        target.removeEventListener('pointerup', up);
      };
      target.addEventListener('pointermove', run);
      target.addEventListener('pointerup', up);
    });
  }
  dragOn($('sv'), (x, y) => { hsv.s = x; hsv.v = 1 - y; });
  dragOn($('hue'), (x) => { hsv.h = Math.min(x * 360, 359.99); });

  $('cHex').addEventListener('input', (e) => setHex(e.target.value, true));
  $('cHex').addEventListener('blur', () => updateColourUI(false));
  document.querySelectorAll('[data-copy]').forEach((b) =>
    b.addEventListener('click', () => {
      const kind = b.dataset.copy;
      copyValue(kind === 'hex' ? currentHex() : $({ rgb: 'cRgb', hsl: 'cHsl' }[kind]).value, `${kind.toUpperCase()} copied`);
    })
  );

  $('eyedrop').appendChild(icon('eyedrop', 16));
  $('eyedrop').appendChild(document.createTextNode('Pick a colour from the screen'));
  $('pasteHex').appendChild(icon('send', 16));
  $('pasteHex').appendChild(document.createTextNode('Paste this hex into my last app'));
  $('pasteHex').addEventListener('click', () => clip.pasteText(currentHex()));
  $('eyedrop').addEventListener('click', async () => {
    if (!window.EyeDropper) return toast('The screen colour picker is not available on this PC.');
    try {
      const res = await new window.EyeDropper().open();
      setHex(res.sRGBHex);
    } catch {
      // cancelled with Esc
    }
  });

  async function loadPalettes() {
    palettes = await clip.palettes();
    if (!palettes.find((p) => p.id === palId)) palId = palettes[0] && palettes[0].id;
    renderPalettes();
  }

  function renderPalettes() {
    const sel = $('palSelect');
    sel.textContent = '';
    for (const p of palettes) {
      const o = el('option', null, `${p.name} (${p.colors.length})`);
      o.value = p.id;
      sel.appendChild(o);
    }
    sel.value = palId;
    const host = $('palColors');
    host.textContent = '';
    const pal = palettes.find((p) => p.id === palId);
    if (!pal || !pal.colors.length) host.appendChild(el('span', 'swEmpty', 'This palette is empty. Pick a colour above, then press Add this colour.'));
    else {
      for (const c of pal.colors) {
        const item = el('div', 'swatchItem');
        const b = el('button', 'sw');
        b.style.background = c;
        b.title = `${c}. Click to load it into the picker.`;
        b.setAttribute('aria-label', `Load ${c}`);
        b.addEventListener('click', () => setHex(c));
        const rm = el('button', 'swRemove', 'Remove');
        rm.setAttribute('aria-label', `Remove ${c} from the palette`);
        rm.addEventListener('click', async () => {
          palettes = await clip.removeColor(palId, c);
          renderPalettes();
        });
        item.appendChild(b);
        item.appendChild(rm);
        host.appendChild(item);
      }
    }
  }

  $('palSelect').addEventListener('change', (e) => { palId = e.target.value; renderPalettes(); });
  $('palAdd').addEventListener('click', async () => {
    if (!palId) await loadPalettes();
    palettes = await clip.addColor(palId, currentHex());
    toast(`Added ${currentHex()} to the palette`);
    renderPalettes();
  });
  $('palNew').addEventListener('click', async () => {
    const inp = $('palName');
    if (inp.hidden) {
      inp.hidden = false;
      $('palSelect').hidden = true;
      $('palNew').textContent = 'Create palette';
      inp.value = '';
      inp.focus();
      return;
    }
    if (inp.value.trim()) {
      palettes = await clip.addPalette(inp.value);
      palId = palettes[palettes.length - 1].id;
    }
    inp.hidden = true;
    $('palSelect').hidden = false;
    $('palNew').textContent = 'New palette';
    renderPalettes();
  });
  $('palName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('palNew').click(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('palName').hidden = true; $('palSelect').hidden = false; $('palNew').textContent = 'New palette'; }
  });
  twoStep($('palDel'), 'Click again to delete', async () => {
    if (palettes.length <= 1) return toast('Keep at least one palette.');
    palettes = await clip.removePalette(palId);
    palId = palettes[0].id;
    renderPalettes();
  });
  $('palCss').addEventListener('click', () => {
    const pal = palettes.find((p) => p.id === palId);
    if (!pal || !pal.colors.length) return toast('This palette is empty.');
    const slug = pal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colour';
    copyValue(`:root {\n${pal.colors.map((c, i) => `  --${slug}-${i + 1}: ${c};`).join('\n')}\n}`, 'CSS copied');
  });
  $('palJson').addEventListener('click', () => {
    const pal = palettes.find((p) => p.id === palId);
    if (!pal || !pal.colors.length) return toast('This palette is empty.');
    copyValue(JSON.stringify({ name: pal.name, colors: pal.colors }, null, 2), 'JSON copied');
  });


  // =====================================================
  //  Accent colour
  // =====================================================

  const ACCENT_DEFAULT = '#1E6FBF';
  const ACCENT_PRESETS = [['#1E6FBF', 'Bryt Ma Tech blue'], ['#1F7A5C', 'Bryt green'], ['#042C53', 'Navy'], ['#639922', 'Leaf green'], ['#BA7517', 'Amber'], ['#B4569A', 'Plum'], ['#2F8F8F', 'Teal'], ['#C2362F', 'Red'], ['#5B6B7D', 'Slate']];
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixHex = (a, b, t) => {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return toHex(x.map((v, i) => Math.round(v * (1 - t) + y[i] * t)));
  };
  const isHex6 = (v) => /^#[0-9a-f]{6}$/i.test(v);
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)');

  function applyAccent(hex) {
    const root = document.documentElement.style;
    if (!hex) {
      ['--accent', '--strong', '--strong-ink'].forEach((p) => root.removeProperty(p));
      return;
    }
    let c = hex;
    if (darkMode.matches && luminance(hexToRgb(c)) < 0.12) c = mixHex(c, '#FFFFFF', 0.45); // keep it readable on dark
    root.setProperty('--accent', c);
    root.setProperty('--strong', c);
    root.setProperty('--strong-ink', luminance(hexToRgb(c)) > 0.4 ? '#042C53' : '#FFFFFF');
  }
  darkMode.addEventListener('change', () => applyAccent(settings.accent));

  function renderAccent() {
    const host = $('accentSwatches');
    host.textContent = '';
    const current = (settings.accent || ACCENT_DEFAULT).toUpperCase();
    for (const [hex, name] of ACCENT_PRESETS) {
      const b = el('button', 'sw sm');
      b.style.background = hex;
      b.title = name;
      b.setAttribute('aria-label', `Use ${name} as the accent colour`);
      b.setAttribute('aria-pressed', String(current === hex));
      b.addEventListener('click', () => setAccent(hex));
      host.appendChild(b);
    }
    $('accentHex').value = current;
    $('accentPreview').style.background = current;
  }

  async function setAccent(hex) {
    if (hex && !isHex6(hex)) return toast('Type a colour like #1E6FBF.');
    const value = hex ? hex.toUpperCase() : null;
    await clip.setSettings({ accent: value });
    settings.accent = value;
    applyAccent(value);
    renderAccent();
    $('accentMsg').textContent = value ? `Accent colour set to ${value}.` : 'Back to the Bryt Ma Tech blue.';
  }

  $('accentHex').addEventListener('input', (e) => {
    if (isHex6(e.target.value)) $('accentPreview').style.background = e.target.value;
  });
  $('accentApply').addEventListener('click', () => setAccent($('accentHex').value.trim()));
  $('accentFromPicker').addEventListener('click', () => setAccent(currentHex()));
  $('accentReset').addEventListener('click', () => setAccent(null));


  // =====================================================
  //  Win+V
  // =====================================================

  async function renderWinV() {
    const st = await clip.winvStatus();
    const sw = $('setWinV');
    sw.checked = st.on;
    sw.disabled = !st.supported;
    let text = 'Off. Windows still uses Win+V for its own clipboard history.';
    if (!st.supported) text = 'Only available on Windows.';
    else if (st.registered) text = 'On. Press Win+V anywhere to open ClipKeep.';
    else if (st.waitingForRestart) text = 'Almost there. Windows only lets go of Win+V after Windows Explorer restarts.';
    else if (st.on) text = 'On, but Windows is still holding Win+V. Restart Windows Explorer or sign out and back in.';
    $('winvStatus').textContent = text;
    $('winvButtons').hidden = !(st.on && !st.registered);
  }

  $('setWinV').addEventListener('change', async (e) => {
    const st = await clip.winvSet(e.target.checked);
    if (st && st.error) toast(st.error);
    renderWinV();
  });
  $('winvRestart').addEventListener('click', async () => {
    $('winvRestart').disabled = true;
    await clip.restartExplorer();
    $('winvRestart').disabled = false;
    renderWinV();
  });
  $('winClipSettings').addEventListener('click', () => clip.openWindowsClipboardSettings());

  // =====================================================
  //  Flags page
  // =====================================================

  let flagSel = null;
  let flagRows = [];

  function renderFlags() {
    const q = words($('search').value);
    flagRows = COUNTRIES.filter((c) => !q.length || q.every((w) => `${c[2]} ${c[0]} ${c[1]} +${c[3]} ${c[3]} ${c[4]} ${c[5]}`.toLowerCase().includes(w)));
    const list = $('flagList');
    list.textContent = '';
    if (!flagRows.length) {
      const e = el('li', 'empty');
      e.appendChild(el('strong', null, 'No country matches'));
      e.appendChild(el('span', null, 'Try a name, a code like UG, or a dial code like 256.'));
      list.appendChild(e);
    }
    for (const c of flagRows) {
      const row = el('li', 'row');
      row.dataset.id = c[0];
      row.appendChild(leadBox(flagImg(c[0]), 'flagLead'));
      const col = el('div', 'main-col');
      col.appendChild(el('div', 'title', c[2]));
      const sub = el('div', 'sub');
      sub.appendChild(el('span', null, `Codes: ${c[0]} and ${c[1]}`));
      sub.appendChild(el('span', null, `Dial code: +${c[3]}`));
      if (c[4]) sub.appendChild(el('span', null, `Currency: ${c[4]} (${c[5]})`));
      col.appendChild(sub);
      row.appendChild(col);
      const actions = el('div', 'rowActions');
      actions.appendChild(btn('Copy flag', 'copy', { primary: true, run: () => copyValue(flagEmoji(c[0]), 'Flag copied') }));
      actions.appendChild(btn('Paste flag', 'send', { run: () => clip.pasteText(flagEmoji(c[0])) }));
      actions.appendChild(btn('Name', 'copy', { title: 'Copy the country name', run: () => copyValue(c[2], 'Name copied') }));
      actions.appendChild(btn('Dial code', 'copy', { run: () => copyValue('+' + c[3], 'Dial code copied') }));
      if (c[4]) actions.appendChild(btn('Currency', 'copy', { title: 'Copy the currency code', run: () => copyValue(c[4], 'Currency code copied') }));
      row.appendChild(actions);
      row.addEventListener('click', () => { flagSel = c[0]; select(list, flagSel, false); });
      list.appendChild(row);
    }
    if (!flagRows.find((c) => c[0] === flagSel)) flagSel = flagRows[0] ? flagRows[0][0] : null;
    select(list, flagSel, false);
    renderStatus();
  }

  // =====================================================
  //  Navigation, status bar, search
  // =====================================================

  const PAGES = [['clipboard', 'Clipboard', 'clipboard'], ['contacts', 'Contacts', 'contacts'], ['emoji', 'Emoji', 'smile'], ['colours', 'Colours', 'drop'], ['flags', 'Flags', 'flag']];
  const TITLES = { clipboard: 'Clipboard', contacts: 'Contacts', emoji: 'Emoji', colours: 'Colours', flags: 'Flags', settings: 'Settings' };
  const PLACEHOLDER = {
    clipboard: 'Search what you copied',
    contacts: 'Search names, numbers, emails or countries',
    emoji: 'Search emoji, like laugh or heart',
    flags: 'Search a country, code or dial code',
  };

  function renderNav() {
    const nav = $('nav');
    nav.textContent = '';
    PAGES.forEach(([key, label, ic], i) => {
      const b = el('button', 'tab');
      b.appendChild(icon(ic, 18));
      b.appendChild(document.createTextNode(label));
      b.title = `${label} (Ctrl+${i + 1})`;
      if (page === key) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => goPage(key));
      nav.appendChild(b);
    });
    if (page === 'settings') $('settingsBtn').setAttribute('aria-current', 'page');
    else $('settingsBtn').removeAttribute('aria-current');
  }

  function goPage(name) {
    page = name;
    renderNav();
    for (const k of Object.keys(TITLES)) $('p-' + k).hidden = k !== name;
    const hasSearch = !!PLACEHOLDER[name];
    $('searchWrap').hidden = !hasSearch;
    $('search').placeholder = PLACEHOLDER[name] || '';
    $('search').value = '';
    renderStatus();
    refreshActive().then(() => {
      if (name === 'colours') loadPalettes();
      if (name === 'settings') fillSettings();
      if (hasSearch && name !== 'emoji') $('search').focus();
    });
  }

  async function refreshActive() {
    if (page === 'clipboard') return refreshClipboard();
    if (page === 'contacts') return refreshContacts();
    if (page === 'emoji') {
      emo = await clip.emojiState();
      if (emoCat === 'recent' && !emo.recent.length && !emo.favorites.length) emoCat = '0';
      renderEmojiChrome();
      return renderEmoji();
    }
    if (page === 'colours') return updateColourUI(false);
    if (page === 'flags') return renderFlags();
  }

  function renderStatus() {
    const b = $('captureBtn');
    b.textContent = '';
    const paused = !!settings.paused;
    b.appendChild(el('span', 'dot' + (paused ? ' paused' : '')));
    b.appendChild(document.createTextNode(paused ? 'Paused. Click to start saving again' : 'Saving what you copy. Click to pause'));
    b.title = paused ? 'Capture is paused' : 'Capture is on';
    let text = '';
    if (page === 'clipboard') text = total === 1 ? '1 item saved' : `${total} items saved`;
    else if (page === 'contacts') text = contacts.length === 1 ? '1 contact' : `${contacts.length} contacts`;
    else if (page === 'flags') text = flagRows.length === 1 ? '1 country' : `${flagRows.length} countries`;
    $('countText').textContent = text;
  }

  $('captureBtn').addEventListener('click', async () => {
    await clip.setSettings({ paused: !settings.paused });
    settings.paused = !settings.paused;
    renderStatus();
    toast(settings.paused ? 'Paused. Nothing new will be saved.' : 'Saving again.');
  });

  $('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshActive, 80);
  });
  $('tipClose').addEventListener('click', () => {
    settings.welcomed = true;
    clip.setSettings({ welcomed: true });
    $('tip').hidden = true;
  });

  // ---------- keyboard (shortcuts only; everything also works with the mouse) ----------

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = (t.tagName === 'INPUT' && t.id !== 'search') || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';

    if (e.ctrlKey && /^[1-6]$/.test(e.key)) {
      e.preventDefault();
      return goPage(e.key === '6' ? 'settings' : PAGES[Number(e.key) - 1][0]);
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f' && PLACEHOLDER[page]) {
      e.preventDefault();
      $('search').focus();
      return $('search').select();
    }
    if (e.key === 'Escape' && t.id === 'search' && $('search').value) {
      e.preventDefault();
      $('search').value = '';
      return refreshActive();
    }
    if (typing || e.ctrlKey || e.altKey) return;
    if (!['clipboard', 'contacts', 'flags'].includes(page)) return;

    const move = (delta) => {
      if (page === 'clipboard' && items.length) {
        const i = Math.min(Math.max(items.findIndex((x) => x.id === selected) + delta, 0), items.length - 1);
        selected = items[i].id;
        select($('list'), selected, true);
      } else if (page === 'contacts' && contactOrder.length) {
        const i = Math.min(Math.max(contactOrder.indexOf(selContact) + delta, 0), contactOrder.length - 1);
        selContact = contactOrder[i];
        select($('contactList'), selContact, true);
      } else if (page === 'flags' && flagRows.length) {
        const i = Math.min(Math.max(flagRows.findIndex((c) => c[0] === flagSel) + delta, 0), flagRows.length - 1);
        flagSel = flagRows[i][0];
        select($('flagList'), flagSel, true);
      }
    };

    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); move(6); }
    else if (e.key === 'PageUp') { e.preventDefault(); move(-6); }
    else if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
      e.preventDefault();
      if (page === 'clipboard' && selected) clip.copy(selected).then((r) => r && r.ok && copied());
      else if (page === 'contacts' && selContact) {
        const c = contacts.find((x) => x.id === selContact);
        if (c) copyValue(c.value, c.type === 'phone' ? 'Number copied' : 'Email copied');
      } else if (page === 'flags' && flagSel) copyValue(flagEmoji(flagSel), 'Flag copied');
    } else if (e.key === 'Delete' && t.id !== 'search') {
      e.preventDefault();
      if (page === 'clipboard' && selected) deleteItem(selected);
      else if (page === 'contacts' && selContact) {
        const c = contacts.find((x) => x.id === selContact);
        if (c) removeContact(c);
      }
    }
  });

  // =====================================================
  //  Settings page
  // =====================================================

  async function fillSettings() {
    const s = await clip.getSettings();
    settings = { ...settings, ...s };
    $('setCapture').checked = !s.paused;
    $('setAutostart').checked = s.startWithWindows;
    $('setAutostart').disabled = !s.canAutostart;
    $('autostartNote').textContent = s.canAutostart ? 'Runs quietly in the tray after you sign in.' : 'Available after you build the installer with npm run dist and install it.';
    $('setTray').checked = s.closeToTray;
    $('setTheme').value = s.theme || 'system';
    $('accentMsg').textContent = '';
    renderAccent();
    renderWinV();
    $('setHotkey').value = s.hotkey;
    $('hotkeyMsg').textContent = 'Example: Control+Alt+V or Control+Shift+Space';
    $('hotkeyMsg').style.color = '';
    $('setHome').value = s.homeCountry;
    $('setMaxItems').value = s.maxItems;
    $('setMaxFile').value = s.maxFileMB;
    $('setIgnore').value = (s.ignorePatterns || []).join('\n');
    renderAbout();
  }

  function renderAbout() {
    const a = $('about');
    a.textContent = '';
    const b = info.brand;
    a.appendChild(el('h2', null, 'About'));
    a.appendChild(el('span', 'wordmark', b.company));
    a.appendChild(el('p', null, `${b.productName} version ${info.version}`));
    a.appendChild(el('p', null, `${b.tagline}. ${b.builtIn}.`));
    a.appendChild(el('p', null, b.privacy));
    a.appendChild(el('p', null, `Contact: ${b.contact.email}`));
    const again = btn('Show the getting started tips again', 'check', { run: () => { settings.welcomed = false; clip.setSettings({ welcomed: false }); goPage('clipboard'); } });
    a.appendChild(again);
  }

  $('setCapture').addEventListener('change', (e) => { clip.setSettings({ paused: !e.target.checked }); settings.paused = !e.target.checked; renderStatus(); });
  $('setAutostart').addEventListener('change', (e) => clip.setSettings({ startWithWindows: e.target.checked }));
  $('setTray').addEventListener('change', (e) => clip.setSettings({ closeToTray: e.target.checked }));
  $('setTheme').addEventListener('change', (e) => clip.setSettings({ theme: e.target.value }));
  $('setHome').addEventListener('change', (e) => clip.setSettings({ homeCountry: e.target.value }).then(() => toast('Your country is saved')));
  $('setMaxItems').addEventListener('change', (e) => clip.setSettings({ maxItems: Number(e.target.value) }));
  $('setMaxFile').addEventListener('change', (e) => clip.setSettings({ maxFileMB: Number(e.target.value) }));
  $('saveIgnore').addEventListener('click', async () => {
    await clip.setSettings({ ignorePatterns: $('setIgnore').value.split('\n') });
    toast('Patterns saved');
  });
  $('applyHotkey').addEventListener('click', async () => {
    const r = await clip.setSettings({ hotkey: $('setHotkey').value.trim() });
    $('hotkeyMsg').textContent = r.ok ? 'Shortcut changed.' : r.error;
    $('hotkeyMsg').style.color = r.ok ? '' : 'var(--danger)';
  });
  twoStep($('clearUnpinned'), 'Click again to clear', () => { clip.clear(true); toast('Unpinned items cleared'); });
  twoStep($('clearContacts'), 'Click again to clear', () => { clip.clearContacts(); toast('Contacts cleared'); });
  twoStep($('clearAll'), 'Click again to delete all', () => { clip.clear(false); clip.clearContacts(); toast('Everything deleted'); });
  $('openFolder').addEventListener('click', () => clip.openFolder());

  function renderTheme() {
    const dark = darkMode.matches;
    $('themeLight').setAttribute('aria-pressed', String(!dark));
    $('themeDark').setAttribute('aria-pressed', String(dark));
  }
  function chooseTheme(t) {
    settings.theme = t;
    clip.setSettings({ theme: t });
    setTimeout(renderTheme, 250);
  }
  $('themeLight').addEventListener('click', () => chooseTheme('light'));
  $('themeDark').addEventListener('click', () => chooseTheme('dark'));
  $('settingsBtn').addEventListener('click', () => goPage('settings'));
  darkMode.addEventListener('change', renderTheme);

  // ---------- live updates ----------

  clip.onChanged(() => {
    if ((page === 'clipboard' || page === 'contacts') && !renaming) refreshActive();
  });
  clip.onToast((m) => toast(m));
  window.addEventListener('focus', () => { if (page === 'clipboard' || page === 'contacts') refreshActive(); });

  // ---------- start ----------

  (async () => {
    info = await clip.info();
    settings = await clip.getSettings();
    applyAccent(settings.accent);
    document.title = info.brand.productName;
    $('searchIcon').appendChild(icon('search', 16));
    $('productName').textContent = info.brand.productName;

    const home = $('setHome');
    for (const c of COUNTRIES) {
      const o = el('option', null, `${c[2]} (+${c[3]})`);
      o.value = c[0];
      home.appendChild(o);
    }

    $('builtIn').textContent = info.brand.builtIn;
    $('version').textContent = `${info.brand.productName} ${info.version}`;
    $('settingsBtn').appendChild(icon('sliders', 16));
    $('settingsBtn').appendChild(document.createTextNode('Settings'));
    for (const [id, ic, label] of [['themeLight', 'sun', 'Light'], ['themeDark', 'moon', 'Dark']]) {
      $(id).appendChild(icon(ic, 15));
      $(id).appendChild(el('span', null, label));
    }
    renderTheme();

    buildChips($('chips-clip'), CLIP_FILTERS, clipFilter, function setClip(k) {
      clipFilter = k;
      buildChips($('chips-clip'), CLIP_FILTERS, clipFilter, setClip);
      refreshClipboard();
    });
    buildChips($('chips-contacts'), CONTACT_FILTERS, contactFilter, function setContact(k) {
      contactFilter = k;
      buildChips($('chips-contacts'), CONTACT_FILTERS, contactFilter, setContact);
      refreshContacts();
    });
    renderPicked();
    updateColourUI(false);
    goPage('clipboard');
    setInterval(() => {
      if (!document.hidden && (page === 'clipboard' || page === 'contacts') && !renaming) refreshActive();
    }, 60000);
  })();
})();
