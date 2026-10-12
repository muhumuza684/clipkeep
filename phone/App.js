import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';

import {
  clearAll,
  clearContacts,
  getState,
  init,
  removeContact,
  removeSoft,
  renameContact,
  restoreContact,
  restoreItem,
  setSetting,
  subscribe,
  togglePin,
} from './src/store';
import { captureClipboard, pickAndSaveFiles, saveSharedPayload } from './src/capture';
import { flagEmoji } from './src/smart';
import COUNTRIES from './src/countries';
import BRAND from './src/brand';
import { formatSize, timeAgo } from './src/util';
import { hexToHsv, hsvToHex, inkOn, isHex } from './src/colour';
import { useTheme } from './src/theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'text', label: 'Text' },
  { key: 'link', label: 'Links' },
  { key: 'phone', label: 'Phone numbers' },
  { key: 'email', label: 'Emails' },
  { key: 'color', label: 'Colours' },
  { key: 'image', label: 'Images' },
  { key: 'media', label: 'Audio and video' },
  { key: 'file', label: 'Files' },
];

const KIND_LABEL = { text: 'Text', link: 'Link', phone: 'Phone number', email: 'Email', color: 'Colour', image: 'Image', audio: 'Audio', video: 'Video', file: 'File' };
const KIND_ICON = { text: 'text-outline', link: 'link-outline', phone: 'person-outline', email: 'mail-outline', color: 'color-palette-outline', image: 'image-outline', audio: 'musical-notes-outline', video: 'videocam-outline', file: 'document-outline' };

const useStore = () => useSyncExternalStore(subscribe, getState, getState);

// The share-target hook needs a build that includes the expo-sharing plugin; Expo Go skips it.
const NO_SHARE = { resolvedSharedPayloads: [], clearSharedPayloads: () => {}, isResolving: false };
function useShareSafe() {
  try {
    return Sharing.useIncomingShare();
  } catch {
    return NO_SHARE;
  }
}

const digitsOf = (s) => String(s).replace(/\D/g, '');

