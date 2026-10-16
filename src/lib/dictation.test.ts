import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackend, resetApp } from '../test/ipc';
import { DEFAULT_SHORTCUT, HOLD_MS, duration, insertAt, matchesShortcut, parseShortcut, shortcutLabel, shortcutOf } from './dictation';
import { dictation, type DictationTarget } from './dictation.svelte';
import { setLang } from './i18n';
import { dictationKey } from './shortcuts';
import { app } from './state.svelte';

const key = (code: string, mods: Partial<KeyboardEventInit> = {}, type = 'keydown') =>
  new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code, ...mods });

describe('insertAt', () => {
  it('puts the text at the cursor, spaced from the words around it, and the cursor just after it', () => {
    expect(insertAt('Corrige  page', 8, 8, 'la')).toEqual({ text: 'Corrige la page', caret: 10 });
    expect(insertAt('Corrige', 7, 7, ' le test ')).toEqual({ text: 'Corrige le test', caret: 15 });
    expect(insertAt('', 0, 0, 'Bonjour')).toEqual({ text: 'Bonjour', caret: 7 });
    expect(insertAt('fin', 0, 0, 'Début')).toEqual({ text: 'Début fin', caret: 5 });
    // Before a punctuation mark: no space.
    expect(insertAt('Lance .', 6, 6, 'les tests')).toEqual({ text: 'Lance les tests.', caret: 15 });
  });

  it('replaces the selection, and leaves the text as it is when nothing was said', () => {
    expect(insertAt('Lance XX puis commite', 6, 8, 'les tests')).toEqual({ text: 'Lance les tests puis commite', caret: 15 });
    expect(insertAt('abc', 1, 1, '   ')).toEqual({ text: 'abc', caret: 1 });
    // A cursor past the end (the text changed meanwhile) goes to the end.
    expect(insertAt('abc', 10, 10, 'd')).toEqual({ text: 'abc d', caret: 5 });
  });
});

describe('the shortcut', () => {
  it('is Ctrl+Shift+Space by default, Cmd+Shift+Space on macOS', () => {
    expect(DEFAULT_SHORTCUT).toBe('Mod+Shift+Space');
    expect(matchesShortcut(key('Space', { ctrlKey: true, shiftKey: true }), DEFAULT_SHORTCUT, false)).toBe(true);
    expect(matchesShortcut(key('Space', { metaKey: true, shiftKey: true }), DEFAULT_SHORTCUT, true)).toBe(true);
    // No more and no fewer modifiers.
    expect(matchesShortcut(key('Space', { ctrlKey: true }), DEFAULT_SHORTCUT, false)).toBe(false);
    expect(matchesShortcut(key('Space', { ctrlKey: true, shiftKey: true, altKey: true }), DEFAULT_SHORTCUT, false)).toBe(false);
    expect(matchesShortcut(key('Space', { ctrlKey: true, shiftKey: true }), DEFAULT_SHORTCUT, true)).toBe(false);
    expect(matchesShortcut(key('KeyD', { ctrlKey: true, shiftKey: true }), DEFAULT_SHORTCUT, false)).toBe(false);
  });

  it('is read from the key pressed, by its place on the keyboard', () => {
    expect(shortcutOf(key('KeyD', { ctrlKey: true, altKey: true }), false)).toBe('Mod+Alt+KeyD');
    expect(shortcutOf(key('KeyD', { metaKey: true, shiftKey: true }), true)).toBe('Mod+Shift+KeyD');
    expect(shortcutOf(key('F8'), false)).toBe('F8');
    // Typed in every field, or a modifier alone: no shortcut.
    expect(shortcutOf(key('KeyD', { shiftKey: true }), false)).toBeNull();
    expect(shortcutOf(key('ShiftLeft', { shiftKey: true }), false)).toBeNull();
    expect(parseShortcut('Mod+Alt+KeyD')).toEqual({ mod: true, ctrl: false, alt: true, shift: false, meta: false, code: 'KeyD' });
    expect(matchesShortcut(key('F8'), 'F8', false)).toBe(true);
  });

  it('is written as the system and the language write it', () => {
    setLang('fr');
    expect(shortcutLabel(DEFAULT_SHORTCUT, false)).toBe('Ctrl+Maj+Espace');
    expect(shortcutLabel(DEFAULT_SHORTCUT, true)).toBe('⇧⌘Espace');
    expect(shortcutLabel('Mod+Alt+KeyD', false)).toBe('Ctrl+Alt+D');
    setLang('en');
    expect(shortcutLabel(DEFAULT_SHORTCUT, false)).toBe('Ctrl+Shift+Space');
    setLang('fr');
  });

  it('says how long it has listened', () => {
    expect(duration(0)).toBe('0:00');
    expect(duration(7_400)).toBe('0:07');
    expect(duration(92_000)).toBe('1:32');
  });
});

