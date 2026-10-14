const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  clipboard,
  nativeImage,
  nativeTheme,
  ipcMain,
  screen,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { Store } = require('./store');
const smart = require('./smart');
const brand = require('./brand');
const winv = require('./winv');

const IS_WIN = process.platform === 'win32';
const POLL_MS = 450;
const MAX_TEXT_CHARS = 1_000_000;

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.wma', '.amr']);
const VIDEO_EXT = new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.wmv', '.m4v', '.3gp', '.flv']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

let store;
let win = null;
let tray = null;
let lastSig = null;
let polling = false;
let quitting = false;

// ---------- small helpers ----------

const sha1 = (data) => crypto.createHash('sha1').update(data).digest('hex');

function kindForPath(p) {
  const ext = path.extname(p).toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'image';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_EXT.has(ext)) return 'video';
  return 'file';
}

function runPowerShell(script, timeout = 8000) {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve(null);
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : stdout)
    );
  });
}

const psQuote = (s) => `'${s.replace(/'/g, "''")}'`;

function toast(message) {
  if (win && !win.isDestroyed()) win.webContents.send('toast', message);
}

function notifyChanged() {
  if (win && !win.isDestroyed()) win.webContents.send('changed');
}

// ---------- reading the clipboard ----------

// Password managers mark their copies so Windows' own history skips them. We honour the same flags.
function isMarkedPrivate() {
  if (!IS_WIN) return false;
  try {
    const hist = clipboard.readBuffer('CanIncludeInClipboardHistory');
    if (hist.length >= 4 && hist.readUInt32LE(0) === 0) return true;
    const excl = clipboard.readBuffer('ExcludeClipboardContentFromMonitorProcessing');
    if (excl.length > 0) return true;
  } catch {}
  return false;
}

function readFileNameW() {
  if (!IS_WIN) return null;
  try {
    const buf = clipboard.readBuffer('FileNameW');
    if (buf && buf.length > 2) return buf;
  } catch {}
  return null;
}

// Looks at the clipboard and describes it. Files win, then text, then pictures.
function readClipboard() {
  const fileBuf = readFileNameW();
  if (fileBuf) {
    return { type: 'files', sig: 'f:' + sha1(fileBuf), firstPath: fileBuf.toString('utf16le').replace(/\0+$/g, '') };
  }

  const formats = clipboard.availableFormats();
  const hasText = formats.some((f) => f.startsWith('text/plain'));
  if (hasText) {
    const text = clipboard.readText();
    if (text && text.trim().length > 0) {
      return { type: 'text', sig: 't:' + sha1(text), text };
    }
  }

  const hasImage = formats.some((f) => f.startsWith('image/'));
  if (hasImage) {
    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      return { type: 'image', sig: 'i:' + sha1(img.toBitmap()), img };
    }
  }
  return null;
}

// ---------- saving what was copied ----------

async function saveText(text) {
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);
  for (const pattern of store.settings.ignorePatterns) {
    try {
      if (new RegExp(pattern, 'i').test(text)) return;
    } catch {}
  }
  const home = store.settings.homeCountry;
  const { kind, meta } = smart.classify(text, home);
  store.add({
    id: store.newId(),
    kind,
    hash: 'txt:' + sha1(text),
    pinned: false,
    createdAt: Date.now(),
    text,
    meta,
  });
  // Phone numbers and emails found anywhere in the text go into the Contacts tab.
  store.noteContacts(smart.extractContacts(text, home));
}

async function saveImage(cur) {
  const hash = 'img:' + cur.sig;
  if (store.findByHash(hash)) {
    store.add({ hash }); // moves the existing one to the top
    return;
  }
  const id = store.newId();
  const dest = path.join(store.filesDir, `${id}.png`);
  const png = cur.img.toPNG();
  await fs.promises.writeFile(dest, png);
  store.add({
    id,
    kind: 'image',
    hash,
    pinned: false,
    createdAt: Date.now(),
    file: { path: dest, name: 'Copied image.png', size: png.length, stored: true },
  });
}

async function resolveCopiedPaths(firstPath) {
  const out = await runPowerShell(
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }'
  );
  const list = out ? out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  return list.length ? list : firstPath ? [firstPath] : [];
}

