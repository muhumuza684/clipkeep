# Changelog

## 1.6.1

- **Fixes a crash on start in the installed and portable Windows apps** ("Cannot find module './winv'"). A file was left out of the package. Versions 1.4.0 and later of the Windows installer and portable app are affected; running from source was fine. The release build now checks that every file is in the package, and a test guards it.

## 1.6.0

**Android**
- **Quick save in the notification area** (Settings, off by default). A quiet notification with a **Save what I copied** button: copy in any app, pull down, tap Save, and ClipKeep keeps it and sends you straight back. Android has no default clipboard setting, so this is the closest safe route.

## 1.5.0

**Both apps**
- A new look: warm paper, a serif ClipKeep title with "Built in Uganda by Bryt Ma Tech" beneath it, rounder buttons, and a Light/Dark switch at the top.
- Contact details in About now show the email only.
- New "Bryt green" accent colour option.

**Windows**
- Sections are now tabs across the top (the sidebar is gone); Settings is a button at the top right.

## 1.4.0

**Both apps**
- The phone app now has the same icon as the Windows app (Android adaptive and themed icons included), and both show the logo in their header.

**Windows**
- Optional **Open with Win+V** setting, with a button to restart Windows Explorer and a shortcut to Windows' own clipboard settings.

**Android**
- "Follow my phone" light and dark mode now works (adds expo-system-ui).
- The About screen shows the real version.

**Repository**
- Added `.gitattributes` so line endings stay consistent on Windows and Linux.

## 1.3.2

- Fix the Windows release build (it failed while preparing update information).
- Update the build workflows to current GitHub Actions and Node 22.

## 1.3.1

First public release.

**Windows**
- A normal window: title bar, taskbar button, resizable, remembers its size and position. It never hides on its own.
- Clipboard history for text, links, images, files, audio and video.
- Phone numbers get a country flag, WhatsApp and Local format buttons. Emails and colours get their own actions.
- Contacts collected automatically from what you copy, grouped by country.
- Emoji picker, colour picker with screen eyedropper and palettes, country flags finder.
- Light, dark and accent colour choices.
- Undo after delete. Pause, privacy patterns, skip password managers.

**Android**
- Clipboard history with phone, email and colour detection, Contacts by country, Share menu support.
- Light, dark and a colour picker for the accent colour.
