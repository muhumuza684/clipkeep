# Developing ClipKeep

You need [Node.js](https://nodejs.org) 20 or newer and Git.

## Layout

```
windows/   Electron app for Windows (plain JavaScript, no build step for the interface)
phone/     Expo (React Native) app for Android
docs/      User guide, this file, screenshots
.github/   Build checks and the release workflow
```

## Windows app

```
cd windows
npm install
npm start          # run it
npm test           # run the tests
npm run dist       # build the installer and portable app into windows/dist
```

Good to know:

- Electron is pinned to **31.7.7**. Electron 44 and newer removed the clipboard functions the app uses.
- **Every file the app loads must be listed in `build.files` in `windows/package.json`.** A test (`test/packaging.test.js`) and the release workflow both fail if one is missing.
- Names, tagline and contact lines are in `windows/brand.js`. Colours are at the top of `windows/renderer/style.css`.
- Data is kept in `%APPDATA%\ClipKeep\ClipKeep`.
- Phone numbers use `libphonenumber-js`. The emoji and country data in `renderer/data` are generated files.

## Android app

```
cd phone
npm install
npx expo start             # scan the QR code with Expo Go
npx expo run:android       # a development build (needed for the Share menu and Quick save)
```

- Names and contact lines are in `phone/src/brand.js`.
- The Share menu uses `expo-sharing`, which is marked experimental in Expo SDK 57.
- Quick save uses `expo-notifications` and needs the installed app or a development build, not Expo Go.

## Checks

Every push runs **CI**: JavaScript syntax checks, the Windows tests, and a check that the phone app bundles for Android.

## Making a release

Pushing a version tag builds both apps and publishes them:

```
git tag v1.6.3
git push origin v1.6.3
```

The **Release** workflow:

1. creates the GitHub release,
2. builds the Windows installer and portable app and checks the package has every file,
3. builds the Android APK (this job is optional, so a problem there never blocks the Windows release).

The version number in the apps is taken from the tag. File names have no version in them on purpose, so the README download links always point to the newest release:

- `ClipKeep-Setup.exe`
- `ClipKeep-Portable.exe`
- `ClipKeep.apk`

The Windows files are not code-signed, and the Android file is signed with a debug key. Neither is suitable for a store listing yet.
