# ClipKeep for Android (version 1.2)

Built in Uganda by Bryt Ma Tech.

A clipboard history for your phone. It understands phone numbers, emails and colours. Everything stays on the
phone. No account, no sync.

## Run it

```
npm install
npx expo start
```

Open it in **Expo Go** to try it. In Expo Go you get everything except the Share menu.

## Share menu (recommended)

Receiving things from other apps ("Share > ClipKeep") needs a development build:

```
npx expo run:android
```

After that, in any app choose **Share > ClipKeep** and the text, link, image, audio, video or file lands in
your history.

## How saving works on Android

Android only lets an app read the clipboard while it is open. So after copying something in another app, open
ClipKeep (it saves automatically) or tap **Save what I copied**. For files, use **Add files** or Share.

## What it does

- **Clipboard.** Every item has a visible **Copy** button and the actions that fit it:
  - Phone numbers: flag, country, Call, WhatsApp, Local format
  - Emails: Write email, Copy domain
  - Colours: swatch with Copy hex, RGB, HSL
  - Links: Open link
  - Files, audio and video: Share
  Pin to keep an item, or delete it (an Undo button appears).
- **Contacts.** Every phone number and email you copy is collected, grouped by country with flags. Add names,
  copy, call, WhatsApp or write an email.
- **Appearance.** Choose Light, Dark or Follow my phone, and an accent colour: eight presets, or
  "Pick any colour" for a colour picker (choose a shade, adjust it, or type a hex code). Buttons, highlights and
  the active tab marker use your colour, and the text on buttons adjusts so it stays readable.
- **Settings.** Pause saving, your country (for numbers like 0772 123456, Uganda by default), history size,
  largest file, clear data, and About.

## Not included yet

- A custom keyboard that shows your history inside any app (needs native Android code).
- Emoji picker, colour picker and flags tab (the Windows app has them).
- iOS Share target (disabled in app.json), and syncing with the Windows app.

The Share receiving feature comes from `expo-sharing` and is marked experimental in Expo SDK 57. The phone app
was checked to compile and bundle for Android, but has not been run on a phone by the author.
