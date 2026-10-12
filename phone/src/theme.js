import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { getState, subscribe } from './store';
import { inkOn, luminance, mix } from './colour';

// Bryt Ma Tech: navy #042C53, blue #378ADD, neutral #D3D1C7. Flat surfaces, sentence case.
const light = {
  scheme: 'light',
  paper: '#FFFFFF',
  card: '#F6F6F3',
  ink: '#042C53',
  text: '#1C2B3A',
  soft: '#566779',
  line: '#D3D1C7',
  hover: '#F0F3F6',
  select: '#E8F1FB',
  accent: '#378ADD',
  primary: '#1E6FBF',
  primaryInk: '#FFFFFF',
  btn: '#EEF1F4',
  danger: '#B3261E',
};

const dark = {
  scheme: 'dark',
  paper: '#0B1826',
  card: '#102640',
  ink: '#EAF0F7',
  text: '#D8E2ED',
  soft: '#9FB2C6',
  line: '#1F3650',
  hover: '#10243A',
  select: '#12304F',
  accent: '#5AA9F0',
  primary: '#5AA9F0',
  primaryInk: '#042C53',
  btn: '#16304B',
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
