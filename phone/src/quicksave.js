// "Quick save": a notification with a Save button, so one tap from any app keeps what you just copied.
// Android has no default clipboard setting, and apps can only read the clipboard while they are in front.
// The Save button opens ClipKeep for a moment, reads the clipboard, then sends you back.
import { BackHandler, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { captureClipboard } from './capture';

export const quickSaveSupported = Platform.OS === 'android';

const CHANNEL = 'quicksave';
const CATEGORY = 'quicksave';
const ID = 'clipkeep-quicksave';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shows the notification. Returns { ok: true } or { ok: false, reason }.
export async function turnOnQuickSave() {
  if (!quickSaveSupported) return { ok: false, reason: 'unsupported' };
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };

    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Quick save',
      description: 'A Save button for what you just copied',
      importance: Notifications.AndroidImportance.LOW, // quiet: no sound, no pop-up
      showBadge: false,
    });
    await Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: 'save', buttonTitle: 'Save what I copied', options: { opensAppToForeground: true } },
      { identifier: 'open', buttonTitle: 'Open ClipKeep', options: { opensAppToForeground: true } },
    ]);
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: 'Copied something?',
        body: 'Tap Save to keep it in ClipKeep. You go straight back to what you were doing.',
        categoryIdentifier: CATEGORY,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: { channelId: CHANNEL },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function turnOffQuickSave() {
  if (!quickSaveSupported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch {}
}

// Called when the user taps the notification or one of its buttons.
// onDone gets 'added', 'moved' or null (nothing new to save).
export async function handleQuickSaveResponse(response, onDone) {
  if (!response || response.actionIdentifier !== 'save') return;
  // Android only lets an app read the clipboard once its window has focus, so try a few times.
  let result = null;
  for (let i = 0; i < 5 && !result; i++) {
    await sleep(i === 0 ? 450 : 350);
    result = await captureClipboard();
  }
  onDone(result);
  // Go back to the app the user was in.
  if (result) setTimeout(() => BackHandler.exitApp(), 900);
}

export function clearLastResponse() {
  try {
    Notifications.clearLastNotificationResponse();
  } catch {}
}

export { Notifications };