async function saveFiles(cur) {
  const paths = await resolveCopiedPaths(cur.firstPath);
  const limit = store.settings.maxFileMB * 1024 * 1024;
  let skipped = 0;
  for (const p of paths) {
    try {
      const st = await fs.promises.stat(p);
      const name = path.basename(p);
      const hash = `file:${name}:${st.size}:${Math.round(st.mtimeMs)}`;
      if (store.findByHash(hash)) {
        store.add({ hash });
        continue;
      }
      const kind = st.isDirectory() ? 'file' : kindForPath(p);
      const id = store.newId();
      let file;
      if (!st.isDirectory() && st.size <= limit) {
        const dest = path.join(store.filesDir, id + path.extname(p));
        await fs.promises.copyFile(p, dest);
        file = { path: dest, name, size: st.size, stored: true };
      } else {
        // Too big (or a folder): remember where it lives instead of copying it.
        file = { path: p, name, size: st.isDirectory() ? null : st.size, stored: false, folder: st.isDirectory() };
        skipped++;
      }
      store.add({ id, kind, hash, pinned: false, createdAt: Date.now(), file });
    } catch {
      // The file vanished or is unreadable. Skip it.
    }
  }
  if (skipped) toast(`${skipped} item(s) were not copied (over ${store.settings.maxFileMB} MB or a folder). Only their location is kept.`);
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    if (isMarkedPrivate()) return;
    const cur = readClipboard();
    if (!cur || cur.sig === lastSig) return;
    lastSig = cur.sig;
    if (store.settings.paused) return;

    if (cur.type === 'text') await saveText(cur.text);
    else if (cur.type === 'image') await saveImage(cur);
    else if (cur.type === 'files') await saveFiles(cur);
    notifyChanged();
  } catch (e) {
    console.error('poll failed:', e.message);
  } finally {
    polling = false;
  }
}

// ---------- putting an item back and pasting it ----------

function fileUrl(p) {
  try {
    return pathToFileURL(p).toString();
  } catch {
    return null;
  }
}

async function putOnClipboard(item) {
  if (item.text != null) {
    clipboard.writeText(item.text);
    return true;
  }
  const f = item.file;
  if (!f || !fs.existsSync(f.path)) {
    toast('That file is no longer on disk.');
    return false;
  }
  if (item.kind === 'image' && !f.folder) {
    const img = nativeImage.createFromPath(f.path);
    if (!img.isEmpty()) {
      clipboard.writeImage(img);
      return true;
    }
  }
  // Files and folders go back as real files, so Explorer and chat apps can paste them.
  // Stored copies are given back under their original name through a temporary copy.
  let target = f.path;
  if (f.stored) {
    const tmpDir = path.join(app.getPath('temp'), 'ClipKeep', item.id);
    fs.mkdirSync(tmpDir, { recursive: true });
    target = path.join(tmpDir, f.name);
    if (!fs.existsSync(target)) fs.copyFileSync(f.path, target);
  }
  const out = await runPowerShell(`Set-Clipboard -LiteralPath ${psQuote(target)}; 'ok'`);
  if (!out) {
    toast('Could not put the file on the clipboard.');
    return false;
  }
  return true;
}

function sendCtrlV() {
  return runPowerShell("(New-Object -ComObject WScript.Shell).SendKeys('^v')", 5000);
}

// Minimises ClipKeep so Windows hands focus back to the app you were using, then presses Ctrl+V there.
function pasteIntoLastApp() {
  if (win && !win.isDestroyed()) win.minimize();
  setTimeout(sendCtrlV, 280);
}

async function copyItem(id, andPaste) {
  const item = store.find(id);
  if (!item) return { ok: false };
  const ok = await putOnClipboard(item);
  if (!ok) return { ok: false };
  // Remember what we just put there so it is not saved a second time.
  const cur = readClipboard();
  if (cur) lastSig = cur.sig;
  store.touch(id);
  notifyChanged();
  if (andPaste) pasteIntoLastApp();
  return { ok: true };
}

// ---------- window, tray, shortcut ----------

function savedBounds() {
  const w = store.settings.window;
  if (!w || !Number.isFinite(w.width) || !Number.isFinite(w.height)) return {};
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return w.x != null && w.x + 100 > a.x && w.x < a.x + a.width - 100 && w.y + 50 > a.y && w.y < a.y + a.height - 50;
  });
  return visible ? { x: w.x, y: w.y, width: w.width, height: w.height } : { width: w.width, height: w.height };
}

