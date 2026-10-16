import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackend, resetApp } from '../test/ipc';
import {
  fitZoom,
  fontSize,
  handleZoomKey,
  nearestZoom,
  SAVE_DELAY_MS,
  setDisplay,
  watchZoom,
  zoomKey,
  zoomState,
  zoomStep,
} from './display.svelte';
import { handleShortcut, isAppShortcut } from './shortcuts';
import { app } from './state.svelte';

const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, ctrlKey: true, ...init });
/** The zooms the WebView was given, in order. */
const zooms = (b: ReturnType<typeof fakeBackend>) => b.called('plugin:webview|set_webview_zoom').map((c) => c.args.value);

describe('the steps of the zoom and the font sizes', () => {
  it('goes one step at a time, held at the ends, and back to 100 %', () => {
    expect(zoomStep(100, 1)).toBe(110);
    expect(zoomStep(110, 1)).toBe(125);
    expect(zoomStep(100, -1)).toBe(90);
    expect(zoomStep(200, 1)).toBe(200);
    expect(zoomStep(80, -1)).toBe(80);
    expect(zoomStep(175, 0)).toBe(100);
    // A zoom off the steps (written by hand) goes from the nearest one.
    expect(zoomStep(133, 1)).toBe(150);
  });

  it('takes the nearest step, and 100 % for what is not a number', () => {
    expect(nearestZoom(133)).toBe(125);
    expect(nearestZoom(5)).toBe(80);
    expect(nearestZoom(900)).toBe(200);
    expect(nearestZoom(NaN)).toBe(100);
  });

  it('holds the zoom to what leaves the interface its 1000 × 600 pixels, never under 100 %', () => {
    expect(fitZoom({ width: 1440, height: 1080 })).toBe(125);
    expect(fitZoom({ width: 1920, height: 1080 })).toBe(175);
    expect(fitZoom({ width: 2560, height: 1400 })).toBe(200);
    expect(fitZoom({ width: 2560, height: 700 })).toBe(110);
    expect(fitZoom({ width: 1000, height: 600 })).toBe(100);
    expect(fitZoom({ width: 800, height: 500 })).toBe(100);
  });

  it('keeps a font size to the half pixel, between 9 and 24', () => {
    expect(fontSize(13.3)).toBe(13.5);
    expect(fontSize(3)).toBe(9);
    expect(fontSize(40)).toBe(24);
    expect(fontSize(NaN)).toBe(12.5);
  });
});

describe('the keys of the zoom', () => {
  it('are Ctrl+= or Ctrl++ (with Shift too), Ctrl+- and Ctrl+0, Cmd on macOS', () => {
    expect(zoomKey(key('='), false)).toBe(1);
    expect(zoomKey(key('+', { shiftKey: true }), false)).toBe(1);
    expect(zoomKey(key('-'), false)).toBe(-1);
    expect(zoomKey(key('0'), false)).toBe(0);
    expect(zoomKey(new KeyboardEvent('keydown', { key: '=', metaKey: true }), true)).toBe(1);
    expect(zoomKey(key('='), true)).toBeNull();
  });

  it('are read from the keypad, and Ctrl+0 from its place on an AZERTY keyboard (« à »)', () => {
    expect(zoomKey(key('+', { code: 'NumpadAdd' }), false)).toBe(1);
    expect(zoomKey(key('-', { code: 'NumpadSubtract' }), false)).toBe(-1);
    expect(zoomKey(key('à', { code: 'Digit0' }), false)).toBe(0);
  });

  it('are none with Alt (AltGr on French keyboards), nor other keys', () => {
    expect(zoomKey(key('=', { altKey: true }), false)).toBeNull();
    expect(zoomKey(new KeyboardEvent('keydown', { key: '=' }), false)).toBeNull();
    expect(zoomKey(key('9'), false)).toBeNull();
  });

  it('go through a terminal to the app, as the other shortcuts of the app', () => {
    expect(isAppShortcut(key('='), false)).toBe(true);
    expect(isAppShortcut(key('-'), false)).toBe(true);
    expect(isAppShortcut(key('0'), false)).toBe(true);
  });
});