export default function App() {
  const t = useTheme();
  const { ready, items, contacts, settings } = useStore();
  const [tab, setTab] = useState('clipboard');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [cFilter, setCFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countryModal, setCountryModal] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((msg, action) => {
    setToast({ msg, action });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 7000 : 2600);
  }, []);

  useEffect(() => {
    init().then(() => captureClipboard());
  }, []);

  useEffect(() => {
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') captureClipboard();
    });
    let clipSub = null;
    try {
      clipSub = Clipboard.addClipboardListener(() => captureClipboard());
    } catch {}
    return () => {
      appSub.remove();
      if (clipSub) clipSub.remove();
    };
  }, []);

  const { resolvedSharedPayloads, clearSharedPayloads, isResolving } = useShareSafe();
  useEffect(() => {
    if (isResolving || !resolvedSharedPayloads || resolvedSharedPayloads.length === 0) return;
    (async () => {
      let ok = 0;
      let big = 0;
      let bad = 0;
      for (const p of resolvedSharedPayloads) {
        const r = await saveSharedPayload(p);
        if (r === 'toobig') big++;
        else if (r === 'failed') bad++;
        else ok++;
      }
      clearSharedPayloads();
      say(summary(ok, big, bad, settings.maxFileMB));
    })();
  }, [resolvedSharedPayloads, isResolving]);

  // ---------- actions ----------

  const copied = (what) => say(`${what || 'Copied'}. Paste it where you need it.`);
  const copyText = async (text, what) => {
    await Clipboard.setStringAsync(String(text));
    copied(what);
  };

  async function copyItem(item) {
    try {
      if (item.kind === 'phone' && item.meta) return copyText(item.meta.e164, 'Number copied');
      if (item.kind === 'email' && item.meta) return copyText(item.meta.address, 'Email copied');
      if (item.kind === 'color' && item.meta) return copyText(item.meta.hex, 'Hex copied');
      if (item.text != null) return copyText(item.text);
      if (item.kind === 'image') {
        const b64 = await new File(item.file.uri).base64();
        await Clipboard.setImageAsync(b64);
        return copied('Image copied');
      }
      await Sharing.shareAsync(item.file.uri, { mimeType: item.file.mime || undefined });
    } catch {
      say('This item could not be copied. Try Share instead.');
    }
  }

  async function shareItem(item) {
    try {
      await Sharing.shareAsync(item.file.uri, { mimeType: item.file.mime || undefined });
    } catch {
      say('Sharing failed');
    }
  }

  const open = (url) => Linking.openURL(url).catch(() => say('Nothing on this phone can open that.'));

  function deleteItem(item) {
    removeSoft(item.id);
    say('Item deleted', { label: 'Undo', run: () => restoreItem(item.id) });
  }

  function deleteContact(c) {
    const removed = removeContact(c.id);
    say('Contact removed', { label: 'Undo', run: () => restoreContact(removed || c) });
  }

  async function saveNow() {
    const r = await captureClipboard();
    if (r === 'added') say('Saved what you copied');
    else if (r === 'moved') say('That was already saved. Moved it to the top.');
    else say('Nothing new to save. Copy something first, then come back.');
  }

  async function addFiles() {
    const r = await pickAndSaveFiles();
    if (r.added + r.tooBig + r.failed > 0) say(summary(r.added, r.tooBig, r.failed, settings.maxFileMB));
  }

  async function onRefresh() {
    setRefreshing(true);
    await captureClipboard();
    setRefreshing(false);
  }

  // ---------- lists ----------

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = items.filter((i) => {
      if (filter === 'media' && i.kind !== 'audio' && i.kind !== 'video') return false;
      if (filter !== 'all' && filter !== 'media' && i.kind !== filter) return false;
      if (!q.length) return true;
      let hay = ((i.text || '') + ' ' + (i.file ? i.file.name : '')).toLowerCase();
      if (i.meta) hay += ' ' + Object.values(i.meta).filter((v) => typeof v === 'string').join(' ').toLowerCase();
      const digits = hay.replace(/\D/g, '');
      return q.every((w) => hay.includes(w) || (/^\d+$/.test(w) && digits.includes(w)));
    });
    return [...list.filter((i) => i.pinned), ...list.filter((i) => !i.pinned)];
  }, [items, query, filter]);

  const contactSections = useMemo(() => {
    const q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = contacts
      .filter((c) => {
        if (cFilter === 'phone' && c.type !== 'phone') return false;
        if (cFilter === 'email' && c.type !== 'email') return false;
        if (!q.length) return true;
        const hay = [c.name, c.display, c.value, c.national, c.countryName, c.domain].filter(Boolean).join(' ').toLowerCase();
        const digits = hay.replace(/\D/g, '');
        return q.every((w) => hay.includes(w) || (/^\d+$/.test(w) && digits.includes(w)));
      })
      .sort((a, b) => b.lastSeen - a.lastSeen);
    const byCountry = new Map();
    const emails = [];
    for (const c of list) {
      if (c.type === 'email') emails.push(c);
      else {
        if (!byCountry.has(c.country)) byCountry.set(c.country, []);
        byCountry.get(c.country).push(c);
      }
    }
    const rows = [];
    for (const [code, arr] of [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length)) {
      rows.push({ header: true, key: 'h' + code, title: `${flagEmoji(code)}  ${arr[0].countryName || (COUNTRIES[code] && COUNTRIES[code][0]) || code}`, count: arr.length });
      arr.forEach((c) => rows.push({ key: c.id, c }));
    }
    if (emails.length) {
      rows.push({ header: true, key: 'hemail', title: 'Email addresses', count: emails.length });
      emails.forEach((c) => rows.push({ key: c.id, c }));
    }
    return rows;
  }, [contacts, query, cFilter]);

  const s = styles(t);
  const top = Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 50;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, { paddingTop: top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.product}>{BRAND.productName}</Text>
          <Text style={s.byline}>
            by <Text style={s.wordmark}>{BRAND.company}</Text>
          </Text>
        </View>
        {tab === 'clipboard' && <Btn t={t} label="Add files" icon="add-circle-outline" onPress={addFiles} onDark />}
      </View>

      {tab !== 'settings' && (
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={18} color={t.soft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'clipboard' ? 'Search what you copied' : 'Search names, numbers, emails or countries'}
            placeholderTextColor={t.soft}
            style={s.search}
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={10}>
              <Ionicons name="close" size={20} color={t.soft} />
            </Pressable>
          )}
        </View>
      )}

      {tab === 'clipboard' && (
        <>
          <Chips t={t} defs={FILTERS} value={filter} onPick={setFilter} />
          <FlatList
            data={visible}
            keyExtractor={(i) => i.id}
            refreshing={refreshing}
            onRefresh={onRefresh}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            ListHeaderComponent={
              <View>
                {settings.paused && (
                  <Pressable style={s.pausedBar} onPress={() => setSetting('paused', false)}>
                    <Text style={s.pausedText}>Saving is paused. Tap here to start again.</Text>
                  </Pressable>
                )}
                <View style={s.saveBox}>
                  <Text style={s.saveText}>Copied something in another app?</Text>
                  <Btn t={t} label="Save what I copied" icon="download-outline" primary onPress={saveNow} />
                </View>
                {!settings.tipDismissed && (
                  <View style={s.tip}>
                    <Text style={s.tipTitle}>How it works</Text>
                    <Text style={s.tipLine}>1. Copy anything in any app.</Text>
                    <Text style={s.tipLine}>2. Open ClipKeep, or tap Save what I copied. You can also use Share, then ClipKeep.</Text>
                    <Text style={s.tipLine}>3. Tap Copy on any item to use it again.</Text>
                    <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <Btn t={t} label="Got it" onPress={() => setSetting('tipDismissed', true)} />
                    </View>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              ready ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>{items.length ? 'Nothing matches your search' : 'Nothing saved yet'}</Text>
                  <Text style={s.emptyBody}>{items.length ? 'Try different words, or choose All.' : 'Copy something, then tap Save what I copied.'}</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ItemRow
                t={t}
                item={item}
                onCopy={() => copyItem(item)}
                onShare={() => shareItem(item)}
                onPin={() => togglePin(item.id)}
                onDelete={() => deleteItem(item)}
                onOpen={open}
                copyText={copyText}
                onEditColour={() => {}}
              />
            )}
          />
        </>
      )}

      {tab === 'contacts' && (
        <>
          <Chips
            t={t}
            defs={[{ key: 'all', label: 'All' }, { key: 'phone', label: 'Phone numbers' }, { key: 'email', label: 'Emails' }]}
            value={cFilter}
            onPick={setCFilter}
          />
          <FlatList
            data={contactSections}
            keyExtractor={(r) => r.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>{query ? 'No contacts match your search' : 'No contacts yet'}</Text>
                <Text style={s.emptyBody}>{query ? 'Try a name, a number, or a country.' : 'Copy a phone number or an email address and it is kept here, grouped by country.'}</Text>
              </View>
            }
            renderItem={({ item: r }) =>
              r.header ? (
                <View style={s.groupHead}>
                  <Text style={s.groupTitle}>{r.title}</Text>
                  <Text style={s.groupCount}>{r.count}</Text>
                </View>
              ) : (
                <ContactRow
                  t={t}
                  c={r.c}
                  editing={renaming === r.c.id}
                  onEdit={() => setRenaming(r.c.id)}
                  onDone={(name) => {
                    if (name != null) renameContact(r.c.id, name);
                    setRenaming(null);
                  }}
                  onRemove={() => deleteContact(r.c)}
                  onOpen={open}
                  copyText={copyText}
                />
              )
            }
          />
        </>
      )}

      {tab === 'settings' && (
        <SettingsScreen t={t} settings={settings} count={items.length} contactCount={contacts.length} onCountry={() => setCountryModal(true)} onAccent={() => setPickerOpen(true)} say={say} />
      )}

      {toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast.msg}</Text>
          {toast.action && (
            <Pressable
              onPress={() => {
                toast.action.run();
                setToast(null);
              }}
              style={s.toastBtn}
            >
              <Text style={s.toastBtnText}>{toast.action.label}</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={s.tabBar}>
        {[['clipboard', 'Clipboard', 'clipboard-outline'], ['contacts', 'Contacts', 'people-outline'], ['settings', 'Settings', 'settings-outline']].map(([key, label, ic]) => (
          <Pressable key={key} style={[s.tabBtn, tab === key && s.tabOn]} onPress={() => { setTab(key); setQuery(''); }} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Ionicons name={ic} size={22} color={tab === key ? t.ink : t.soft} />
            <Text style={[s.tabLabel, tab === key && s.tabLabelOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <AccentPicker
        t={t}
        visible={pickerOpen}
        current={settings.accent}
        onClose={() => setPickerOpen(false)}
        onUse={(hex) => {
          setSetting('accent', hex);
          setPickerOpen(false);
          say(hex ? `Accent colour set to ${hex}` : 'Back to the Bryt Ma Tech blue');
        }}
      />
      <CountryModal
        t={t}
        visible={countryModal}
        current={settings.homeCountry}
        onClose={() => setCountryModal(false)}
        onPick={(code) => {
          setSetting('homeCountry', code);
          setCountryModal(false);
          say('Your country is saved');
        }}
      />
    </View>
  );
}

function summary(ok, big, bad, maxMB) {
  const parts = [];
  if (ok) parts.push(ok === 1 ? 'Saved 1 item' : `Saved ${ok} items`);
  if (big) parts.push(`${big} over the ${maxMB} MB limit`);
  if (bad) parts.push(`${bad} could not be read`);
  return parts.join('. ') || 'Nothing to save';
}

// ---------- small components ----------

function Btn({ t, label, icon, onPress, primary, danger, iconOnly, onDark, active }) {
  const s = styles(t);
  const color = primary ? t.primaryInk : onDark ? '#FFFFFF' : danger ? t.danger : active ? t.accent : t.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.btn, primary && s.btnPrimary, onDark && s.btnOnDark, iconOnly && s.btnIcon, pressed && { opacity: 0.7 }]}
    >
      {!!icon && <Ionicons name={icon} size={17} color={color} />}
      {!iconOnly && <Text style={[s.btnText, { color }]}>{label}</Text>}
    </Pressable>
  );
}

function Chips({ t, defs, value, onPick }) {
  const s = styles(t);
  return (
    <View style={{ height: 46 }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={defs}
        keyExtractor={(d) => d.key}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
        renderItem={({ item: d }) => (
          <Pressable onPress={() => onPick(d.key)} style={[s.chip, value === d.key && s.chipOn]} accessibilityState={{ selected: value === d.key }}>
            <Text style={[s.chipText, value === d.key && s.chipTextOn]}>{d.label}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function ItemRow({ t, item, onCopy, onShare, onPin, onDelete, onOpen, copyText }) {
  const s = styles(t);
  const m = item.meta;
  let title = item.text;
  const sub = [KIND_LABEL[item.kind]];
  const extra = [];
  let lead = <Ionicons name={KIND_ICON[item.kind] || 'text-outline'} size={24} color={t.soft} />;

  if (item.kind === 'phone' && m) {
    title = m.international;
    sub.push(m.countryName);
    if (m.national) sub.push(`Local: ${m.national}`);
    lead = <Text style={{ fontSize: 28 }}>{flagEmoji(m.country)}</Text>;
    extra.push(<Btn key="call" t={t} label="Call" icon="call-outline" onPress={() => onOpen(`tel:${m.e164}`)} />);
    extra.push(<Btn key="wa" t={t} label="WhatsApp" icon="logo-whatsapp" onPress={() => onOpen(`https://wa.me/${digitsOf(m.e164)}`)} />);
    extra.push(<Btn key="loc" t={t} label="Local format" icon="copy-outline" onPress={() => copyText(m.national, 'Copied')} />);
  } else if (item.kind === 'email' && m) {
    title = m.address;
    sub.push(`Domain: ${m.domain}`);
    extra.push(<Btn key="mail" t={t} label="Write email" icon="mail-outline" onPress={() => onOpen(`mailto:${m.address}`)} />);
    extra.push(<Btn key="dom" t={t} label="Copy domain" icon="copy-outline" onPress={() => copyText(m.domain, 'Domain copied')} />);
  } else if (item.kind === 'color' && m) {
    title = m.hex;
    sub.push(m.rgb);
    sub.push(m.hsl);
    lead = <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: m.rgb, borderWidth: 1, borderColor: t.line }} />;
    extra.push(<Btn key="rgb" t={t} label="RGB" icon="copy-outline" onPress={() => copyText(m.rgb, 'RGB copied')} />);
    extra.push(<Btn key="hsl" t={t} label="HSL" icon="copy-outline" onPress={() => copyText(m.hsl, 'HSL copied')} />);
  } else if (item.kind === 'link') {
    extra.push(<Btn key="open" t={t} label="Open link" icon="open-outline" onPress={() => onOpen(/^www\./i.test(item.text) ? 'https://' + item.text : item.text.trim())} />);
  } else if (item.file) {
    title = item.file.name;
    if (item.file.size != null) sub.push(formatSize(item.file.size));
    if (item.kind === 'image') lead = <Image source={{ uri: item.file.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} />;
    extra.push(<Btn key="share" t={t} label="Share" icon="open-outline" onPress={onShare} />);
  }
  if (item.pinned) sub.push('Pinned');
  sub.push(timeAgo(item.createdAt));

  const copyLabel = item.kind === 'phone' ? 'Copy number' : item.kind === 'email' ? 'Copy email' : item.kind === 'color' ? 'Copy hex' : 'Copy';
  return (
    <Pressable onPress={onCopy} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hover }]}>
      <View style={s.rowTop}>
        <View style={s.lead}>{lead}</View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle} numberOfLines={3}>
            {title}
          </Text>
          <Text style={s.rowSub}>{sub.join('    ')}</Text>
        </View>
      </View>
      <View style={s.rowBtns}>
        <Btn t={t} label={copyLabel} icon="copy-outline" primary onPress={onCopy} />
        {extra}
        <Btn t={t} label={item.pinned ? 'Unpin' : 'Pin to keep it'} icon={item.pinned ? 'pin' : 'pin-outline'} iconOnly active={item.pinned} onPress={onPin} />
        <Btn t={t} label="Delete" icon="trash-outline" iconOnly danger onPress={onDelete} />
      </View>
    </Pressable>
  );
}

function ContactRow({ t, c, editing, onEdit, onDone, onRemove, onOpen, copyText }) {
  const s = styles(t);
  const [text, setText] = useState(c.name || '');
  const isPhone = c.type === 'phone';
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <View style={s.lead}>{isPhone ? <Text style={{ fontSize: 28 }}>{flagEmoji(c.country)}</Text> : <Ionicons name="mail-outline" size={24} color={t.soft} />}</View>
        <View style={{ flex: 1 }}>
          {editing ? (
            <TextInput value={text} onChangeText={setText} autoFocus placeholder="Type a name for this contact" placeholderTextColor={t.soft} style={s.rename} onSubmitEditing={() => onDone(text)} maxLength={80} />
          ) : (
            <Text style={s.rowTitle} numberOfLines={2}>
              {c.name || c.display}
            </Text>
          )}
          <Text style={s.rowSub}>
            {[isPhone ? 'Phone number' : 'Email', c.name ? c.display : null, isPhone && c.national ? `Local: ${c.national}` : null, c.count === 1 ? 'Copied once' : `Copied ${c.count} times`, timeAgo(c.lastSeen)].filter(Boolean).join('    ')}
          </Text>
        </View>
      </View>
      <View style={s.rowBtns}>
        {editing ? (
          <>
            <Btn t={t} label="Save name" icon="checkmark" primary onPress={() => onDone(text)} />
            <Btn t={t} label="Cancel" icon="close" onPress={() => onDone(null)} />
          </>
        ) : (
          <>
            <Btn t={t} label={isPhone ? 'Copy number' : 'Copy email'} icon="copy-outline" primary onPress={() => copyText(c.value, isPhone ? 'Number copied' : 'Email copied')} />
            {isPhone ? (
              <>
                <Btn t={t} label="Call" icon="call-outline" onPress={() => onOpen(`tel:${c.value}`)} />
                <Btn t={t} label="WhatsApp" icon="logo-whatsapp" onPress={() => onOpen(`https://wa.me/${digitsOf(c.value)}`)} />
              </>
            ) : (
              <Btn t={t} label="Write email" icon="mail-outline" onPress={() => onOpen(`mailto:${c.value}`)} />
            )}
            <Btn t={t} label={c.name ? 'Rename' : 'Add name'} icon="create-outline" onPress={onEdit} />
            <Btn t={t} label="Remove contact" icon="trash-outline" iconOnly danger onPress={onRemove} />
          </>
        )}
      </View>
    </View>
  );
}

function SettingsScreen({ t, settings, count, contactCount, onCountry, onAccent, say }) {
  const s = styles(t);
  const Choice = ({ value, current, label, onPick }) => (
    <Pressable onPress={() => onPick(value)} style={[s.chip, current === value && s.chipOn]}>
      <Text style={[s.chipText, current === value && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
  const country = COUNTRIES[settings.homeCountry];
  return (
    <FlatList
      data={[1]}
      keyExtractor={() => 's'}
      contentContainerStyle={{ paddingBottom: 30 }}
      renderItem={() => (
        <View>
          <View style={s.setGroup}>
            <Text style={s.setHead}>General</Text>
            <View style={s.setRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.setTitle}>Save what I copy</Text>
                <Text style={s.setNote}>Turn off to pause. Nothing new is saved while it is off.</Text>
              </View>
              <Switch value={!settings.paused} onValueChange={(v) => setSetting('paused', !v)} trackColor={{ true: t.accent }} />
            </View>
            <View style={s.setRowCol}>
              <Text style={s.setTitle}>Your country</Text>
              <Text style={s.setNote}>Numbers typed without a country code, like 0772 123456, are read as numbers from here.</Text>
              <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                <Btn t={t} label={country ? `${flagEmoji(settings.homeCountry)}  ${country[0]} (+${country[1]})` : 'Choose a country'} icon="create-outline" onPress={onCountry} />
              </View>
            </View>
          </View>

          <View style={s.setGroup}>
            <Text style={s.setHead}>Appearance</Text>
            <View style={s.setRowCol}>
              <Text style={s.setTitle}>Theme</Text>
              <Text style={s.setNote}>Light, dark, or follow your phone.</Text>
              <View style={s.choiceRow}>
                {[['system', 'Follow my phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, label]) => (
                  <Choice key={v} value={v} current={settings.theme || 'system'} label={label} onPick={(x) => setSetting('theme', x)} />
                ))}
              </View>
            </View>
            <View style={s.setRowCol}>
              <Text style={s.setTitle}>Accent colour</Text>
              <Text style={s.setNote}>Used for buttons, highlights and the marker on the active tab.</Text>
              <View style={s.choiceRow}>
                {ACCENT_PRESETS.map(([hex, name]) => {
                  const on = (settings.accent || ACCENT_PRESETS[0][0]).toUpperCase() === hex;
                  return (
                    <Pressable
                      key={hex}
                      onPress={() => setSetting('accent', hex === ACCENT_PRESETS[0][0] ? null : hex)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${name} as the accent colour`}
                      accessibilityState={{ selected: on }}
                      style={[s.swatch, { backgroundColor: hex }, on && { borderColor: t.ink, borderWidth: 3 }]}
                    />
                  );
                })}
              </View>
              <View style={{ alignSelf: 'flex-start', marginTop: 10 }}>
                <Btn t={t} label="Pick any colour" icon="color-palette-outline" onPress={onAccent} />
              </View>
            </View>
          </View>

          <View style={s.setGroup}>
            <Text style={s.setHead}>History</Text>
            <View style={s.setRowCol}>
              <Text style={s.setTitle}>How many items to keep</Text>
              <Text style={s.setNote}>The oldest unpinned items go first. Pinned items are always kept.</Text>
              <View style={s.choiceRow}>
                {[100, 500, 1000, 2000].map((n) => (
                  <Choice key={n} value={n} current={settings.maxItems} label={`${n}`} onPick={(v) => setSetting('maxItems', v)} />
                ))}
              </View>
            </View>
            <View style={s.setRowCol}>
              <Text style={s.setTitle}>Largest file to keep</Text>
              <Text style={s.setNote}>Bigger audio, video and files are skipped.</Text>
              <View style={s.choiceRow}>
                {[10, 50, 200, 500].map((n) => (
                  <Choice key={n} value={n} current={settings.maxFileMB} label={`${n} MB`} onPick={(v) => setSetting('maxFileMB', v)} />
                ))}
              </View>
            </View>
          </View>

          <View style={s.setGroup}>
            <Text style={s.setHead}>Your data</Text>
            <Text style={s.setNote}>{count} saved items and {contactCount} contacts, kept on this phone only.</Text>
            <View style={s.choiceRow}>
              <Btn t={t} label="Clear unpinned items" icon="trash-outline" danger onPress={() => Alert.alert('Clear history?', 'Pinned items stay. This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { clearAll({ keepPinned: true }); say('Unpinned items cleared'); } }])} />
              <Btn t={t} label="Clear contacts" icon="trash-outline" danger onPress={() => Alert.alert('Clear contacts?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { clearContacts(); say('Contacts cleared'); } }])} />
              <Btn t={t} label="Delete everything" icon="trash-outline" danger onPress={() => Alert.alert('Delete everything?', 'This also removes pinned items and saved files.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete all', style: 'destructive', onPress: () => { clearAll({ keepPinned: false }); clearContacts(); say('Everything deleted'); } }])} />
            </View>
          </View>

          <View style={s.setGroup}>
            <Text style={s.setHead}>About</Text>
            <Text style={s.wordmarkBig}>{BRAND.company}</Text>
            <Text style={s.setNote}>{BRAND.productName} version 1.2</Text>
            <Text style={s.setNote}>{BRAND.tagline}. {BRAND.builtIn}.</Text>
            <Text style={s.setNote}>{BRAND.privacy}</Text>
            <Text style={s.setNote}>WhatsApp {BRAND.contact.whatsapp}</Text>
            <Text style={s.setNote}>{BRAND.contact.email}</Text>
            <Text style={s.setNote}>TikTok {BRAND.contact.tiktok}</Text>
            <Text style={[s.setNote, { marginTop: 10 }]}>
              Android only lets an app read the clipboard while it is open. Tap Save what I copied after copying, or use Share, then ClipKeep.
            </Text>
          </View>
        </View>
      )}
    />
  );
}


const ACCENT_PRESETS = [['#1E6FBF', 'Bryt Ma Tech blue'], ['#042C53', 'Navy'], ['#639922', 'Green'], ['#BA7517', 'Amber'], ['#B4569A', 'Plum'], ['#2F8F8F', 'Teal'], ['#C2362F', 'Red'], ['#5B6B7D', 'Slate']];

// A simple colour picker built from tappable colour cells, so it needs no extra libraries.
function AccentPicker({ t, visible, current, onClose, onUse }) {
  const s = styles(t);
  const start = current || '#1E6FBF';
  const [hsv, setHsv] = useState(hexToHsv(start));
  const [text, setText] = useState(start);
  const [w, setW] = useState(300);
  const COLS = 12;
  const ROWS = 9;
  const SV_H = 180;

  useEffect(() => {
    if (visible) {
      const h = hexToHsv(start);
      setHsv(h);
      setText(hsvToHex(h.h, h.s, h.v));
    }
  }, [visible]);

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const update = (next) => {
    setHsv(next);
    setText(hsvToHex(next.h, next.s, next.v));
  };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const pickHue = (x) => update({ ...hsv, h: clamp((x / w) * 360, 0, 359.9) });
  const pickSV = (x, y) => {
    const col = clamp(Math.floor((x / w) * COLS), 0, COLS - 1);
    const row = clamp(Math.floor((y / SV_H) * ROWS), 0, ROWS - 1);
    update({ ...hsv, s: col / (COLS - 1), v: 1 - (row / (ROWS - 1)) * 0.8 });
  };
  const selCol = Math.round(hsv.s * (COLS - 1));
  const selRow = Math.round(((1 - hsv.v) / 0.8) * (ROWS - 1));
  const touch = (fn) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (e) => fn(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onResponderMove: (e) => fn(e.nativeEvent.locationX, e.nativeEvent.locationY),
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 54 }]}>
        <View style={[s.header, { backgroundColor: t.paper, paddingTop: 10 }]}>
          <Text style={[s.product, { color: t.ink, fontSize: 20, flex: 1 }]}>Pick an accent colour</Text>
          <Btn t={t} label="Close" icon="close" onPress={onClose} />
        </View>
        <View style={{ padding: 16 }} onLayout={(e) => setW(e.nativeEvent.layout.width - 32)}>
          <Text style={s.setTitle}>1. Choose a shade</Text>
          <View style={{ width: w, height: 30, marginTop: 8, marginBottom: 16, borderRadius: 6, overflow: 'hidden' }} {...touch((x) => pickHue(x))}>
            <View pointerEvents="none" style={{ flexDirection: 'row', flex: 1 }}>
              {Array.from({ length: 36 }, (_, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: hsvToHex(i * 10 + 5, 1, 1) }} />
              ))}
            </View>
            <View pointerEvents="none" style={[s.marker, { left: (hsv.h / 360) * w - 3, top: 0, bottom: 0, width: 6, borderRadius: 3 }]} />
          </View>

          <Text style={s.setTitle}>2. Make it lighter, darker or stronger</Text>
          <View style={{ width: w, height: SV_H, marginTop: 8, borderRadius: 6, overflow: 'hidden' }} {...touch(pickSV)}>
            <View pointerEvents="none" style={{ flex: 1 }}>
              {Array.from({ length: ROWS }, (_, r) => (
                <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
                  {Array.from({ length: COLS }, (_, c) => (
                    <View key={c} style={{ flex: 1, backgroundColor: hsvToHex(hsv.h, c / (COLS - 1), 1 - (r / (ROWS - 1)) * 0.8) }} />
                  ))}
                </View>
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[s.marker, { width: 22, height: 22, borderRadius: 11, left: ((selCol + 0.5) / COLS) * w - 11, top: ((selRow + 0.5) / ROWS) * SV_H - 11 }]}
            />
          </View>

          <Text style={[s.setTitle, { marginTop: 16 }]}>3. Or type a hex code</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: hex, borderWidth: 1, borderColor: t.line }} />
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                const withHash = v.startsWith('#') ? v : '#' + v;
                if (isHex(withHash)) setHsv(hexToHsv(withHash));
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={[s.rename, { flex: 1, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo' }]}
              accessibilityLabel="Accent colour as a hex code"
            />
          </View>

          <View style={{ marginTop: 16, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
            <Text style={s.setNote}>Preview</Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 16, height: 40, borderRadius: 8, justifyContent: 'center', backgroundColor: hex }}>
              <Text style={{ color: inkOn(hex), fontWeight: '700' }}>Copy</Text>
            </View>
          </View>

          <View style={[s.choiceRow, { marginTop: 18 }]}>
            <Btn t={t} label="Use this colour" icon="checkmark" primary onPress={() => onUse(hex)} />
            <Btn t={t} label="Reset to default" onPress={() => onUse(null)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CountryModal({ t, visible, current, onClose, onPick }) {
  const s = styles(t);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return Object.entries(COUNTRIES)
      .filter(([code, [name, dial]]) => !w || `${name} ${code} +${dial}`.toLowerCase().includes(w))
      .sort((a, b) => a[1][0].localeCompare(b[1][0]));
  }, [q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 54 }]}>
        <View style={[s.header, { backgroundColor: t.paper, paddingTop: 10 }]}>
          <Text style={[s.product, { color: t.ink, fontSize: 20 }]}>Choose your country</Text>
          <Btn t={t} label="Close" icon="close" onPress={onClose} />
        </View>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={18} color={t.soft} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search a country or dial code" placeholderTextColor={t.soft} style={s.search} autoCorrect={false} />
        </View>
        <FlatList
          data={list}
          keyExtractor={([code]) => code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: [code, [name, dial]] }) => (
            <Pressable onPress={() => onPick(code)} style={[s.countryRow, code === current && { backgroundColor: t.hover }]}>
              <Text style={{ fontSize: 24 }}>{flagEmoji(code)}</Text>
              <Text style={s.countryName}>{name}</Text>
              <Text style={s.countryDial}>+{dial}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.paper },
    header: { backgroundColor: '#042C53', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    product: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
    byline: { color: '#C4D3E4', fontSize: 13, marginTop: 1 },
    wordmark: { color: '#FFFFFF', fontWeight: '700', textDecorationLine: 'underline', textDecorationColor: '#378ADD' },
    wordmarkBig: { color: t.ink, fontSize: 18, fontWeight: '700', textDecorationLine: 'underline', textDecorationColor: '#378ADD', marginVertical: 6 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, height: 44, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.card },
    search: { flex: 1, color: t.ink, fontSize: 16, paddingVertical: 0 },
    chip: { paddingHorizontal: 14, height: 34, borderRadius: 999, borderWidth: 1, borderColor: t.line, justifyContent: 'center' },
    chipOn: { backgroundColor: t.ink, borderColor: t.ink },
    chipText: { color: t.ink, fontWeight: '600', fontSize: 14 },
    chipTextOn: { color: t.paper },
    btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: t.btn },
    btnPrimary: { backgroundColor: t.primary },
    btnOnDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
    btnIcon: { width: 38, paddingHorizontal: 0, justifyContent: 'center' },
    btnText: { fontWeight: '600', fontSize: 14 },
    pausedBar: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 8, backgroundColor: t.danger },
    pausedText: { color: '#fff', fontWeight: '700' },
    saveBox: { marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, gap: 10 },
    saveText: { color: t.ink, fontWeight: '600', fontSize: 15 },
    tip: { marginHorizontal: 16, marginBottom: 10, padding: 14, borderLeftWidth: 4, borderLeftColor: t.accent, backgroundColor: t.select },
    tipTitle: { color: t.ink, fontWeight: '700', marginBottom: 4 },
    tipLine: { color: t.text, lineHeight: 21 },
    row: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
    rowTop: { flexDirection: 'row', gap: 12 },
    lead: { width: 48, height: 48, borderRadius: 8, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    rowTitle: { color: t.ink, fontSize: 16, fontWeight: '600' },
    rowSub: { color: t.soft, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
    rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    rename: { borderWidth: 1, borderColor: t.accent, borderRadius: 8, paddingHorizontal: 10, height: 40, color: t.ink, fontSize: 16 },
    groupHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: t.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
    groupTitle: { flex: 1, color: t.ink, fontWeight: '700', fontSize: 15 },
    groupCount: { color: t.soft, fontWeight: '600' },
    empty: { paddingTop: 50, paddingHorizontal: 28, alignItems: 'center' },
    emptyTitle: { color: t.ink, fontSize: 18, fontWeight: '700', marginBottom: 6 },
    emptyBody: { color: t.soft, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    toast: { position: 'absolute', left: 16, right: 16, bottom: 76, backgroundColor: t.ink, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    toastText: { color: t.paper, fontWeight: '600', flex: 1 },
    toastBtn: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: t.paper, borderRadius: 6 },
    toastBtnText: { color: t.paper, fontWeight: '700' },
    tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line, backgroundColor: t.card },
    tabBtn: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 12, gap: 2, borderTopWidth: 3, borderTopColor: 'transparent' },
    tabOn: { borderTopColor: t.accent },
    tabLabel: { color: t.soft, fontSize: 12.5, fontWeight: '600' },
    tabLabelOn: { color: t.ink },
    setGroup: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line },
    setHead: { color: t.ink, fontSize: 17, fontWeight: '700', marginBottom: 6 },
    setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    setRowCol: { paddingVertical: 8 },
    setTitle: { color: t.text, fontWeight: '600', fontSize: 15 },
    setNote: { color: t.soft, fontSize: 13, lineHeight: 19, marginTop: 2 },
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.line },
    marker: { position: 'absolute', borderWidth: 3, borderColor: '#FFFFFF', outlineWidth: 1, outlineColor: '#000000', backgroundColor: 'transparent' },
    countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
    countryName: { flex: 1, color: t.ink, fontSize: 16 },
    countryDial: { color: t.soft, fontSize: 14 },
  });
