// Everything that turns "something copied or shared" into a saved history item.
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { addItem, clipsDir, getState, hasHash, noteContacts } from './store';
import { classify, extractContacts } from './smart';
import { extOf, hashString, kindFromMime, newId } from './util';

// Text and images that arrive from the clipboard. Android only lets an app read the
// clipboard while it is open, so this runs when the app comes to the front and while it listens.
export async function captureClipboard() {
  const { settings } = getState();
  if (settings.paused) return null;

  try {
    if (await Clipboard.hasImageAsync()) {
      const img = await Clipboard.getImageAsync({ format: 'png' });
      if (img && img.data) {
        const base64 = img.data.replace(/^data:image\/\w+;base64,/, '');
        const hash = 'img:' + hashString(base64);
        if (hasHash(hash)) return addItemResult(hash);
        const id = newId();
        const file = new File(clipsDir(), `${id}.png`);
        file.create();
        file.write(base64, { encoding: 'base64' });
        const size = file.size;
        return addItem({
          id,
          kind: 'image',
          hash,
          pinned: false,
          createdAt: Date.now(),
          file: { uri: file.uri, name: 'Copied image.png', size, mime: 'image/png' },
        });
      }
    }

    if (await Clipboard.hasStringAsync()) {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        return saveText(text);
      }
    }
  } catch {
    // Reading the clipboard can fail when the app is in the background. Ignore quietly.
  }
  return null;
}

function addItemResult(hash) {
  const existing = getState().items.find((i) => i.hash === hash);
  return existing ? addItem({ ...existing }) : null;
}

export function saveText(text, forceKind) {
  const home = getState().settings.homeCountry;
  const found = classify(text, home);
  const kind = forceKind || found.kind;
  const result = addItem({
    id: newId(),
    kind,
    hash: 'txt:' + hashString(text),
    pinned: false,
    createdAt: Date.now(),
    text,
    meta: forceKind ? null : found.meta,
  });
  // Phone numbers and emails found anywhere in the text go into Contacts.
  noteContacts(extractContacts(text, home));
  return result;
}

// Copies a file (from the picker or a share) into the app's own storage so it survives
// even if the original is moved or deleted. Returns 'added' | 'moved' | 'toobig' | 'failed'.
export async function saveFileFromUri({ uri, name, size, mime }) {
  const { settings } = getState();
  const limit = settings.maxFileMB * 1024 * 1024;
  try {
    const source = new File(uri);
    const realSize = size ?? source.size;
    if (realSize != null && realSize > limit) return 'toobig';

    const hash = `file:${name || 'file'}:${realSize}`;
    if (hasHash(hash)) {
      const existing = getState().items.find((i) => i.hash === hash);
      return addItem({ ...existing });
    }

    const id = newId();
    const dest = new File(clipsDir(), `${id}${extOf(name)}`);
    await source.copy(dest);
    const kind = kindFromMime(mime, 'file');
    return addItem({
      id,
      kind,
      hash,
      pinned: false,
      createdAt: Date.now(),
      file: { uri: dest.uri, name: name || `${id}`, size: realSize, mime: mime || null },
    });
  } catch {
    return 'failed';
  }
}

// "Add file" button: any file, including audio and video.
export async function pickAndSaveFiles() {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets) return { added: 0, tooBig: 0, failed: 0 };
  let added = 0;
  let tooBig = 0;
  let failed = 0;
  for (const a of res.assets) {
    const r = await saveFileFromUri({ uri: a.uri, name: a.name, size: a.size, mime: a.mimeType });
    if (r === 'toobig') tooBig++;
    else if (r === 'failed') failed++;
    else added++;
  }
  return { added, tooBig, failed };
}

// Items other apps send through the Android Share menu ("Share > ClipKeep").
export async function saveSharedPayload(p) {
  if (!p) return 'failed';
  const isTextual = !p.contentUri || p.contentType === 'text';
  if (isTextual) {
    const value = (p.value || '').trim();
    if (!value) return 'failed';
    return saveText(value, p.shareType === 'url' ? 'link' : undefined);
  }
  if (p.contentType === 'website') {
    return saveText(p.value, 'link');
  }
  return saveFileFromUri({
    uri: p.contentUri,
    name: p.originalName || undefined,
    size: p.contentSize ?? undefined,
    mime: p.contentMimeType || p.mimeType,
  });
}