describe('setDisplay', () => {
  beforeEach(() => {
    resetApp();
    Object.assign(zoomState, { fit: 200, shown: 100 });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('zooms the WebView at once, and saves the settings once, a moment after the last change', () => {
    const b = fakeBackend({ save_settings: () => [] });
    setDisplay({ uiZoom: 125 });
    setDisplay({ uiZoom: 150 });
    expect(app.settings.uiZoom).toBe(150);
    expect(zooms(b)).toEqual([1.25, 1.5]);
    expect(b.called('save_settings')).toHaveLength(0);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(b.called('save_settings')).toHaveLength(1);
    // The rest of the settings as they are.
    expect(b.called('save_settings')[0].args.settings).toMatchObject({ uiZoom: 150, sound: true, defaultModel: 'sonnet' });
  });

  it('keeps the font sizes in range, and does not zoom for them', () => {
    const b = fakeBackend({ save_settings: () => [] });
    setDisplay({ terminalFontSize: 30, editorFontSize: 14.2 });
    expect([app.settings.terminalFontSize, app.settings.editorFontSize]).toEqual([24, 14]);
    expect(zooms(b)).toEqual([]);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(b.called('save_settings')[0].args.settings).toMatchObject({ terminalFontSize: 24, editorFontSize: 14 });
  });

  it('is what the shortcuts change, a dialog open or not', () => {
    const b = fakeBackend({ save_settings: () => [] });
    app.modal = { kind: 'settings' };
    expect(handleShortcut(key('='), false)).toBe(true);
    expect(handleShortcut(key('='), false)).toBe(true);
    expect(app.settings.uiZoom).toBe(125);
    expect(handleZoomKey(key('-'), false)).toBe(true);
    expect(app.settings.uiZoom).toBe(110);
    expect(handleShortcut(key('0'), false)).toBe(true);
    expect(app.settings.uiZoom).toBe(100);
    expect(zooms(b)).toEqual([1.1, 1.25, 1.1, 1]);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(b.called('save_settings')).toHaveLength(1);
    expect(b.called('save_settings')[0].args.settings.uiZoom).toBe(100);
  });
});

describe('a zoom the window cannot hold', () => {
  /** A window of `width` × `height` physical pixels, at `scale`. */
  const windowOf = (width: number, height: number, scale = 1) => ({
    save_settings: () => [],
    'plugin:window|inner_size': () => ({ width, height }),
    'plugin:window|scale_factor': () => scale,
  });
  beforeEach(() => {
    resetApp();
    Object.assign(zoomState, { fit: 200, shown: 100 });
  });

  it('is shown at the biggest step the window holds, and comes back once it is big enough', async () => {
    let size = { width: 2880, height: 2160, scale: 2 };
    const b = fakeBackend({
      save_settings: () => [],
      'plugin:window|inner_size': () => ({ width: size.width, height: size.height }),
      'plugin:window|scale_factor': () => size.scale,
    });
    app.settings.uiZoom = 200;
    const stop = watchZoom();
    await vi.waitFor(() => expect(zooms(b)).toEqual([1.25]));
    expect(zoomState).toEqual({ fit: 125, shown: 125 });
    // The choice stays.
    expect(app.settings.uiZoom).toBe(200);
    size = { width: 2560, height: 1400, scale: 1 };
    window.dispatchEvent(new Event('resize'));
    await vi.waitFor(() => expect(zooms(b)).toEqual([1.25, 2]));
    expect(zoomState.shown).toBe(200);
    stop();
    expect(b.called('save_settings')).toHaveLength(0);
  });

  it('is never reached from the keyboard: Ctrl+= stops at what the window holds', async () => {
    const b = fakeBackend(windowOf(1440, 1080));
    const stop = watchZoom();
    await vi.waitFor(() => expect(zoomState.fit).toBe(125));
    for (let i = 0; i < 5; i++) handleZoomKey(key('='), false);
    expect(app.settings.uiZoom).toBe(125);
    expect(zooms(b)).toEqual([1, 1.1, 1.25]);
    stop();
  });

  it('is not held when the size of the window cannot be read', async () => {
    const b = fakeBackend({ save_settings: () => [] });
    app.settings.uiZoom = 175;
    const stop = watchZoom();
    await vi.waitFor(() => expect(zooms(b)).toEqual([1.75]));
    expect(zoomState.fit).toBe(200);
    stop();
  });
});
