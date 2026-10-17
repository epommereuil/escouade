import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The settings' other tabs have logs (xterm.js): none in jsdom.
vi.mock('../../lib/terminals', () => ({ launchLog: () => ({}), disposeLog() {} }));

import { setLang } from '../../lib/i18n';
import { app } from '../../lib/state.svelte';
import type { Account, AccountStatus, ClosedProject } from '../../lib/types';
import { agent, fakeBackend, project, resetApp, SETTINGS } from '../../test/ipc';
import SettingsModal from '../modals/SettingsModal.svelte';

const PRINCIPAL: Account = { id: 'principal', name: 'Principal', configDir: '', claudePath: '', active: true };
const PRO: Account = { id: 'pro', name: 'Pro', configDir: 'C:\\Users\\ada\\.escouade\\claude\\pro', claudePath: '', active: true };

const status = (over: Record<string, Partial<AccountStatus>> = {}) => {
  const all: Record<string, AccountStatus> = {
    principal: { connected: true, email: 'ada@atlas.dev', dir: 'C:\\Users\\ada\\.claude', stamp: 'principal-sign-in', ...over.principal },
    pro: { connected: false, email: null, dir: PRO.configDir, stamp: null, ...over.pro },
  };
  return (a: { id: string }) => all[a.id];
};

const backend = (over: Record<string, (a: any) => unknown> = {}) =>
  fakeBackend({ account_status: status(), save_settings: () => [], ...over });

/** The row of the account shown as `name`. */
const row = (name: string) => screen.getByRole('listitem', { name });
const names = () => screen.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));