function createWindow() {
  const bounds = savedBounds();
  win = new BrowserWindow({
    width: 1020,
    height: 700,
    ...bounds,
    minWidth: 780,
    minHeight: 520,
    show: false,
    title: brand.productName,
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0B1826' : '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (store.settings.window && store.settings.window.maximized) win.maximize();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Remember where the window was and how big.
  let saveTimer = null;
  const remember = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win || win.isDestroyed() || win.isMinimized()) return;
      const maximized = win.isMaximized();
      const b = maximized ? (store.settings.window || {}) : win.getBounds();
      store.setSettings({ window: { x: b.x, y: b.y, width: b.width, height: b.height, maximized } });
    }, 500);
  };
  win.on('resize', remember);
  win.on('move', remember);
  win.on('maximize', remember);
  win.on('unmaximize', remember);

  // The close button hides the window to the tray so capture keeps working, unless the user chose to quit.
  win.on('close', (e) => {
    if (quitting) return;
    if (store.settings.closeToTray) {
      e.preventDefault();
      win.hide();
      if (!store.settings.trayHintShown) {
        store.setSettings({ trayHintShown: true });
        if (IS_WIN && tray) {
          tray.displayBalloon({
            title: `${brand.productName} is still running`,
            content: 'It keeps saving what you copy. Click the tray icon to open it again, or choose Quit there.',
          });
        }
      }
    } else {
      quitting = true;
      app.quit();
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

// Brings the window forward. It never hides on its own.
function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function registerHotkey(accelerator) {
  globalShortcut.unregisterAll();
  try {
    const ok = globalShortcut.register(accelerator, showWindow);
    if (store && store.settings.useWinV) registerWinV();
    return ok ? { ok: true } : { ok: false, error: 'Another app is already using that shortcut.' };
  } catch {
    return { ok: false, error: 'That is not a valid shortcut. Example: Control+Alt+V' };
  }
}

// ---------- optional: use Win+V ----------

function regExec(args) {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve({ ok: false, out: '' });
    execFile('reg', args, { windowsHide: true, timeout: 8000 }, (err, stdout) => resolve({ ok: !err, out: String(stdout || '') }));
  });
}

async function readDisabledHotkeys() {
  const r = await regExec(['query', winv.KEY, '/v', winv.VALUE]);
  return r.ok ? winv.parseRegQuery(r.out) : '';
}

async function writeDisabledHotkeys(letters) {
  if (letters) return (await regExec(['add', winv.KEY, '/v', winv.VALUE, '/t', 'REG_SZ', '/d', letters, '/f'])).ok;
  // Nothing left: remove the value (it is fine if it was never there).
  await regExec(['delete', winv.KEY, '/v', winv.VALUE, '/f']);
  return true;
}

function registerWinV() {
  try {
    if (globalShortcut.isRegistered('Super+V')) return true;
    return globalShortcut.register('Super+V', showWindow);
  } catch {
    return false;
  }
}

async function winvStatus() {
  const letters = await readDisabledHotkeys();
  const on = !!store.settings.useWinV;
  const registered = on && globalShortcut.isRegistered('Super+V');
  return {
    supported: IS_WIN,
    on,
    registered,
    waitingForRestart: on && winv.hasLetter(letters, 'V') && !registered,
  };
}

async function setWinV(on) {
  if (!IS_WIN) return winvStatus();
  const letters = await readDisabledHotkeys();
  if (on) {
    if (!(await writeDisabledHotkeys(winv.addLetter(letters, 'V')))) return { ...(await winvStatus()), error: 'Could not change the Windows setting.' };
    store.setSettings({ useWinV: true });
    registerWinV(); // works straight away only if Windows has already let go of Win+V
  } else {
    globalShortcut.unregister('Super+V');
    await writeDisabledHotkeys(winv.removeLetter(letters, 'V'));
    store.setSettings({ useWinV: false });
  }
  return winvStatus();
}

async function restartExplorer() {
  await runPowerShell('Stop-Process -Name explorer -Force', 8000); // Windows starts it again by itself
  await new Promise((r) => setTimeout(r, 3000));
  if (store.settings.useWinV) registerWinV();
  return winvStatus();
}

function applyStartWithWindows() {
  // Only a packaged install can register itself properly with Windows.
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: !!store.settings.startWithWindows, args: ['--hidden'] });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: `Open ${brand.productName}`, click: showWindow },
    {
      label: 'Pause capture',
      type: 'checkbox',
      checked: store.settings.paused,
      click: (item) => {
        store.setSettings({ paused: item.checked });
        notifyChanged();
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: store.settings.startWithWindows,
      enabled: app.isPackaged,
      click: (item) => {
        store.setSettings({ startWithWindows: item.checked });
        applyStartWithWindows();
      },
    },
    { label: 'Open data folder', click: () => shell.openPath(store.dir) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip(`${brand.productName} by ${brand.company}`);
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', showWindow);
  tray.on('right-click', () => tray.setContextMenu(buildTrayMenu()));
}

// ---------- messages from the popup ----------

function lightItem(it) {
  const isImage = it.kind === 'image' && it.file && !it.file.folder;
  return {
    id: it.id,
    kind: it.kind,
    pinned: !!it.pinned,
    createdAt: it.createdAt,
    preview: it.text != null ? it.text.slice(0, 700) : null,
    length: it.text != null ? it.text.length : null,
    name: it.file ? it.file.name : null,
    size: it.file ? it.file.size : null,
    external: it.file ? !it.file.stored : false,
    thumb: isImage && fs.existsSync(it.file.path) ? fileUrl(it.file.path) : null,
    meta: it.meta || null,
  };
}

function setupIpc() {
  ipcMain.handle('list', (_e, query, filter) => ({
    items: store.search(query || '', filter || 'all').map(lightItem),
    total: store.items.length,
    paused: store.settings.paused,
  }));
  ipcMain.handle('paste', (_e, id) => copyItem(id, true));
  ipcMain.handle('copy', (_e, id) => copyItem(id, false));
  ipcMain.handle('pin', (_e, id) => {
    store.togglePin(id);
    notifyChanged();
  });
  ipcMain.handle('remove', (_e, id) => {
    const ok = store.removeSoft(id);
    notifyChanged();
    return { ok };
  });
  ipcMain.handle('undo-remove', (_e, id) => {
    const ok = store.restore(id);
    notifyChanged();
    return { ok };
  });
  ipcMain.handle('clear', (_e, keepPinned) => {
    store.clear(!!keepPinned);
    notifyChanged();
  });
  ipcMain.handle('settings:get', () => ({ ...store.settings, canAutostart: app.isPackaged, dataDir: store.dir }));
  ipcMain.handle('settings:set', (_e, patch) => {
    const result = { ok: true };
    const clean = {};
    if (typeof patch.paused === 'boolean') clean.paused = patch.paused;
    if (Number.isFinite(patch.maxItems)) clean.maxItems = Math.min(Math.max(Math.round(patch.maxItems), 50), 20000);
    if (Number.isFinite(patch.maxFileMB)) clean.maxFileMB = Math.min(Math.max(Math.round(patch.maxFileMB), 1), 4000);
    if (typeof patch.startWithWindows === 'boolean') clean.startWithWindows = patch.startWithWindows;
    if (typeof patch.welcomed === 'boolean') clean.welcomed = patch.welcomed;
    if (typeof patch.closeToTray === 'boolean') clean.closeToTray = patch.closeToTray;
    if (patch.accent === null) clean.accent = null;
    else if (typeof patch.accent === 'string' && /^#[0-9a-f]{6}$/i.test(patch.accent)) clean.accent = patch.accent.toUpperCase();
    if (['system', 'light', 'dark'].includes(patch.theme)) {
      clean.theme = patch.theme;
      nativeTheme.themeSource = patch.theme;
    }
    if (typeof patch.homeCountry === 'string' && /^[A-Z]{2}$/.test(patch.homeCountry)) clean.homeCountry = patch.homeCountry;
    if (Array.isArray(patch.ignorePatterns)) {
      clean.ignorePatterns = patch.ignorePatterns.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
    }
    if (typeof patch.hotkey === 'string' && patch.hotkey && patch.hotkey !== store.settings.hotkey) {
      const r = registerHotkey(patch.hotkey);
      if (r.ok) clean.hotkey = patch.hotkey;
      else {
        registerHotkey(store.settings.hotkey);
        result.ok = false;
        result.error = r.error;
      }
    }
    store.setSettings(clean);
    if ('startWithWindows' in clean) applyStartWithWindows();
    if (tray) tray.setContextMenu(buildTrayMenu());
    notifyChanged();
    return result;
  });
  // ----- things the popup asks for -----
  ipcMain.handle('winv:status', () => winvStatus());
  ipcMain.handle('winv:set', (_e, on) => setWinV(!!on));
  ipcMain.handle('winv:restart-explorer', () => restartExplorer());
  ipcMain.handle('open-windows-clipboard-settings', () => shell.openExternal('ms-settings:clipboard'));

  ipcMain.handle('app:info', () => ({ brand, version: app.getVersion(), packaged: app.isPackaged }));

  ipcMain.handle('copyText', async (_e, text) => {
    clipboard.writeText(String(text));
    const cur = readClipboard();
    if (cur) lastSig = cur.sig;
    return { ok: true };
  });

  ipcMain.handle('pasteText', async (_e, text) => {
    clipboard.writeText(String(text));
    const cur = readClipboard();
    if (cur) lastSig = cur.sig;
    pasteIntoLastApp();
    return { ok: true };
  });

  ipcMain.handle('openUrl', (_e, kind, value) => {
    const v = String(value || '');
    if (kind === 'whatsapp') {
      const digits = v.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) shell.openExternal(`https://wa.me/${digits}`);
    } else if (kind === 'mailto') {
      if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)) shell.openExternal(`mailto:${v}`);
    } else if (kind === 'link') {
      const url = /^www\./i.test(v) ? 'https://' + v : v;
      if (/^https?:\/\//i.test(url)) shell.openExternal(url.split(/\s/)[0]);
    }
  });

  ipcMain.handle('contacts:list', (_e, query, filter) => store.searchContacts(query || '', filter || 'all').slice(0, 500));
  ipcMain.handle('contacts:rename', (_e, id, name) => store.renameContact(id, name));
  ipcMain.handle('contacts:remove', (_e, id) => store.removeContact(id));
  ipcMain.handle('contacts:restore', (_e, c) => store.restoreContact(c));
  ipcMain.handle('contacts:clear', () => store.clearContacts());

  ipcMain.handle('emoji:get', () => store.emoji);
  ipcMain.handle('emoji:paste', (_e, list) => {
    const arr = (Array.isArray(list) ? list : [list]).map(String).filter(Boolean).slice(0, 40);
    if (!arr.length) return { ok: false };
    arr.forEach((e) => store.emojiUsed(e));
    clipboard.writeText(arr.join(''));
    const cur = readClipboard();
    if (cur) lastSig = cur.sig;
    pasteIntoLastApp();
    return { ok: true };
  });
  ipcMain.handle('emoji:used', (_e, list) => {
    (Array.isArray(list) ? list : [list]).map(String).slice(0, 40).forEach((e) => store.emojiUsed(e));
  });
  ipcMain.handle('emoji:favorite', (_e, e) => {
    store.emojiFavorite(String(e));
    return store.emoji;
  });
  ipcMain.handle('emoji:tone', (_e, n) => {
    store.emojiTone(n);
    return store.emoji;
  });

  ipcMain.handle('palettes:get', () => store.palettes);
  ipcMain.handle('palettes:add', (_e, name) => {
    store.addPalette(name);
    return store.palettes;
  });
  ipcMain.handle('palettes:remove', (_e, id) => {
    store.removePalette(id);
    return store.palettes;
  });
  ipcMain.handle('palettes:addColor', (_e, id, hex) => {
    store.paletteAdd(id, String(hex));
    return store.palettes;
  });
  ipcMain.handle('palettes:removeColor', (_e, id, hex) => {
    store.paletteRemove(id, String(hex));
    return store.palettes;
  });

  ipcMain.handle('open-folder', () => shell.openPath(store.dir));
}

