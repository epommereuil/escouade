import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_DELAY_MS, zoomState } from '../../lib/display.svelte';
import { setLang } from '../../lib/i18n';
import { app } from '../../lib/state.svelte';
import { fakeBackend, resetApp } from '../../test/ipc';
import SettingsModal from '../modals/SettingsModal.svelte';

const panel = () => screen.getByRole('tabpanel');
/** The choices of a setting, as its chips read. */
const choices = (name: string) =>
  within(within(panel()).getByRole('group', { name }))
    .getAllByRole('button')
    .map((b) => b.textContent?.trim());
const choice = (setting: string, name: string) =>
  within(within(panel()).getByRole('group', { name: setting })).getByRole('button', { name });

const UI = 'Langue de l’interface';
const CLAUDE = 'Langue des textes rédigés par Claude';

describe('the « Application » tab', () => {
  beforeEach(() => {
    resetApp();
    app.modal = { kind: 'settings', tab: 'app' };
  });

  it('comes first and chooses the languages, each named in itself', () => {
    fakeBackend();
    render(SettingsModal, { tab: 'app' });
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Application');
    expect(screen.getByRole('tab', { name: 'Application' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Zoom, taille du texte et langues')).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: 'Langue' })).toBeInTheDocument();
    expect(choices(UI)).toEqual(['Système (Français)', 'English', 'Français']);
    expect(choices(CLAUDE)).toEqual(['Comme l’interface (par défaut)', 'English', 'Français']);
    expect(panel()).toHaveTextContent(
      'Messages de commit et descriptions de pull request proposés, commentaires publiés dans Jira, Trello, GitHub et Linear, consignes données aux agents (par défaut, le message de commit proposé reprend la langue des derniers commits du dépôt).',
    );
    // By default: the system's, and the interface's for Claude.
    expect(choice(UI, 'Système (Français)')).toHaveAttribute('aria-pressed', 'true');
    expect(choice(CLAUDE, 'Comme l’interface (par défaut)')).toHaveAttribute('aria-pressed', 'true');
    // A language's name is read in that language.
    expect(choice(UI, 'English')).toHaveAttribute('lang', 'en');
    expect(choice(CLAUDE, 'Français')).toHaveAttribute('lang', 'fr');
  });

  it('names the system’s language in the language of the interface', () => {
    fakeBackend();
    app.lang = { ui: 'fr', system: 'en', claude: 'fr' };
    render(SettingsModal, { tab: 'app' });
    expect(choices(UI)[0]).toBe('Système (Anglais)');
    setLang('en');
    flushSync();
    expect(choices('Interface language')[0]).toBe('System (English)');
    app.lang = { ui: 'en', system: 'fr', claude: 'en' };
    flushSync();
    expect(choices('Interface language')[0]).toBe('System (French)');
  });

  it('saves the languages chosen with the other settings', async () => {
    const backend = fakeBackend({ save_settings: () => [] });
    render(SettingsModal, { tab: 'app' });
    expect(screen.getByRole('tab', { name: 'Application' })).not.toHaveClass('changed');
    await userEvent.click(choice(UI, 'English'));
    await userEvent.click(choice(CLAUDE, 'Français'));
    expect(choice(UI, 'English')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: 'Application' })).toHaveClass('changed');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(backend.called('save_settings')).toHaveLength(1);
    expect(backend.called('save_settings')[0].args.settings).toMatchObject({ language: 'en', claudeLanguage: 'fr' });
    expect(app.settings).toMatchObject({ language: 'en', claudeLanguage: 'fr' });
  });

  it('reads in English', () => {
    fakeBackend();
    setLang('en');
    render(SettingsModal, { tab: 'app' });
    expect(screen.getByRole('tab', { name: 'Application' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Zoom, text size, and languages')).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: 'Display' })).toBeInTheDocument();
    expect(choices('Interface zoom')).toEqual(['80%', '90%', '100%', '110%', '125%', '150%', '175%', '200%']);
    expect(panel()).toHaveTextContent('Also from the keyboard: Ctrl+= to zoom in, Ctrl+- to zoom out, Ctrl+0 to go back to 100%.');
    expect(within(panel()).getByRole('spinbutton', { name: 'Terminal text size' })).toBeInTheDocument();
    expect(within(panel()).getByRole('spinbutton', { name: 'Editor text size' })).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    expect(choices('Interface language')).toEqual(['System (French)', 'English', 'Français']);
    expect(choices('Language of texts written by Claude')).toEqual(['Same as the interface (default)', 'English', 'Français']);
    expect(panel()).toHaveTextContent(
      'Proposed commit messages and pull request descriptions, comments posted to Jira, Trello, GitHub, and Linear, instructions given to agents (by default, the proposed commit message follows the language of the repository’s latest commits).',
    );
  });

  describe('« Affichage »', () => {
    const ZOOM = 'Zoom de l’interface';
    const field = (name: string) => within(panel()).getByRole('spinbutton', { name }) as HTMLInputElement;
    beforeEach(() => Object.assign(zoomState, { fit: 200, shown: 100 }));
    afterEach(() => vi.useRealTimers());

    it('comes first, its zoom in steps, its keys said, the font sizes of the terminals and of the editor apart', () => {
      fakeBackend();
      render(SettingsModal, { tab: 'app' });
      expect(
        within(panel())
          .getAllByRole('heading')
          .map((h) => h.textContent),
      ).toEqual(['Affichage', 'Langue']);
      expect(choices(ZOOM)).toEqual(['80 %', '90 %', '100 %', '110 %', '125 %', '150 %', '175 %', '200 %']);
      expect(choice(ZOOM, '100 %')).toHaveAttribute('aria-pressed', 'true');
      expect(panel()).toHaveTextContent('Aussi au clavier : Ctrl+= pour agrandir, Ctrl+- pour réduire, Ctrl+0 pour revenir à 100 %.');
      expect(field('Taille du texte des terminaux').value).toBe('12.5');
      expect(field('Taille du texte de l’éditeur').value).toBe('12.5');
      expect(panel()).toHaveTextContent('en pixels, 12.5 par défaut');
    });

    it('zooms at once and saves it by itself, without « Enregistrer », the draft left as it is', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const backend = fakeBackend({ save_settings: () => [] });
      render(SettingsModal, { tab: 'app' });
      await userEvent.click(choice(ZOOM, '150 %'));
      expect(choice(ZOOM, '150 %')).toHaveAttribute('aria-pressed', 'true');
      expect(app.settings.uiZoom).toBe(150);
      expect(backend.called('plugin:webview|set_webview_zoom').map((c) => c.args.value)).toEqual([1.5]);
      // Nothing to save in the tab: it is saved already.
      expect(screen.getByRole('tab', { name: 'Application' })).not.toHaveClass('changed');
      vi.advanceTimersByTime(SAVE_DELAY_MS);
      expect(backend.called('save_settings')).toHaveLength(1);
      expect(backend.called('save_settings')[0].args.settings.uiZoom).toBe(150);
      // A language saved afterwards keeps the zoom.
      await userEvent.click(choice(UI, 'English'));
      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
      expect(backend.called('save_settings')[1].args.settings).toMatchObject({ language: 'en', uiZoom: 150 });
    });

    it('does not offer the steps the window cannot hold, and says when the zoom chosen is held to a smaller one', () => {
      fakeBackend();
      Object.assign(zoomState, { fit: 125, shown: 125 });
      render(SettingsModal, { tab: 'app' });
      expect(choice(ZOOM, '125 %')).toBeEnabled();
      expect(choice(ZOOM, '150 %')).toBeDisabled();
      expect(choice(ZOOM, '200 %')).toBeDisabled();
      expect(within(panel()).queryByRole('status')).toBeNull();
      app.settings.uiZoom = 200;
      flushSync();
      expect(within(panel()).getByRole('status').textContent?.trim()).toBe(
        'La fenêtre est trop petite pour 200 % : l’interface est à 125 % tant qu’elle ne grandit pas.',
      );
    });

    it('keeps a font size typed in range, to the half pixel', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const backend = fakeBackend({ save_settings: () => [] });
      render(SettingsModal, { tab: 'app' });
      const term = field('Taille du texte des terminaux');
      await userEvent.clear(term);
      await userEvent.type(term, '40');
      await fireEvent.change(term);
      expect(app.settings.terminalFontSize).toBe(24);
      expect(term.value).toBe('24');
      const editor = field('Taille du texte de l’éditeur');
      await userEvent.clear(editor);
      await userEvent.type(editor, '15.2');
      await fireEvent.change(editor);
      expect(app.settings.editorFontSize).toBe(15);
      vi.advanceTimersByTime(SAVE_DELAY_MS);
      expect(backend.called('save_settings').at(-1)!.args.settings).toMatchObject({ terminalFontSize: 24, editorFontSize: 15 });
    });
  });
});
