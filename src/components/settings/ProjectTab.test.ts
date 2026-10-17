import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLang } from '../../lib/i18n';
import { app } from '../../lib/state.svelte';
import { BARE_ENGINE, CLAUDE_ENGINE, fakeBackend, project, resetApp } from '../../test/ipc';
import SettingsModal from '../modals/SettingsModal.svelte';

vi.mock('../../lib/terminals', () => ({ launchLog: () => ({}), disposeLog() {} }));

const save = () => userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

describe('ProjectTab', () => {
  beforeEach(() => {
    resetApp({ projects: [project(), project({ id: 'p2', name: 'site' })] });
    app.modal = { kind: 'settings' };
  });

  it('has no switch of its own for Escouade’s tools: the app’s one gives them to every agent (ESC-91)', async () => {
    const backend = fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    expect(screen.queryByRole('switch', { name: 'Les agents peuvent utiliser Escouade' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Serveur MCP' })).not.toBeInTheDocument();
    // A change of the project saves nothing of the kind.
    await userEvent.click(screen.getByRole('switch', { name: 'Un worktree par agent' }));
    await save();
    expect(backend.called('update_project')).toHaveLength(1);
    expect(backend.called('update_project')[0].args.project).not.toHaveProperty('agentsUseEscouade');
  });

  it('opens the setup assistant again on the project (ESC-94)', async () => {
    fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p2' });
    expect(screen.getByText('Revoir les réglages du projet étape par étape, ou y copier ceux d’un autre projet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir l’assistant…' }));
    expect(app.modal).toEqual({ kind: 'newProject', projectId: 'p2' });
  });

  describe('remote control', () => {
    const LABEL = 'Remote control pour les agents de ce projet';
    const REASON = 'Activé pour tous les projets dans Réglages › Harness';
    const tab = (name: string) => screen.getByRole('tab', { name });
    const headings = () => screen.getAllByRole('heading').map((h) => h.textContent);
    /** The modal on « Claude Code », the setting for all agents switched on or off, then on the project’s tab. */
    const toProjects = async (global: boolean, [allLabel, projectsTab] = ['Remote control pour tous les agents', 'Projets']) => {
      render(SettingsModal, { tab: 'claude' });
      const all = screen.getByRole('switch', { name: allLabel });
      if (global !== (all.getAttribute('aria-checked') === 'true')) await userEvent.click(all);
      await userEvent.click(tab(projectsTab));
    };

    it('is hidden while no harness has Remote Control', () => {
      fakeBackend();
      app.engines = [BARE_ENGINE];
      render(SettingsModal, { tab: 'projects', projectId: 'p1' });
      expect(screen.queryByRole('switch', { name: LABEL })).toBeNull();
      expect(headings()).not.toContain('Remote control');
    });

    it('has its own group after the project’s identity, off by default, and says what it does', () => {
      fakeBackend();
      render(SettingsModal, { tab: 'projects', projectId: 'p1' });
      const names = headings();
      expect(names.indexOf('Remote control')).toBe(names.indexOf('Identité') + 1);
      expect(names.indexOf('Git')).toBe(names.indexOf('Remote control') + 1);
      const remote = screen.getByRole('switch', { name: LABEL });
      expect(remote).toHaveAttribute('aria-checked', 'false');
      expect(remote).toBeEnabled();
      expect(screen.getByText(/^Chaque agent de ce projet, existant ou nouveau/)).toHaveTextContent(
        'Chaque agent de ce projet, existant ou nouveau (agents des tickets compris), est accessible depuis claude.ai et l’app Claude. Escouade lance tout de suite le process claude de chacun, qui reste lancé. La session apparaît sur claude.ai sous le nom « projet · agent » (pour un agent de ticket, son nom vient du ticket). En vue Claude Code, une interface déjà ouverte ne le prend qu’à son prochain lancement. Pour mettre un agent à part : clic droit, « Désactiver le remote control ».',
      );
      expect(screen.queryByText(REASON)).not.toBeInTheDocument();
    });

    it('is saved with the project when switched on, and shows what the project has', async () => {
      const backend = fakeBackend();
      resetApp({ projects: [project({ remoteControl: true }), project({ id: 'p2', name: 'site' })] });
      app.modal = { kind: 'settings' };
      render(SettingsModal, { tab: 'projects', projectId: 'p2' });
      expect(screen.getByRole('switch', { name: LABEL })).toHaveAttribute('aria-checked', 'false');
      await userEvent.click(screen.getByRole('switch', { name: LABEL }));
      expect(screen.getByRole('switch', { name: LABEL })).toHaveAttribute('aria-checked', 'true');
      expect(tab('Projets')).toHaveClass('changed');
      expect(backend.called('update_project')).toHaveLength(0);
      await save();
      expect(backend.called('update_project')).toHaveLength(1);
      expect(backend.called('update_project')[0].args.project).toMatchObject({ id: 'p2', remoteControl: true });
      expect(app.projects[1].remoteControl).toBe(true);
      // The other project kept its own value.
      expect(app.projects[0].remoteControl).toBe(true);
    });

    it('is switched on by a project that has it, and saves nothing when put back', async () => {
      const backend = fakeBackend();
      resetApp({ projects: [project({ remoteControl: true })] });
      app.modal = { kind: 'settings' };
      render(SettingsModal, { tab: 'projects', projectId: 'p1' });
      const remote = screen.getByRole('switch', { name: LABEL });
      expect(remote).toHaveAttribute('aria-checked', 'true');
      await userEvent.click(remote);
      await userEvent.click(remote);
      expect(tab('Projets')).not.toHaveClass('changed');
      await save();
      expect(backend.called('update_project')).toHaveLength(0);
    });

    it('is shown on and disabled while the setting for all agents is on in the modal, with the reason in view', async () => {
      const backend = fakeBackend({ save_settings: () => [] });
      await toProjects(true);
      const remote = screen.getByRole('switch', { name: LABEL });
      expect(remote).toHaveAttribute('aria-checked', 'true');
      expect(remote).toBeDisabled();
      expect(screen.getByText(REASON)).toBeVisible();
      expect(remote).toHaveAccessibleDescription(REASON);
      // A click changes nothing, and nothing of the project is saved.
      await userEvent.click(remote);
      expect(remote).toHaveAttribute('aria-checked', 'true');
      expect(tab('Projets')).not.toHaveClass('changed');
      await save();
      expect(backend.called('save_settings')[0].args.settings).toMatchObject({ remoteControlAll: true });
      expect(backend.called('update_project')).toHaveLength(0);
      expect(app.projects[0].remoteControl).toBe(false);
    });

    it('finds its own value and is active again once the setting for all agents is switched off', async () => {
      fakeBackend();
      await toProjects(true);
      expect(screen.getByRole('switch', { name: LABEL })).toBeDisabled();
      await userEvent.click(tab('Harness'));
      await userEvent.click(screen.getByRole('switch', { name: 'Remote control pour tous les agents' }));
      await userEvent.click(tab('Projets'));
      const remote = screen.getByRole('switch', { name: LABEL });
      expect(remote).toHaveAttribute('aria-checked', 'false');
      expect(remote).toBeEnabled();
      expect(screen.queryByText(REASON)).not.toBeInTheDocument();
      expect(remote).not.toHaveAccessibleDescription(REASON);
    });

    it('keeps the project’s own value under the setting for all agents, on until the project turns it off', async () => {
      const backend = fakeBackend({ save_settings: () => [] });
      resetApp({ projects: [project({ remoteControl: true })] });
      app.modal = { kind: 'settings' };
      await toProjects(true);
      expect(screen.getByRole('switch', { name: LABEL })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('switch', { name: LABEL })).toBeDisabled();
      await userEvent.click(tab('Harness'));
      await userEvent.click(screen.getByRole('switch', { name: 'Remote control pour tous les agents' }));
      await userEvent.click(tab('Projets'));
      expect(screen.getByRole('switch', { name: LABEL })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('switch', { name: LABEL })).toBeEnabled();
      expect(backend.called('update_project')).toHaveLength(0);
    });

    it('says it in English', async () => {
      setLang('en');
      fakeBackend();
      await toProjects(true, ['Remote control for all agents', 'Projects']);
      const remote = screen.getByRole('switch', { name: 'Remote control for this project’s agents' });
      expect(remote).toBeDisabled();
      expect(remote).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText('On for all projects in Settings › Harness')).toBeVisible();
      expect(screen.getByText(/^Every agent of this project/)).toHaveTextContent(
        'Every agent of this project, existing or new (ticket agents included), is reachable from claude.ai and the Claude app. Escouade starts each one’s claude process right away, and it stays running. The session appears on claude.ai as “project · agent” (for a ticket agent, the name comes from the ticket). In Claude Code view, an interface that is already open only picks it up at its next launch. To set an agent apart: right-click, “Turn off remote control”.',
      );
      expect(screen.getAllByRole('heading').map((h) => h.textContent)).toContain('Remote control');
    });
  });

  it('sets where the worktrees go and how their branches are named, and says where the next one goes', async () => {
    const backend = fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    const dir = screen.getByRole('textbox', { name: 'Dossier des worktrees' });
    expect(dir).toHaveValue('');
    expect(dir).toHaveAttribute('placeholder', '.claude/worktrees');
    expect(dir).toHaveAccessibleDescription(/Le prochain : C:\\code\\demo-api\\\.claude\\worktrees\\<nom>/);
    const agents = screen.getByRole('textbox', { name: 'Préfixe des branches des agents' });
    const tickets = screen.getByRole('textbox', { name: 'Préfixe des branches des tickets' });
    expect(agents).toHaveValue('escouade/');
    expect(tickets).toHaveValue('ticket/');
    expect(screen.getByText('Branche d’un nouvel agent : escouade/<nom>. Vide : son nom seul.')).toBeInTheDocument();
    await userEvent.type(dir, '../demo-api-worktrees');
    expect(screen.getByText('Le prochain : C:\\code\\demo-api-worktrees\\<nom>')).toBeInTheDocument();
    await userEvent.clear(agents);
    await userEvent.type(agents, 'gg/');
    expect(screen.getByText('Branche d’un nouvel agent : gg/<nom>. Vide : son nom seul.')).toBeInTheDocument();
    await userEvent.clear(tickets);
    await save();
    expect(backend.called('update_project')[0].args.project).toMatchObject({
      id: 'p1',
      worktreeDir: '../demo-api-worktrees',
      agentBranchPrefix: 'gg/',
      ticketBranchPrefix: '',
    });
    expect(app.projects[0]).toMatchObject({ worktreeDir: '../demo-api-worktrees', agentBranchPrefix: 'gg/', ticketBranchPrefix: '' });
  });

  it('refuses a worktrees folder or a branch prefix that cannot be, and saves nothing until it is fixed', async () => {
    const backend = fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    const saveButton = screen.getByRole('button', { name: 'Enregistrer' });
    const dir = screen.getByRole('textbox', { name: 'Dossier des worktrees' });
    await userEvent.type(dir, '../demo-api');
    expect(dir).toHaveAttribute('aria-invalid', 'true');
    expect(dir).toHaveAccessibleDescription(/C’est le dossier du projet lui-même\./);
    expect(screen.getByText('Le dossier des worktrees ou un préfixe de branche de « demo-api » n’est pas valide.')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    await userEvent.clear(dir);
    await userEvent.type(dir, '..');
    expect(dir).toHaveAccessibleDescription(/Ce dossier contient celui du projet : choisis-en un à côté/);
    await userEvent.clear(dir);
    await userEvent.type(dir, 'D:wt');
    expect(dir).toHaveAccessibleDescription(/Écris un chemin relatif au dossier du projet, ou un chemin complet \(C:\\…\)\./);
    await userEvent.clear(dir);
    await userEvent.type(dir, '.git/wt');
    expect(dir).toHaveAccessibleDescription(/Ce dossier est dans un dossier \.git\./);
    await userEvent.clear(dir);
    expect(dir).toHaveAttribute('aria-invalid', 'false');
    expect(saveButton).toBeEnabled();
    const tickets = screen.getByRole('textbox', { name: 'Préfixe des branches des tickets' });
    await userEvent.type(tickets, ' x');
    expect(tickets).toHaveAttribute('aria-invalid', 'true');
    expect(tickets).toHaveAccessibleDescription(/Aucun nom de branche ne commence ainsi.*« \\ » ou « @\{ »/);
    expect(saveButton).toBeDisabled();
    await userEvent.click(saveButton);
    expect(backend.called('update_project')).toHaveLength(0);
  });

  it('says in the sensitive zone that closing the project keeps its history, and offers to erase it with the question', async () => {
    fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    expect(
      screen.getByText(
        "Le projet quitte l'application : ses agents, ses terminaux et ses lancements s'arrêtent. Son historique (conversations, tickets, réglages) est gardé : rouvrir ce dossier le retrouve. Les fichiers et les worktrees sur le disque ne sont pas touchés.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer le projet…' }));
    expect(app.modal).toMatchObject({
      kind: 'confirm',
      option: { label: 'Effacer aussi son historique (conversations, tickets, réglages)', value: false },
    });
  });

  it('says it in English', () => {
    setLang('en');
    fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'The project leaves the app: its agents, terminals and launches stop. Its history (conversations, tickets, settings) is kept: adding this folder again brings it back. The files and worktrees on disk are not touched.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'MCP server' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Agents can use Escouade' })).not.toBeInTheDocument();
  });
});

describe('ProjectTab: its default harness (ESC-29)', () => {
  beforeEach(() => {
    resetApp({ projects: [project()] });
    app.engines = [CLAUDE_ENGINE, BARE_ENGINE];
    app.modal = { kind: 'settings' };
  });
  const LABEL = 'Harness par défaut';

  it('is offered only from two harnesses found on', () => {
    fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    expect(screen.queryByRole('group', { name: LABEL })).toBeNull();
  });

  it('is Claude Code until another is chosen, and saved with the project', async () => {
    app.enginesFound = ['claude', 'codex'];
    const backend = fakeBackend();
    render(SettingsModal, { tab: 'projects', projectId: 'p1' });
    const group = screen.getByRole('group', { name: LABEL });
    expect(screen.getByText('Celui des nouveaux agents et des tickets du projet, sauf s’ils en choisissent un autre.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claude Code', pressed: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Harness nu' }));
    expect(group).toBeInTheDocument();
    await save();
    expect(backend.called('update_project')[0].args.project.engine).toBe('codex');
  });
});