// ---------- startup ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    if (IS_WIN) app.setAppUserModelId('com.brytma.clipkeep');
    store = new Store(path.join(app.getPath('userData'), 'ClipKeep'));
    Menu.setApplicationMenu(null);
    nativeTheme.themeSource = store.settings.theme || 'system';
    setupIpc();
    createWindow();
    createTray();

    const hk = registerHotkey(store.settings.hotkey);
    if (store.settings.useWinV) registerWinV();
    applyStartWithWindows();

    // Treat whatever is on the clipboard at launch as already seen, then watch for changes.
    const first = readClipboard();
    if (first) lastSig = first.sig;
    setInterval(poll, POLL_MS);

    // Open the window on launch, unless Windows started us at sign-in (then stay in the tray).
    if (!process.argv.includes('--hidden')) showWindow();
    if (!hk.ok && IS_WIN && tray) {
      tray.displayBalloon({
        title: `${brand.productName} is running`,
        content: 'The shortcut is taken by another app. Click the tray icon, then change it in Settings.',
      });
    }

  });

  // Keep running in the tray when the popup is hidden.
  app.on('window-all-closed', (e) => e.preventDefault());
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => {
    if (store) store.purgeTrash();
    globalShortcut.unregisterAll();
    if (store) store.flush();
  });
}