describe('AccountsTab', () => {
  beforeEach(() => {
    resetApp();
    app.settings = { ...SETTINGS, accounts: [PRINCIPAL, PRO] };
    app.modal = { kind: 'settings', tab: 'accounts' };
  });

  it('comes after « Claude Code » and shows each account, its folder and whether it is signed in', async () => {
    const b = backend();
    render(SettingsModal, { tab: 'accounts' });
    const tabs = screen.getAllByRole('tab');
    const at = tabs.indexOf(screen.getByRole('tab', { name: 'Comptes Claude' }));
    expect(tabs[at - 1]).toBe(screen.getByRole('tab', { name: 'Harness' }));
    expect(tabs[at]).toHaveAttribute('aria-selected', 'true');
    expect(names()).toEqual(['Principal', 'Pro']);
    expect(await within(row('Principal')).findByText('Connecté · ada@atlas.dev')).toBeInTheDocument();
    expect(within(row('Principal')).getByText('~/.claude')).toBeInTheDocument();
    expect(await within(row('Pro')).findByText('Pas connecté')).toBeInTheDocument();
    expect(within(row('Pro')).getByText('~/.escouade/claude/pro')).toBeInTheDocument();
    expect(b.called('account_status').map((c) => c.args.id)).toEqual(['principal', 'pro']);
    // Its own claude, else the settings' one.
    expect(within(row('Pro')).getByRole('textbox', { name: 'Exécutable' })).toHaveAttribute('placeholder', 'Celui des réglages');
    // Not signed in: « Se connecter… »; signed in, « Se reconnecter… ».
    expect(within(row('Pro')).getByRole('button', { name: 'Se connecter…' })).toBeInTheDocument();
    expect(within(row('Principal')).queryByRole('button', { name: 'Se connecter…' })).not.toBeInTheDocument();
    expect(within(row('Principal')).getByRole('button', { name: 'Se reconnecter…' })).toBeInTheDocument();
    expect(within(row('Pro')).queryByRole('button', { name: 'Se reconnecter…' })).not.toBeInTheDocument();
    // Principal never goes.
    expect(within(row('Principal')).queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(within(row('Pro')).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    expect(
      screen.getByText('Les nouveaux agents partent sur le premier compte actif sous le seuil de pause, dans cet ordre.'),
    ).toBeInTheDocument();
    // Saved at once: nothing left for « Enregistrer ».
    expect(screen.getByRole('tab', { name: 'Comptes Claude' })).not.toHaveClass('changed');
  });

  it('says what an account at rest, Principal on an API key or a sign-in out of date is', async () => {
    backend({ account_status: status({ principal: { connected: false, email: null }, pro: { connected: true, email: 'ada@pro.dev' } }) });
    app.settings.accounts = [PRINCIPAL, { ...PRO, active: false }];
    app.usage = {
      ...app.usage,
      accounts: [
        { id: 'principal', fiveHour: null, sevenDay: null, connected: false, reason: 'Pas connecté', todayCost: 0, updatedAt: 0 },
        {
          id: 'pro',
          fiveHour: null,
          sevenDay: null,
          connected: true,
          reason: 'Connexion expirée : relance Claude Code pour ce compte.',
          todayCost: 0,
          updatedAt: 0,
        },
      ],
    };
    render(SettingsModal, { tab: 'accounts' });
    expect(await within(row('Principal')).findByText('Pas connecté par un compte claude.ai (clé d’API ?)')).toBeInTheDocument();
    expect(within(row('Principal')).getByRole('button', { name: 'Se connecter…' })).toBeInTheDocument();
    expect(await within(row('Pro')).findByText('Inactif')).toBeInTheDocument();
    expect(within(row('Pro')).getByText('Connexion expirée : relance Claude Code pour ce compte.')).toBeInTheDocument();
    // Expired: a sign-in again gets it a new token.
    expect(within(row('Pro')).getByRole('button', { name: 'Se connecter…' })).toBeInTheDocument();
  });

  it('renames an account and gives it its own claude, as the backend saves them', async () => {
    const b = backend({
      account_update: (a: { account: Account }) => [PRINCIPAL, { ...a.account, name: a.account.name.trim() }],
    });
    render(SettingsModal, { tab: 'accounts' });
    const name = within(row('Pro')).getByRole('textbox', { name: 'Nom' });
    await userEvent.clear(name);
    await userEvent.type(name, ' Boulot {Enter}');
    await waitFor(() => expect(b.called('account_update')).toHaveLength(1));
    expect(b.called('account_update')[0].args.account).toEqual({ ...PRO, name: ' Boulot ' });
    await waitFor(() => expect(names()).toEqual(['Principal', 'Boulot']));
    expect(app.settings.accounts[1].name).toBe('Boulot');
    const exe = within(row('Boulot')).getByRole('textbox', { name: 'Exécutable' });
    await userEvent.type(exe, 'C:\\outils\\claude.exe');
    await userEvent.tab();
    await waitFor(() => expect(b.called('account_update')).toHaveLength(2));
    expect(b.called('account_update')[1].args.account).toEqual({ ...PRO, name: 'Boulot', claudePath: 'C:\\outils\\claude.exe' });
    // Left as it was: nothing sent.
    await userEvent.click(within(row('Boulot')).getByRole('textbox', { name: 'Nom' }));
    await userEvent.tab();
    expect(b.called('account_update')).toHaveLength(2);
  });

  it('puts the name back when the backend refuses it', async () => {
    backend({ account_update: () => Promise.reject('Un compte s’appelle déjà « Principal ».') });
    render(SettingsModal, { tab: 'accounts' });
    const name = within(row('Pro')).getByRole('textbox', { name: 'Nom' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Principal{Enter}');
    await waitFor(() => expect(app.toasts.map((t) => t.text)).toEqual(['Un compte s’appelle déjà « Principal ».']));
    expect(name).toHaveValue('Pro');
  });

  it('puts the accounts in another order', async () => {
    const b = backend({ account_reorder: (a: { ids: string[] }) => a.ids.map((id) => (id === 'pro' ? PRO : PRINCIPAL)) });
    render(SettingsModal, { tab: 'accounts' });
    expect(within(row('Principal')).getByRole('button', { name: 'Monter Principal' })).toBeDisabled();
    expect(within(row('Pro')).getByRole('button', { name: 'Descendre Pro' })).toBeDisabled();
    await userEvent.click(within(row('Principal')).getByRole('button', { name: 'Descendre Principal' }));
    expect(b.called('account_reorder')[0].args.ids).toEqual(['pro', 'principal']);
    await waitFor(() => expect(names()).toEqual(['Pro', 'Principal']));
    await userEvent.click(within(row('Principal')).getByRole('button', { name: 'Monter Principal' }));
    expect(b.called('account_reorder')[1].args.ids).toEqual(['principal', 'pro']);
  });

  it('puts an account at rest, never the last one active', async () => {
    const b = backend({ account_update: (a: { account: Account }) => [PRINCIPAL, a.account] });
    render(SettingsModal, { tab: 'accounts' });
    const principal = within(row('Principal')).getByRole('switch', { name: 'Actif' });
    expect(principal).toBeEnabled();
    await userEvent.click(within(row('Pro')).getByRole('switch', { name: 'Actif' }));
    expect(b.called('account_update')[0].args.account).toEqual({ ...PRO, active: false });
    await waitFor(() => expect(within(row('Pro')).getByRole('switch', { name: 'Actif' })).toHaveAttribute('aria-checked', 'false'));
    // Principal is then the only one active.
    expect(principal).toBeDisabled();
    expect(principal).toHaveAccessibleDescription('Il faut au moins un compte actif.');
  });

  it('keeps Principal to projects too, and says which projects no active account serves then', async () => {
    app.projects = [project({ id: 'p1', name: 'demo' }), project({ id: 'p2', name: 'infra' }), project({ id: 'p3', name: 'web' })];
    const pro = { ...PRO, active: false };
    app.settings.accounts = [PRINCIPAL, pro];
    const b = backend({ account_update: (a: { account: Account }) => [a.account, pro] });
    render(SettingsModal, { tab: 'accounts' });
    expect(screen.getByRole('status').textContent).toBe('');
    await userEvent.click(within(row('Principal')).getByRole('checkbox', { name: 'demo' }));
    expect(b.called('account_update')[0].args.account).toEqual({ ...PRINCIPAL, projects: ['p1'] });
    // Pro switched off: no account serves the others any more, and the tab says so.
    const status = screen.getByRole('status');
    await waitFor(() =>
      expect(status).toHaveTextContent('Aucun compte actif ne sert « infra » et « web » : leurs agents et leurs tickets ne démarrent pas.'),
    );
    await userEvent.click(within(row('Principal')).getByRole('checkbox', { name: 'web' }));
    await waitFor(() =>
      expect(status).toHaveTextContent('Aucun compte actif ne sert « infra » : ses agents et ses tickets ne démarrent pas.'),
    );
  });

  it('does not remove an account agents still run on', async () => {
    const b = backend();
    resetApp({
      agents: [
        agent({ id: 'a1', account: 'pro' }),
        agent({ id: 'a2', account: 'pro' }),
        agent({ id: 'a3', account: 'pro', archived: true }),
      ],
    });
    app.settings = { ...SETTINGS, accounts: [PRINCIPAL, PRO] };
    app.modal = { kind: 'settings', tab: 'accounts' };
    render(SettingsModal, { tab: 'accounts' });
    await userEvent.click(within(row('Pro')).getByRole('button', { name: 'Supprimer' }));
    expect(within(row('Pro')).getByRole('alert')).toHaveTextContent('Le compte sert encore à 2 agents.');
    expect(app.modal?.kind).toBe('settings');
    delete app.agents.a2;
    await userEvent.click(within(row('Pro')).getByRole('button', { name: 'Supprimer' }));
    expect(within(row('Pro')).getByRole('alert')).toHaveTextContent('Le compte sert encore à 1 agent.');
    expect(b.called('account_remove')).toHaveLength(0);
  });

  it('removes an account once confirmed, saying its folder stays, then comes back to the tab', async () => {
    const b = backend({ account_remove: () => [PRINCIPAL] });
    render(SettingsModal, { tab: 'accounts' });
    await userEvent.click(within(row('Pro')).getByRole('button', { name: 'Supprimer' }));
    const modal = app.modal;
    if (modal?.kind !== 'confirm') throw new Error(`${modal?.kind}`);
    expect(modal.title).toBe('Supprimer le compte « Pro » ?');
    expect(modal.body).toBe(
      'Les nouveaux agents ne partiront plus dessus. Son dossier reste sur le disque, avec sa connexion et ses conversations : ~/.escouade/claude/pro',
    );
    expect(modal.danger).toBe(true);
    await modal.onConfirm(false);
    expect(b.called('account_remove')[0].args.id).toBe('pro');
    expect(app.settings.accounts).toEqual([PRINCIPAL]);
    expect(app.modal).toEqual({ kind: 'settings', tab: 'accounts', resume: true });
    // Cancelled: back to the tab, nothing removed.
    modal.onCancel?.();
    expect(app.modal).toEqual({ kind: 'settings', tab: 'accounts', resume: true });
  });

  it('opens the window that adds an account, or signs one in', async () => {
    backend();
    render(SettingsModal, { tab: 'accounts' });
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un compte…' }));
    expect(app.modal).toEqual({ kind: 'account' });
    // (Rendered here by itself, the tab is still there.)
    await userEvent.click(await within(row('Pro')).findByRole('button', { name: 'Se connecter…' }));
    expect(app.modal).toEqual({ kind: 'account', accountId: 'pro' });
  });

  describe('and the projects closed with their history kept', () => {
    /** A closed project, as `closed_projects` lists it (or an entry it cannot read, with `unreadable`). */
    const closed = (id: string, name: string, over: Partial<ClosedProject> = {}): ClosedProject => ({
      id,
      name,
      color: 'oklch(0.72 0.12 300)',
      path: `C:\\code\\${name}`,
      worktreePerAgent: false,
      agents: 1,
      tickets: 1,
      lastActivity: 1,
      closedAt: 1,
      size: 1024,
      unreadable: false,
      ...over,
    });
    const checkboxes = (name: string) => within(row(name)).queryAllByRole('checkbox');

    beforeEach(() => {
      app.projects = [project({ id: 'p1', name: 'demo' })];
    });

    it('keeps one an account is reserved to in its list, ticked and marked closed, and unticks it like any other', async () => {
      app.settings.accounts = [PRINCIPAL, { ...PRO, projects: ['p1', 'c1'] }];
      const b = backend({
        closed_projects: () => [closed('c1', 'ancien'), closed('c2', 'vieux')],
        account_update: (a: { account: Account }) => [PRINCIPAL, a.account],
      });
      render(SettingsModal, { tab: 'accounts' });
      const old = await within(row('Pro')).findByRole('checkbox', { name: 'ancien (fermé)' });
      expect(old).toBeChecked();
      expect(within(row('Pro')).getByRole('checkbox', { name: 'demo' })).toBeChecked();
      // Only the closed projects an account is reserved to: not every closed project, and not on the other accounts.
      expect(within(row('Pro')).queryByRole('checkbox', { name: 'vieux (fermé)' })).not.toBeInTheDocument();
      expect(within(row('Principal')).queryByRole('checkbox', { name: 'ancien (fermé)' })).not.toBeInTheDocument();
      expect(b.called('closed_projects')).toHaveLength(1);
      // The same save as for a project that is open, the closed one gone from the list.
      await userEvent.click(old);
      expect(b.called('account_update')[0].args.account).toEqual({ ...PRO, projects: ['p1'] });
      await waitFor(() => expect(within(row('Pro')).queryByRole('checkbox', { name: 'ancien (fermé)' })).not.toBeInTheDocument());
    });

    it('shows the list of an account reserved to a closed project alone, though no project is open', async () => {
      app.projects = [];
      app.settings.accounts = [PRINCIPAL, { ...PRO, projects: ['c1'] }];
      backend({ closed_projects: () => [closed('c1', 'ancien')] });
      render(SettingsModal, { tab: 'accounts' });
      expect(await within(row('Pro')).findByRole('checkbox', { name: 'ancien (fermé)' })).toBeChecked();
      expect(within(row('Pro')).getByRole('group', { name: 'Réservé aux projets' })).toBeInTheDocument();
      expect(within(row('Pro')).queryByText(/Tous les projets/)).not.toBeInTheDocument();
      // Principal has nothing to be reserved to: no list, as before.
      expect(within(row('Principal')).queryByRole('group', { name: 'Réservé aux projets' })).not.toBeInTheDocument();
    });

    it('says « Tous les projets » only when nothing at all is reserved, a closed project included', async () => {
      app.settings.accounts = [PRINCIPAL, { ...PRO, projects: ['c1'] }];
      backend({ closed_projects: () => [closed('c1', 'ancien')] });
      render(SettingsModal, { tab: 'accounts' });
      await within(row('Pro')).findByRole('checkbox', { name: 'ancien (fermé)' });
      expect(within(row('Pro')).queryByText(/Tous les projets/)).not.toBeInTheDocument();
      expect(within(row('Principal')).getByText('· Tous les projets')).toBeInTheDocument();
      // Unticked, the last one: the account is open to every project again.
      app.settings.accounts = [PRINCIPAL, PRO];
      await waitFor(() => expect(within(row('Pro')).getByText('· Tous les projets')).toBeInTheDocument());
    });

    it('shows nothing of a project it has no name for: gone from both lists, or a file the app cannot read', async () => {
      app.settings.accounts = [PRINCIPAL, { ...PRO, projects: ['p1', 'gone', 'bad'] }];
      const b = backend({ closed_projects: () => [closed('bad', '', { unreadable: true, path: '', color: '' })] });
      render(SettingsModal, { tab: 'accounts' });
      await waitFor(() => expect(b.called('closed_projects')).toHaveLength(1));
      await new Promise((r) => setTimeout(r));
      expect(
        within(row('Pro'))
          .getAllByRole('checkbox')
          .map((c) => c.closest('label')?.textContent?.trim()),
      ).toEqual(['demo']);
      expect(checkboxes('Pro')).toHaveLength(1);
    });

    it('is the same list as before when the closed projects cannot be read', async () => {
      app.settings.accounts = [PRINCIPAL, { ...PRO, projects: ['p1', 'c1'] }];
      backend({
        closed_projects: () => {
          throw new Error('disque illisible');
        },
      });
      render(SettingsModal, { tab: 'accounts' });
      expect(await within(row('Pro')).findByRole('checkbox', { name: 'demo' })).toBeChecked();
      await new Promise((r) => setTimeout(r));
      expect(checkboxes('Pro')).toHaveLength(1);
      expect(app.toasts).toEqual([]);
    });

    it('is written in English', async () => {
      setLang('en');
      app.settings.accounts = [PRINCIPAL, { ...PRO, projects: ['c1'] }];
      backend({ closed_projects: () => [closed('c1', 'ancien')] });
      render(SettingsModal, { tab: 'accounts' });
      expect(await within(row('Pro')).findByRole('checkbox', { name: 'ancien (closed)' })).toBeChecked();
    });
  });

  it('reads in English, Principal by its English name until it is renamed', async () => {
    setLang('en');
    backend();
    render(SettingsModal, { tab: 'accounts' });
    expect(screen.getByRole('tab', { name: 'Claude accounts' })).toBeInTheDocument();
    expect(names()).toEqual(['Main', 'Pro']);
    expect(await within(row('Main')).findByText('Signed in · ada@atlas.dev')).toBeInTheDocument();
    expect(await within(row('Pro')).findByText('Not signed in')).toBeInTheDocument();
    expect(within(row('Pro')).getByRole('textbox', { name: 'Executable' })).toHaveAttribute('placeholder', 'The one in the settings');
    expect(screen.getByRole('button', { name: 'Add an account…' })).toBeInTheDocument();
    expect(screen.getByText('New agents start on the first active account under the pause threshold, in this order.')).toBeInTheDocument();
    app.settings.accounts = [{ ...PRINCIPAL, name: 'Perso' }, PRO];
    await waitFor(() => expect(names()).toEqual(['Perso', 'Pro']));
  });
});
