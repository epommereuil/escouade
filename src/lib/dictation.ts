// What the dictation does with its text and its keys, apart from the window: where the text goes in a field, and the
// shortcut of the settings read, matched and written.

import { t } from './i18n';
import { IS_MAC } from './platform';

/** The shortcut of a first start: Ctrl+Shift+Space, Cmd+Shift+Space on macOS (taken by neither the app nor the systems). */
export const DEFAULT_SHORTCUT = 'Mod+Shift+Space';

/**
 * A press of the button or of the shortcut held this long (ms) or more is « appuyer pour parler »: letting go stops.
 * A shorter one is a click: it starts, and the next one stops.
 */
export const HOLD_MS = 400;

/**
 * `dictated` put in `text` in place of what goes from `start` to `end` (the selection, or the cursor), with a space
 * before it when it follows a word and after it when a word follows, and where the cursor goes: just after it.
 */
export function insertAt(text: string, start: number, end: number, dictated: string): { text: string; caret: number } {
  const said = dictated.trim();
  if (!said) return { text, caret: end };
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  const before = text.slice(0, a);
  const after = text.slice(b);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^[\s.,;:!?)\]]/.test(after) ? ' ' : '';
  const put = lead + said + trail;
  return { text: before + put + after, caret: a + lead.length + said.length };
}

/** A shortcut as the settings keep it: its modifiers, and its key by its place on the keyboard (`KeyboardEvent.code`). */
export interface Shortcut {
  /** Ctrl, Cmd on macOS. */
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  code: string;
}

/** `Mod+Shift+Space` read; null when it names no key. */
export function parseShortcut(spec: string): Shortcut | null {
  const parts = spec
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  const code = parts.pop();
  if (!code) return null;
  const has = (k: string) => parts.includes(k);
  return { mod: has('Mod'), ctrl: has('Ctrl'), alt: has('Alt'), shift: has('Shift'), meta: has('Meta'), code };
}

/** Whether `e` is the shortcut: its key, and its modifiers, no more and no fewer. */
export function matchesShortcut(e: KeyboardEvent, spec: string, mac = IS_MAC): boolean {
  const s = parseShortcut(spec);
  if (!s || e.code !== s.code) return false;
  const ctrl = s.ctrl || (s.mod && !mac);
  const meta = s.meta || (s.mod && mac);
  return e.ctrlKey === ctrl && e.metaKey === meta && e.altKey === s.alt && e.shiftKey === s.shift;
}

/** Keys that are no shortcut alone: the modifiers. */
const MODIFIERS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
]);

/**
 * The shortcut a key pressed in « Changer le raccourci » makes, written as the settings keep it: the app's modifier
 * (Ctrl, Cmd on macOS) as `Mod`. Null for a key that cannot be one: a modifier alone, a key without Ctrl, Alt or Cmd
 * (it would be typed in every field) unless it is a function key.
 */
export function shortcutOf(e: KeyboardEvent, mac = IS_MAC): string | null {
  if (MODIFIERS.has(e.code) || !e.code) return null;
  const fn = /^F([1-9]|1[0-9]|2[0-4])$/.test(e.code);
  if (!fn && !e.ctrlKey && !e.metaKey && !e.altKey) return null;
  const mods: string[] = [];
  if (mac ? e.metaKey : e.ctrlKey) mods.push('Mod');
  if (mac ? e.ctrlKey : e.metaKey) mods.push(mac ? 'Ctrl' : 'Meta');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  return [...mods, e.code].join('+');
}

/** The name of a key by its place: `KeyD` is D, `Digit1` is 1, `Space` is « Espace ». */
function codeName(code: string): string {
  if (code === 'Space') return t('voice.keys.space');
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(code);
  return m ? m[1] : code;
}

/** The shortcut as written on this system and in the language of the interface: « Ctrl+Maj+Espace », « ⇧⌘Space ». */
export function shortcutLabel(spec: string, mac = IS_MAC): string {
  const s = parseShortcut(spec);
  if (!s) return spec;
  const key = codeName(s.code);
  if (mac) {
    const sym = (s.ctrl ? '⌃' : '') + (s.alt ? '⌥' : '') + (s.shift ? '⇧' : '') + (s.mod || s.meta ? '⌘' : '');
    return sym + key;
  }
  const mods = [s.mod || s.ctrl ? 'Ctrl' : '', s.meta ? 'Win' : '', s.alt ? 'Alt' : '', s.shift ? t('format.keys.shift') : ''].filter(
    Boolean,
  );
  return [...mods, key].join('+');
}

/** `ms` as the time a listening has lasted: « 0:07 », « 1:32 ». */
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
