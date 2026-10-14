const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('clip', {
  // history
  list: call('list'),
  paste: call('paste'),
  copy: call('copy'),
  pin: call('pin'),
  remove: call('remove'),
  clear: call('clear'),
  // text helpers
  copyText: call('copyText'),
  pasteText: call('pasteText'),
  openUrl: call('openUrl'),
  undoRemove: call('undo-remove'),
  restoreContact: call('contacts:restore'),
  // contacts
  contacts: call('contacts:list'),
  renameContact: call('contacts:rename'),
  removeContact: call('contacts:remove'),
  clearContacts: call('contacts:clear'),
  // emoji
  emojiState: call('emoji:get'),
  emojiPaste: call('emoji:paste'),
  emojiUsed: call('emoji:used'),
  emojiFavorite: call('emoji:favorite'),
  emojiTone: call('emoji:tone'),
  // palettes
  palettes: call('palettes:get'),
  addPalette: call('palettes:add'),
  removePalette: call('palettes:remove'),
  addColor: call('palettes:addColor'),
  removeColor: call('palettes:removeColor'),
  // Win+V
  winvStatus: call('winv:status'),
  winvSet: call('winv:set'),
  restartExplorer: call('winv:restart-explorer'),
  openWindowsClipboardSettings: call('open-windows-clipboard-settings'),
  // app
  info: call('app:info'),
  getSettings: call('settings:get'),
  setSettings: call('settings:set'),
  hide: call('hide'),
  openFolder: call('open-folder'),
  onChanged: (cb) => ipcRenderer.on('changed', () => cb()),
  onToast: (cb) => ipcRenderer.on('toast', (_e, message) => cb(message)),
});
