import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { getState, subscribe } from './store';
import { inkOn, luminance, mix } from './colour';

// Warm paper, a serif wordmark, quiet lines and one accent colour the user can change.
const light = {
  scheme: 'light',
  paper: '#FBF7EE',
  card: '#F3EDDD',
  ink: '#1B2630',
  text: '#2A3540',
  soft: '#6A7078',
  line: '#E4DBC6',
  hover: '#F7F1E3',
  select: '#E8F1FB',
  accent: '#378ADD',
  primary: '#1E6FBF',
  primaryInk: '#FFFFFF',
  btn: '#EFE8D7',
  danger: '#B3261E',
};

const dark = {
  scheme: 'dark',
  paper: '#12171A',
  card: '#1B2226',
  ink: '#F2EEE4',
  text: '#DAD6CC',
  soft: '#9AA5A3',
  line: '#2B353B',
  hover: '#1F282D',
  select: '#162E43',
  accent: '#6DB3F2',
  primary: '#6DB3F2',
  primaryInk: '#0B1A26',
  btn: '#262F35',
  danger: '#FF8A80',
};

// Light, dark or follow the phone, plus an optional accent colour chosen by the user.
export function useTheme() {
  const system = useColorScheme();
  const { settings } = useSyncExternalStore(subscribe, getState, getState);
  const scheme = settings.theme === 'light' || settings.theme === 'dark' ? settings.theme : system === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? dark : light;
  if (!settings.accent) return base;
  let a = settings.accent;
  if (scheme === 'dark' && luminance(a) < 0.12) a = mix(a, '#FFFFFF', 0.45); // keep it readable on dark
  return { ...base, accent: a, primary: a, primaryInk: inkOn(a), select: mix(a, base.paper, 0.86) };
}
