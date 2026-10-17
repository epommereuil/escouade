import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversation } from '../lib/conversation.svelte';
import { setLang } from '../lib/i18n';
import type { VoiceEvent } from '../lib/types';
import { agent, fakeBackend, project, resetApp } from '../test/ipc';
import ConversationOverlay from './ConversationOverlay.svelte';

const SESSION = 5;
const ev = (e: Record<string, unknown>) => conversation.take({ session: SESSION, ...e } as VoiceEvent);
const overlay = () => document.querySelector('[data-conversation-overlay]') as HTMLElement;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the voice conversation over the whole window', () => {
  let backend: ReturnType<typeof fakeBackend>;
  let reading = 0;

  beforeEach(async () => {
    setLang('fr');
    reading = 0;
    resetApp({ projects: [project({ id: 'p1', name: 'web-shop' })], agents: [agent({ id: 'a1', name: 'Alice', projectId: 'p1' })] });
    conversation.clear();
    backend = fakeBackend({
      conversation_start: () => ({ kind: 'listening', session: SESSION }),
      conversation_say: () => ++reading,
      get_conversation: () => [],
    });
    await conversation.start('a1');
  });

  it('names the agent, says the state, and shows what the user said, then each sentence read as it is heard', async () => {
    render(ConversationOverlay);
    expect(screen.getByRole('dialog', { name: 'Conversation vocale avec Alice' })).toBeTruthy();
    expect(overlay().textContent).toContain('web-shop');
    expect(overlay().dataset.conversationPhase).toBe('listening');
    expect(screen.getByRole('status').textContent).toContain('À l’écoute : parle quand tu veux');
    // Whisper's text, once transcribed: the user's subtitle.
    ev({ kind: 'convHeard', text: 'Ajoute un test pour la page des réglages.', error: null });
    await tick();
    const sub = () => document.querySelector('[data-subtitle]') as HTMLElement;
    await waitFor(() => expect(sub().dataset.subtitle).toBe('user'));
    expect(sub().textContent).toContain('Toi');
    expect(sub().textContent).toContain('Ajoute un test pour la page des réglages.');
    expect(screen.getByRole('status').textContent).toContain('Alice travaille…');
    // The agent's passage, sentence by sentence as it is heard.
    conversation.observe(agent({ id: 'a1', name: 'Alice' }), [
      { kind: 'text', id: 'm', text: '…', spoken: 'C’est fait. Les tests passent.', streaming: false },
      { kind: 'turn', id: 't', ts: 2, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null },
    ]);
    await tick();
    ev({ kind: 'convSentence', reading: 1, index: 0, text: 'C’est fait.' });
    await waitFor(() => expect(sub().dataset.subtitle).toBe('agent'));
    expect(sub().textContent).toContain('Alice');
    expect(sub().textContent).toContain('C’est fait.');
    ev({ kind: 'convSentence', reading: 1, index: 1, text: 'Les tests passent.' });
    await waitFor(() => expect(sub().textContent).toContain('Les tests passent.'));
    expect(sub().textContent).not.toContain('C’est fait.');
    expect(screen.getByRole('status').textContent).toContain('Alice te répond');
    // The sentences of a reading cut off (barge-in) are not shown.
    ev({ kind: 'convBargeIn', reading: 1 });
    ev({ kind: 'convSentence', reading: 1, index: 2, text: 'Trop tard.' });
    await tick();
    expect(sub().textContent).not.toContain('Trop tard.');
  });

  it('follows the level of the voice played and of the microphone', () => {
    ev({ kind: 'convLevel', level: 0.4, played: 0.8 });
    expect(conversation.level).toBe(0.4);
    expect(conversation.played).toBe(0.8);
  });

  it('Escape ends the conversation and the panel goes', async () => {
    const { unmount } = render(ConversationOverlay);
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(conversation.phase).toBe('idle');
    expect(backend.called('conversation_stop')).toHaveLength(1);
    expect(conversation.overlay).toBe(false);
    unmount();
  });

  it('« Arrêter » ends it too, and « Reprendre » shows on pause', async () => {
    render(ConversationOverlay);
    conversation.phase = 'paused';
    await tick();
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Arrêter/ }));
    expect(backend.called('conversation_stop')).toHaveLength(1);
  });

  it('draws only while it is shown: its animation frame is cancelled when it goes', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const caf = vi.spyOn(window, 'cancelAnimationFrame');
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform() {},
      clearRect() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      beginPath() {},
      arc() {},
      fill() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D);
    const { unmount } = render(ConversationOverlay);
    expect(raf).toHaveBeenCalled();
    unmount();
    expect(caf).toHaveBeenCalled();
    getContext.mockRestore();
    raf.mockRestore();
    caf.mockRestore();
  });
});
