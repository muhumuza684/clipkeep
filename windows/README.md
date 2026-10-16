# ClipKeep for Windows (version 1.5.0)

Built in Uganda by Bryt Ma Tech.

A clipboard that keeps everything you copy and finds it again. It understands phone numbers, emails and
colours, and has an emoji picker, a colour picker and a country flags finder. Everything stays on this PC.
No account, no cloud, no internet needed.

## Install and run

You need Node.js 20 or newer. This version uses Electron 31.7.7 (already cached on your PC, so nothing big
is downloaded).

```
npm install
npm start
```

To build an installer: `npm run dist` (the installer appears in `dist/`). "Start with Windows" only works in
the installed app.

## It is a normal window

- It opens like any app, with a title bar, a taskbar button, minimise, maximise and resize.
- **It never hides on its own.** Clicking elsewhere does nothing to it.
- The window remembers its size and position.
- The close button sends it to the tray so it keeps saving what you copy (you get a notice the first time).
  To quit completely: right-click the tray icon and choose Quit, or turn off "Keep running when I close the
  window" in Settings.
- **Ctrl+Alt+V** brings the window forward from any app. It never hides it.

## How to use it

1. Copy anything in any app. It is saved here on its own.
2. On an item, press **Copy**, then press Ctrl+V where you want it.
3. Or press **Paste**: ClipKeep minimises and types the item into the app you were just using.

Every action is a visible, labelled button. Nothing depends on hidden keys or right-clicks.
Deleting shows an **Undo** button for a few seconds.

## The sections (tabs across the top)

- **Clipboard.** Everything you copied, newest first. Filter by Text, Links, Phone numbers, Emails, Colours,
  Images, Audio and video, Files. Phone numbers show a flag, WhatsApp and Local format buttons. Emails show Write
  email and Copy domain. Colours show a swatch with Copy hex, RGB, HSL and Edit colour.
- **Contacts.** Every phone number and email you copy is collected automatically (even ones inside a longer
  message), grouped by country. Add a name, copy, WhatsApp, or write an email.
- **Emoji.** Search by name or browse categories, choose a skin tone, favourite with the star, and click as many
  emoji as you like. They are copied to your clipboard as you click. Emoji newer than Emoji 14 are hidden
  because older Windows cannot draw them.
- **Colours.** A picker with a screen colour picker, HEX / RGB / HSL values, a text contrast check, and saved
  palettes (it starts with the Bryt Ma Tech palette). Copy a palette as CSS or JSON.
- **Flags.** Search any country by name, code (UG) or dial code (256). Copy the flag, name, dial code or currency.
- **Settings.** Pause, start with Windows, close behaviour, appearance, shortcut, your country, history size,
  privacy patterns, your data, keyboard shortcuts and About.

## Colours and themes

Settings > Appearance lets you choose **Light, Dark or Follow Windows**, and an **accent colour** for buttons,
highlights and the marker beside the active section. Pick one of eight presets, type any hex code, or press
"Use the colour from the Colours page" to use whatever you picked there. Very dark accents are lightened
automatically in dark mode so they stay readable. The Bryt Ma Tech wordmark always keeps its brand blue.

Numbers typed without a country code (like 0772 123456) are read as numbers from your country (Uganda by
default, changeable in Settings).

## Keyboard (optional)

| Key | What it does |
|---|---|
| Ctrl+Alt+V | Bring ClipKeep forward from anywhere |
| Ctrl+1 to Ctrl+6 | Switch section |
| Ctrl+F | Search |
| Up / Down | Move through the list |
| Enter | Copy the selected item |
| Delete | Delete the selected item (undo available) |

## Privacy

Copies from password managers that mark their clipboard as private are skipped. In Settings you can also add
patterns (for example `^sk-[a-z0-9]{20,}`) so matching text is never saved. Data is stored in
`%APPDATA%\ClipKeep\ClipKeep` (Settings > Open data folder).

## Rebranding

Names, tagline and contact lines are in `brand.js`. Colours are at the top of `renderer/style.css`.

## Good to know

- The author could not test these on a real Windows PC: copying files from Explorer, the Paste button (it
  sends Ctrl+V through PowerShell, which does not work into windows running as administrator), and the screen
  colour picker. Copy buttons, search, contacts, undo and the window behaviour were tested.
- Electron is pinned to 31.7.7. Electron 44 and newer removed the clipboard functions this app uses.
- Text is pasted as plain text. Formatting is not kept.
- Windows cannot draw flag emoji, so flags are shown as pictures. Copying a flag still copies the emoji.
- Not included: syncing between devices.