/** A field one dictates into, with what was put in it. */
function field(kind: DictationTarget['kind'] = 'composer') {
  const el = document.createElement('div');
  const input = document.createElement('textarea');
  el.appendChild(input);
  document.body.appendChild(el);
  const got: string[] = [];
  const target: DictationTarget = { kind, id: `${kind}-${Math.random()}`, el: () => el, insert: (s) => got.push(s) };
  const off = dictation.register(target);
  return { target, got, input, off, el };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the dictation', () => {
  let now = 1000;
  beforeEach(() => {
    resetApp();
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function backend(text = 'Ajoute un test', start: () => unknown = () => ({ kind: 'listening', session: 7 })) {
    return fakeBackend({ voice_start: start, voice_stop: () => text });
  }

  it('a click starts it and a second ends it: the text goes into the field, never sent', async () => {
    const b = backend();
    const { target, got } = field();
    dictation.press(target);
    now += 120;
    dictation.release();
    await tick();
    expect(dictation.phase).toBe('listening');
    expect(dictation.targetId).toBe(target.id);
    // Still listening after the click was let go.
    now += 3000;
    dictation.press(target);
    expect(dictation.phase).toBe('transcribing');
    dictation.release();
    await tick();
    expect(got).toEqual(['Ajoute un test']);
    expect(dictation.phase).toBe('idle');
    expect(b.called('voice_stop')[0].args).toEqual({ session: 7, target: 'composer' });
    expect(b.called('send_message')).toHaveLength(0);
  });

  it('a press held talks until it is let go', async () => {
    backend('Lance les tests');
    const { target, got } = field('ticket');
    dictation.press(target);
    await tick();
    expect(dictation.phase).toBe('listening');
    now += HOLD_MS + 600;
    dictation.release();
    await tick();
    expect(got).toEqual(['Lance les tests']);
    expect(dictation.phase).toBe('idle');
  });

  it('a press held let go while the microphone still opens ends as soon as it listens', async () => {
    let open!: (v: unknown) => void;
    const b = backend('ok', () => new Promise((r) => (open = r)));
    const { target, got } = field();
    dictation.press(target);
    now += HOLD_MS + 50;
    dictation.release();
    expect(dictation.phase).toBe('starting');
    open({ kind: 'listening', session: 3 });
    await tick();
    await tick();
    expect(b.called('voice_stop')).toHaveLength(1);
    expect(got).toEqual(['ok']);
  });

  it('shows the level and the time the backend tells, for its own listening only', async () => {
    backend();
    const { target } = field();
    dictation.press(target);
    await tick();
    dictation.take({ kind: 'level', session: 7, level: 0.6, ms: 1500 });
    expect([dictation.level, dictation.ms]).toEqual([0.6, 1500]);
    dictation.take({ kind: 'level', session: 99, level: 0.1, ms: 9 });
    expect(dictation.level).toBe(0.6);
    dictation.cancel();
  });

  it('first offers the model, with its size, then downloads it with its progress', async () => {
    let finish!: () => void;
    const b = fakeBackend({
      voice_start: () => ({ kind: 'needsModel', model: 'base', size: 147_951_465 }),
      voice_download: () => new Promise<void>((r) => (finish = r)),
    });
    const { target } = field();
    dictation.press(target);
    await tick();
    expect(dictation.phase).toBe('offer');
    expect(dictation.offer).toEqual({ model: 'base', size: 147_951_465 });
    const done = dictation.download();
    expect(dictation.phase).toBe('downloading');
    dictation.take({ kind: 'download', model: 'base', done: 50_000_000, total: 147_951_465 });
    expect(dictation.progress?.done).toBe(50_000_000);
    finish();
    await done;
    expect(b.called('voice_download')[0].args).toEqual({ model: 'base' });
    expect(dictation.phase).toBe('idle');
    expect(app.toasts.at(-1)?.text).toMatch(/Modèle téléchargé/);
  });

  it('a download called off asks the backend to stop it', async () => {
    const b = fakeBackend({
      voice_start: () => ({ kind: 'needsModel', model: 'base', size: 10 }),
      voice_download: () => new Promise(() => {}),
    });
    const { target } = field();
    dictation.press(target);
    await tick();
    void dictation.download();
    dictation.cancel();
    await tick();
    expect(b.called('voice_download_cancel')[0].args).toEqual({ model: 'base' });
    expect(dictation.phase).toBe('idle');
  });

  it('says why when the microphone is refused, with what to do', async () => {
    fakeBackend({
      voice_start: () => {
        throw 'Le système refuse le micro à Escouade. Pour l’autoriser, ouvre Paramètres › Confidentialité et sécurité › Microphone…';
      },
    });
    const { target } = field();
    dictation.press(target);
    await tick();
    await tick();
    expect(dictation.phase).toBe('idle');
    expect(app.toasts.at(-1)).toMatchObject({ kind: 'error' });
    expect(app.toasts.at(-1)?.text).toMatch(/Confidentialité et sécurité › Microphone/);
  });

  it('nothing heard is said, and nothing put in the field', async () => {
    backend('');
    const { target, got } = field();
    dictation.press(target);
    await tick();
    dictation.press(target);
    await tick();
    expect(got).toEqual([]);
    expect(app.toasts.at(-1)?.text).toMatch(/Rien entendu/);
  });

  it('a listening that ended by itself is transcribed, its reason told', async () => {
    backend('Ce qui a été dit');
    const { target, got } = field();
    dictation.press(target);
    await tick();
    dictation.take({ kind: 'ended', session: 7, error: 'Aucun micro trouvé.' });
    await tick();
    expect(got).toEqual(['Ce qui a été dit']);
    expect(app.toasts.some((t) => t.text === 'Aucun micro trouvé.')).toBe(true);
  });

  it('the field gone stops it, and nothing is put anywhere', async () => {
    const b = backend();
    const { target, off, got } = field();
    dictation.press(target);
    await tick();
    off();
    expect(dictation.phase).toBe('idle');
    expect(b.called('voice_cancel')).toHaveLength(1);
    expect(got).toEqual([]);
  });

  it('the shortcut dictates into the field that has the focus, and Escape calls it off', async () => {
    const b = backend('texte du ticket');
    const composer = field('composer');
    const ticket = field('ticket');
    // The ticket's form, focused, above the composer.
    composer.input.focus();
    const sc = (type = 'keydown') => key('Space', { ctrlKey: true, shiftKey: true }, type);
    expect(dictationKey(sc(), false)).toBe(true);
    await tick();
    expect(dictation.targetId).toBe(composer.target.id);
    expect(dictationKey(new KeyboardEvent('keydown', { key: 'Escape' }), false)).toBe(true);
    expect(dictation.phase).toBe('idle');
    expect(b.called('voice_cancel')).toHaveLength(1);
    ticket.input.focus();
    dictationKey(sc(), false);
    now += 100;
    dictationKey(sc('keyup'), false);
    await tick();
    expect(dictation.targetId).toBe(ticket.target.id);
    // A second press ends it; the key held down repeats nothing.
    expect(dictationKey(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, shiftKey: true, repeat: true }), false)).toBe(true);
    expect(dictation.phase).toBe('listening');
    dictationKey(sc(), false);
    await tick();
    expect(ticket.got).toEqual(['texte du ticket']);
    expect(composer.got).toEqual([]);
    // Another key is not its own; Escape at rest is left to the window.
    expect(dictationKey(key('KeyA', { ctrlKey: true }), false)).toBe(false);
    expect(dictationKey(new KeyboardEvent('keydown', { key: 'Escape' }), false)).toBe(false);
  });

  it('follows the shortcut of the settings, and leaves the keys alone while a new one is recorded', async () => {
    backend();
    field();
    app.settings.voice = { ...app.settings.voice, shortcut: 'Mod+Alt+KeyD' };
    expect(dictationKey(key('Space', { ctrlKey: true, shiftKey: true }), false)).toBe(false);
    dictation.recording = true;
    expect(dictationKey(key('KeyD', { ctrlKey: true, altKey: true }), false)).toBe(false);
    dictation.recording = false;
    expect(dictationKey(key('KeyD', { ctrlKey: true, altKey: true }), false)).toBe(true);
    await tick();
    expect(dictation.phase).toBe('listening');
    dictation.cancel();
  });
});
