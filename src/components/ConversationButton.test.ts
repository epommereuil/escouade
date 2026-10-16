import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { conversation } from '../lib/conversation.svelte';
import { setLang } from '../lib/i18n';
import type { VoiceEvent } from '../lib/types';
import { agent, fakeBackend, resetApp } from '../test/ipc';
import ConversationButton from './ConversationButton.svelte';

describe('the Conversation button of the composer', () => {
  beforeEach(() => {
    setLang('fr');
    resetApp({ agents: [agent({ id: 'a1', name: 'Alice' })] });
    conversation.clear();
  });

  const panel = () => document.querySelector('[data-conversation-phase]') as HTMLElement | null;

  it('starts the conversation, its panel says where it is, and « Arrêter » ends it', async () => {
    const backend = fakeBackend({
      conversation_start: () => ({ kind: 'listening', session: 3 }),
      get_conversation: () => [],
    });
    const { unmount } = render(ConversationButton, { agent: agent({ id: 'a1', name: 'Alice' }) });
    const button = screen.getByRole('button', { name: 'Conversation' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(button);
    await waitFor(() => expect(panel()?.dataset.conversationPhase).toBe('listening'));
    expect(panel()!.textContent).toContain('À l’écoute : parle quand tu veux');
    expect(screen.getByRole('meter', { name: 'Niveau du micro' })).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    conversation.take({ kind: 'convHeard', session: 3, text: 'Lance les tests', error: null } as VoiceEvent);
    await waitFor(() => expect(panel()?.dataset.conversationPhase).toBe('working'));
    expect(panel()!.textContent).toContain('Alice travaille…');
    expect(panel()!.textContent).toContain('Tu as dit : Lance les tests');
    await userEvent.click(screen.getByRole('button', { name: '■ Arrêter' }));
    expect(backend.called('conversation_stop')).toHaveLength(1);
    expect(panel()).toBeNull();
    unmount();
  });

  it('offers the voice to download, with its size', async () => {
    fakeBackend({ conversation_start: () => ({ kind: 'needsVoice', voice: 'fr_FR-siwis-medium', size: 63_206_169 }) });
    render(ConversationButton, { agent: agent({ id: 'a1', name: 'Alice' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation' }));
    await waitFor(() => expect(panel()?.dataset.conversationPhase).toBe('offer'));
    expect(panel()!.textContent).toContain('la voix Piper « fr_FR-siwis-medium » (60 Mo)');
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeTruthy();
  });

  it('the composer gone, the conversation stops', async () => {
    const backend = fakeBackend({ conversation_start: () => ({ kind: 'listening', session: 4 }), get_conversation: () => [] });
    const { unmount } = render(ConversationButton, { agent: agent({ id: 'a1', name: 'Alice' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation' }));
    await waitFor(() => expect(conversation.phase).toBe('listening'));
    unmount();
    expect(conversation.phase).toBe('idle');
    expect(backend.called('conversation_stop')).toHaveLength(1);
  });
});
