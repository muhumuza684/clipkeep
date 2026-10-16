# ClipKeep user guide

ClipKeep keeps everything you copy, so you can find it and use it again. This guide covers installing it, using it on your PC and your phone, and fixing common problems.

## Contents

1. [Install on Windows](#install-on-windows)
2. [Install on Android](#install-on-android)
3. [Using ClipKeep on Windows](#using-clipkeep-on-windows)
4. [Using ClipKeep on your phone](#using-clipkeep-on-your-phone)
5. [Tips](#tips)
6. [Privacy and your data](#privacy-and-your-data)
7. [Fixing problems](#fixing-problems)
8. [Keyboard shortcuts](#keyboard-shortcuts)

## Install on Windows

You need Windows 10 or 11 (64-bit).

1. Go to the [latest release](https://github.com/muhumuza684/clipkeep/releases/latest).
2. Download **ClipKeep-Setup.exe** (installs the app) or **ClipKeep-Portable.exe** (runs without installing).
3. Open the file. The app is not code-signed yet, so Windows may say **"Windows protected your PC"**. Choose **More info**, then **Run anyway**.
4. ClipKeep opens. Copy something in any app and it appears in the list.

**Start it with Windows:** use the installed version, open **Settings**, and turn on **Start with Windows**. The portable version is not meant for this.

## Install on Android

1. On your phone, open the [latest release](https://github.com/muhumuza684/clipkeep/releases/latest) and download **ClipKeep.apk**.
2. Open the downloaded file. Android will ask you to allow installing from this source. Allow it for this install.
3. Google Play Protect may warn about an unrecognised app. Tap **More details**, then **Install anyway**.
4. Open ClipKeep.

The file is not from the Play Store, which is why Android asks.

## Using ClipKeep on Windows

ClipKeep is a normal window. It never hides when you click elsewhere. If you close it, it keeps saving from the tray (the arrow near the clock). To quit completely, right-click the tray icon and choose **Quit**.

Press **Ctrl+Alt+V** from any app to bring ClipKeep forward.

### Using what you saved

Every item has labelled buttons:

- **Copy** puts it back on your clipboard. Then press Ctrl+V where you want it.
- **Paste** minimises ClipKeep and types it into the app you were just using.
- **Pin** keeps an item at the top and stops it being removed. **Delete** removes it, and you get an **Undo** button for a few seconds.

Some items have extra buttons:

| You copied | Extra buttons |
|---|---|
| A phone number | **WhatsApp**, **Local format** (the number without the country code) |
| An email | **Write email**, **Copy domain** |
| A colour like `#378ADD` | **RGB**, **HSL**, **Edit colour** |
| A link | **Open link** |

Use the filters (All, Text, Links, Phone numbers, Emails, Colours, Images, Audio and video, Files) and the search box to find things.

### The tabs

- **Clipboard:** everything you copied, newest first.
- **Contacts:** every phone number and email you copied, collected for you and grouped by country, even ones inside a longer message. Use **Add name** to label a contact.
- **Emoji:** search by name, pick a skin tone, and star favourites. Click emoji to build a message: they are copied to your clipboard as you click. **Paste into last app** types them for you.
- **Colours:** pick a colour, use **Pick a colour from the screen**, copy it as HEX, RGB or HSL, and check whether text on it is readable. Save colours in palettes and copy a palette as CSS or JSON.
- **Flags:** search any country by name, code or dial code. Copy the flag, name, dial code or currency.

### Settings

Open **Settings** (top right):

- **Save what I copy:** turn off to pause.
- **Keep running when I close the window:** recommended.
- **Theme** and **Accent colour:** light, dark, or follow Windows, and pick any colour. The **Light / Dark** switch at the top is a shortcut.
- **Shortcut:** change Ctrl+Alt+V if another app uses it.
- **Open with Win+V:** see below.
- **Your country:** numbers typed without a country code, like `0772 123456`, are read as numbers from here (Uganda by default).
- **History size** and **Largest file to copy.**
- **Privacy:** patterns that should never be saved.

### Using Win+V

Windows has no "default clipboard" setting that apps can ask for. Windows' own clipboard history owns **Win+V**. To use Win+V for ClipKeep, turn on **Settings > Open with Win+V**. This switches off Windows' own Win+V shortcut for your account. Windows only lets go of it after Windows Explorer restarts, so press **Restart Windows Explorer now** (your taskbar will flash and open File Explorer windows will close) or sign out and back in. Turn the switch off any time to undo it.

## Using ClipKeep on your phone

Android only lets an app read the clipboard while it is open. So ClipKeep works like this:

1. **Copy** something in any app.
2. **Open ClipKeep.** It saves what you copied automatically. You can also tap **Save what I copied**.
3. Tap **Copy** next to any item to use it again.

Other ways to save things:

- **Share, then ClipKeep:** in a gallery, browser or file manager, use Share and choose ClipKeep. Works for text, links, images, audio, video and files.
- **Add files** (top right) picks files from your phone.
- **Quick save (optional):** turn on **Settings > Quick save in the notification area**. ClipKeep shows a quiet notification with a **Save what I copied** button. Copy in any app, pull down, tap the button, and ClipKeep saves it and takes you back. Android will ask for permission to show notifications.

Items have the same labelled buttons as on Windows, plus **Call** for phone numbers. **Contacts** collects numbers and emails by country with flags. **Settings** has your country, theme (**Follow my phone**, **Light**, **Dark**), an **Accent colour** with a colour picker, history size, and data controls. The moon or sun button at the top switches light and dark.

## Tips

- **Pin** the things you paste often, like an account number or an address.
- Type digits only in the search box to find a phone number: `772` finds `0772 123456`.
- If a phone number is read as the wrong country, set **Your country** in Settings.
- **Delete** is safe: tap **Undo**.
- To clear space, open **Settings > Your data** and clear unpinned items.

## Privacy and your data

- Everything is stored **on your device only**. ClipKeep has no account, no server and no tracking.
- Copies from password managers that mark them private are skipped.
- In Settings you can add patterns (for example `^sk-[a-z0-9]{20,}`) so matching text is never saved.
- Windows keeps its data in `%APPDATA%\ClipKeep\ClipKeep`. **Settings > Open data folder** opens it.
- **Delete everything** in Settings removes your history, saved files and contacts.

## Fixing problems

**Windows says it protected my PC.** The app is not code-signed yet. Choose **More info**, then **Run anyway**.

**Nothing is being saved.** Check the bar at the bottom: it should say "Saving what you copy". If it says Paused, click it. Also check Settings > Save what I copy.

**The Paste button did nothing.** It sends Ctrl+V to the app you were using. It does not work in windows running as administrator. Use **Copy**, then press Ctrl+V yourself.

**The WhatsApp button does not open anything.** It opens a WhatsApp link in your browser or app. Make sure WhatsApp or WhatsApp Web is available.

**Win+V still opens Windows' clipboard.** Press **Restart Windows Explorer now** in Settings, or sign out and back in.

**My phone did not save what I copied.** Android blocks clipboard access unless ClipKeep is open. Open ClipKeep after copying, or tap **Save what I copied**, or use Quick save.

**The Quick save button is not in my notifications.** Check that notifications are allowed for ClipKeep in your phone's settings, and that battery saving is not stopping it.

**Something else.** [Open an issue](https://github.com/muhumuza684/clipkeep/issues) and say what you did and what happened. A screenshot helps.

## Keyboard shortcuts

These are optional. Everything also works with the mouse.

| Keys | What it does (Windows) |
|---|---|
| Ctrl+Alt+V | Bring ClipKeep forward from any app |
| Ctrl+1 to Ctrl+5 | Clipboard, Contacts, Emoji, Colours, Flags |
| Ctrl+6 | Settings |
| Ctrl+F | Search |
| Up, Down | Move through the list |
| Enter | Copy the selected item |
| Delete | Delete the selected item (undo available) |
