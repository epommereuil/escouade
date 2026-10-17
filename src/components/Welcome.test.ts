import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../lib/i18n';
import { app } from '../lib/state.svelte';
import { OS } from '../lib/platform';
import { BARE_ENGINE, CLAUDE_ENGINE, fakeBackend, resetApp } from '../test/ipc';
import Welcome from './Welcome.svelte';

describe('Welcome', () => {
  beforeEach(() => resetApp());

  it('invites to add a project, which opens the window for it', async () => {
    fakeBackend();
    render(Welcome);
    expect(screen.getByText(/^Ajoute un projet pour y lancer des agents Claude Code/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Ajouter un projet' }));
    expect(app.modal).toEqual({ kind: 'newProject' });
  });

  it('says « Aucun harness trouvé » when none is found, with the command that installs each one', () => {
    fakeBackend();
    app.engines = [CLAUDE_ENGINE, BARE_ENGINE];
    app.enginesFound = [];
    render(Welcome);
    const none = screen.getByRole('region', { name: 'Aucun harness trouvé' });
    expect(none).toHaveTextContent('Installe l’un d’eux, puis indique son chemin dans Réglages › Harness s’il n’est pas dans le PATH :');
    const items = within(none).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Claude Code' + (OS === 'windows' ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash'),
      'Harness nu' + 'npm install -g @openai/codex',
    ]);
    expect(within(items[0]).getByText(/claude\.ai\/install/)).toHaveClass('mono');
  });

  it('says nothing about it once one is found', () => {
    fakeBackend();
    app.enginesFound = ['claude'];
    render(Welcome);
    expect(screen.queryByText('Aucun harness trouvé')).not.toBeInTheDocument();
  });
});

describe('Welcome in English', () => {
  beforeEach(() => {
    resetApp();
    setLang('en');
  });

  it('writes the invitation, the warning and the button in English', () => {
    fakeBackend();
    app.enginesFound = [];
    render(Welcome);
    expect(screen.getByText(/^Add a project to run Claude Code agents, follow/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'No harness found' })).toHaveTextContent(
      'Install one of them, then set its path in Settings › Harness if it isn’t on the PATH:',
    );
    expect(screen.getByRole('button', { name: '+ Add a project' })).toBeInTheDocument();
  });
});
