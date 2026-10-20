import fs from 'node:fs';
import path from 'node:path';
import { addProject, expect, send, test } from './fixture';

// Two Claude accounts, both simulated: Principal is the app's own Claude Code folder (the app is started with a
// CLAUDE_CONFIG_DIR of the test's, which Principal inherits: it is never given one), the second has a folder of its own
// under the test's. The fake `claude` keeps its sessions in the folder of the account it runs for, and stops every turn at
// the usage limit while that folder holds a `fake-limit` file.

/** A sign-in that is not out of date. The usage endpoint is a closed port: nothing is ever read of it, the accounts stay signed in. */
const SIGNED_IN = JSON.stringify({ claudeAiOauth: { accessToken: 'tok', refreshToken: 'ref', expiresAt: 4_102_444_800_000 } });

const principalDir = (root: string) => path.join(root, 'claude');
const proDir = (root: string) => path.join(root, 'claude-pro');

/** Both accounts signed in, Principal out of quota for good, and the second account in the settings the app starts with, with the move to another account at the limit switched on (it is off by default). */
function twoAccounts(name: string) {
  return (root: string) => {
    for (const dir of [principalDir(root), proDir(root)]) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '.credentials.json'), SIGNED_IN);
    }
    fs.writeFileSync(path.join(principalDir(root), 'fake-limit'), '');
    return { switchOnLimit: true, accounts: [{ id: 'pro', name, configDir: proDir(root), claudePath: '', active: true }] };
  };
}

/** Whether a launch of the fake `claude` is an agent's process: not a one-shot question (`claude -p`), nor a reading of the models of an account (`initialize` alone, without a session: ESC-124). */
const isAgent = (l: { argv: string[] }) => !l.argv.includes('-p') && !l.argv.includes('--no-session-persistence');

/** The `CLAUDE_CONFIG_DIR` of each agent's process so far, in order. */
const processes = (launches: { argv: string[]; configDir: string | null }[]) => launches.filter(isAgent).map((l) => l.configDir);

test.describe('two accounts, the first out of quota', () => {
  const NAME = 'Pro de l’équipe plateforme (partagé)';
  test.use({ preStart: { run: twoAccounts(NAME) } });

  test('the first ticket stops at the usage limit and goes on on the second account, the next one starts there', async ({ app }) => {
    const { page } = app;
    const [principal, pro] = [principalDir(app.root), proDir(app.root)];
    await addProject(page, app.repo, { firstAgent: false });
    await page.getByRole('button', { name: /^Kanban/ }).click();
    const review = page.getByRole('region', { name: 'À tester' });
    const add = async (title: string) => {
      await page.getByRole('button', { name: 'Nouveau ticket' }).click();
      await page.getByRole('textbox', { name: 'Titre du ticket' }).fill(title);
      await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    };

    // The first ticket goes to Principal, the first account, which is out of quota: its agent meets the limit there, and
    // goes on on the second account with its session, rather than wait for Principal to reset.
    await add('Premier [ok]');
    await expect(review.getByText('DEM-1', { exact: true })).toBeVisible({ timeout: 60_000 });
    expect(processes(app.launches())).toEqual([principal, pro]);
    // The session went along: the second account resumed it.
    const resumed = app.launches().filter(isAgent)[1];
    expect(resumed.argv.some((a) => a.startsWith('--resume='))).toBe(true);
    // The conversation says so.
    await review.getByRole('button', { name: /DEM-1/ }).click();
    await expect(page.getByText(`L’agent reprend sur le compte ${NAME} (il était sur Principal).`)).toBeVisible();

    // The status bar shows the second account as the current one; its long name is cut short, whole in its tooltip.
    const group = page.getByRole('button', { name: `Quotas par compte (compte en cours : ${NAME})` });
    await expect(group).toBeVisible();
    const label = group.locator('.acct');
    await expect(label).toHaveAttribute('data-tip', NAME);
    expect(await label.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    // The bars are the button's to describe: both windows, said to a screen reader.
    await expect(group).toHaveAccessibleDescription(/^Quota sur 5 heures : .*\. Quota sur 7 jours : /);

    // The next ticket starts on the second account at once: Principal is past the threshold.
    await page.getByRole('button', { name: /^Kanban/ }).click();
    await add('Deuxième [ok]');
    await expect(review.getByText('DEM-2', { exact: true })).toBeVisible({ timeout: 60_000 });
    expect(processes(app.launches())).toEqual([principal, pro, pro]);
  });
});

test.describe('two accounts, a conversation stopped by the usage limit', () => {
  test.use({ preStart: { run: twoAccounts('Pro') } });

  test('goes on, with its session, on the other account from the card of its turn', async ({ app }) => {
    const { page } = app;
    const [principal, pro] = [principalDir(app.root), proDir(app.root)];
    await addProject(page, app.repo);
    await send(page, 'Bonjour');
    // Principal is out of quota: the turn stops at the limit, and the card offers the other account.
    await expect(page.getByText("Le tour s'est terminé en erreur")).toBeVisible();
    await expect(page.getByText(/^Reprise automatique/)).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre sur Pro' }).click();
    // "continue" is sent, as the automatic resume sends it, and answered on the second account.
    await expect(page.getByText('Bonjour, tu as dit : continue')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprendre sur Pro' })).toBeHidden();
    await expect(page.getByText(/^Reprise automatique/)).toBeHidden();
    expect(processes(app.launches())).toEqual([principal, pro]);
    // Its session is in both folders (copied, not moved), the second's with the turn that followed.
    const session = (dir: string) => {
      const projects = path.join(dir, 'projects');
      return fs
        .readdirSync(projects)
        .flatMap((f) => fs.readdirSync(path.join(projects, f)).map((n) => path.join(projects, f, n)))
        .filter((f) => f.endsWith('.jsonl'));
    };
    expect(session(principal)).toHaveLength(1);
    expect(session(pro).map((f) => path.basename(f))).toEqual(session(principal).map((f) => path.basename(f)));
    expect(fs.readFileSync(session(pro)[0], 'utf8')).toContain('Bonjour, tu as dit : continue');
  });
});

// The accounts of two harnesses (ESC-30): Claude Code's, and one of Codex saved in the settings, alone (ESC-128: no
// harness has a Principal the user did not add). No agent runs on Codex here: its accounts are only listed, reserved and
// put in order.
test.describe('the accounts of two harnesses', () => {
  test.use({
    preStart: {
      run: (root: string) => {
        fs.mkdirSync(proDir(root), { recursive: true });
        return {
          accounts: [
            { id: 'pro', name: 'Pro', configDir: proDir(root), claudePath: '', active: true },
            { id: 'work', name: 'Travail', engine: 'codex', configDir: path.join(root, 'codex-work'), claudePath: '', active: true },
          ],
        };
      },
    },
  });

  test('are grouped by harness, reserved to projects and put in order, the status bar on Claude Code’s', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    // The status bar shows the accounts of the harness of the agent shown: Claude Code's, its two windows.
    const group = page.getByRole('button', { name: 'Quotas par compte (compte en cours : Principal)' });
    await expect(group).toBeVisible();
    await expect(group).toHaveAccessibleDescription(/^Quota sur 5 heures : .*\. Quota sur 7 jours : /);
    // The panel groups them by harness; Codex's has no quota read.
    await group.click();
    const panel = page.getByRole('dialog', { name: 'Quotas des comptes' });
    await expect(panel.getByRole('heading')).toHaveText(['Claude Code', 'Codex']);
    await expect(panel.getByRole('region', { name: 'Comptes Codex' }).getByRole('group', { name: 'Travail' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Réglages (Ctrl+,)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Réglages' });
    await dialog.getByRole('tab', { name: 'Comptes' }).click();
    const claude = dialog.getByRole('list', { name: 'Comptes Claude Code' });
    const codex = dialog.getByRole('list', { name: 'Comptes Codex' });
    await expect(claude.getByRole('listitem')).toHaveCount(2);
    // The account added alone: no Principal of Codex came with it (ESC-128).
    await expect(codex.getByRole('listitem')).toHaveCount(1);
    // Its only account stays on, whatever Claude Code has.
    await expect(codex.getByRole('listitem', { name: 'Travail' }).getByRole('switch', { name: 'Actif' })).toBeDisabled();
    await expect(claude.getByRole('listitem', { name: 'Pro' }).getByRole('switch', { name: 'Actif' })).toBeEnabled();

    // Reserved to the project, as a Claude account is.
    await codex.getByRole('listitem', { name: 'Travail' }).getByRole('checkbox', { name: 'demo-api' }).check();
    const settings = () => JSON.parse(fs.readFileSync(path.join(app.root, 'data', 'settings.json'), 'utf8'));
    await expect.poll(() => settings().accounts.find((a: { id: string }) => a.id === 'work')?.projects).toEqual([expect.any(String)]);

    // « Ordre des harness »: every harness Escouade knows (OpenCode too, ESC-44, and Copilot CLI, ESC-39), Codex first, kept by the backend.
    const order = dialog.getByRole('list', { name: 'Ordre des harness' });
    await expect(order.getByRole('listitem')).toHaveText([/Claude Code/, /Codex/, /Copilot CLI/, /OpenCode/]);
    await order.getByRole('button', { name: 'Monter Codex' }).click();
    await expect(order.getByRole('listitem')).toHaveText([/Codex/, /Claude Code/, /Copilot CLI/, /OpenCode/]);
    await expect.poll(() => settings().engineOrder).toEqual(['codex', 'claude', 'copilot', 'opencode']);
    // The groups follow it.
    await expect
      .poll(() => dialog.getByRole('list', { name: /^Comptes / }).evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label'))))
      .toEqual(['Comptes Codex', 'Comptes Claude Code']);
  });

  test('the statistics are filtered by harness and put the harnesses side by side', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    await send(page, 'Bonjour');
    await expect(page.getByText('Tâche terminée')).toBeVisible();
    await page.getByRole('button', { name: 'Stats' }).click();
    const harness = page.getByRole('combobox', { name: 'Harness' });
    await expect(harness.getByRole('option')).toHaveText(['Tous les harness', 'Claude Code', 'Codex']);
    // The turn of Claude Code's agent, by harness.
    const byEngine = page.getByRole('table', { name: 'Par harness' });
    await expect(byEngine.getByRole('row')).toHaveCount(2);
    await expect(byEngine.getByRole('row').nth(1)).toContainText('Claude Code');
    const prompts = page.locator('.kpi').filter({ hasText: 'Prompts' });
    await expect(prompts).toContainText('1');
    // Codex alone: nothing it ran, nor any prompt of it.
    await harness.selectOption({ label: 'Codex' });
    await expect(prompts.locator('.kv')).toHaveText('0');
    // Its accounts alone: « Travail », the only one added (ESC-128), nothing to choose from.
    await expect(page.getByRole('combobox', { name: 'Compte' })).toHaveCount(0);
    await harness.selectOption({ label: 'Claude Code' });
    await expect(page.getByRole('combobox', { name: 'Compte' }).getByRole('option')).toHaveText(['Tous les comptes', 'Principal', 'Pro']);
  });
});

// ESC-128: a first installation has no account, for any harness. « Ajouter un compte… » offers the account signed in on
// the machine (the app's CLAUDE_CONFIG_DIR, the test's, signed in here) or a new one; without one, nothing starts.
test.describe('a first installation, without an account', () => {
  test.use({
    preStart: {
      run: (root: string) => {
        fs.mkdirSync(principalDir(root), { recursive: true });
        fs.writeFileSync(path.join(principalDir(root), '.credentials.json'), SIGNED_IN);
        fs.writeFileSync(
          path.join(principalDir(root), '.claude.json'),
          JSON.stringify({ oauthAccount: { emailAddress: 'ada@atlas.dev' } }),
        );
        return { noAccounts: true };
      },
    },
  });

  test('refuses an agent with « Ajouter un compte… », which adds the machine’s account, then the agent starts on it', async ({ app }) => {
    const { page } = app;
    // The first screen leads to it.
    const welcome = page.getByRole('region', { name: 'Aucun compte' });
    await expect(welcome).toContainText('Seuls les comptes ajoutés lancent des agents.');
    await addProject(page, app.repo);
    // Its first agent was not made: none starts on an account it does not have; the window says why.
    await expect(page.locator('.toast').filter({ hasText: 'Aucun compte Claude Code' }).first()).toBeVisible();
    expect(app.launches().filter(isAgent)).toEqual([]);
    // Réglages › Comptes: Claude Code installed, « Aucun compte ».
    await page.getByRole('button', { name: 'Réglages (Ctrl+,)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Réglages' });
    await dialog.getByRole('tab', { name: 'Comptes' }).click();
    const empty = dialog.getByRole('group', { name: 'Comptes Claude Code' });
    await expect(empty).toContainText('Aucun compte');
    await page.keyboard.press('Escape');
    // A new agent is refused, with the button that adds one on its harness.
    await page.getByRole('button', { name: '+ Nouvel agent' }).first().click();
    const toast = page.locator('.toast').filter({ hasText: 'Aucun compte Claude Code : ajoute-en un dans Réglages › Comptes.' }).last();
    await expect(toast).toBeVisible();
    await expect(toast).not.toContainText('no-account');
    await toast.getByRole('button', { name: 'Ajouter un compte…' }).click();
    // The machine's account, signed in here: offered first, with who it is.
    const modal = page.getByRole('dialog', { name: 'Ajouter un compte Claude Code' });
    await expect(modal.getByText('Claude Code est connecté sur cette machine · ada@atlas.dev')).toBeVisible();
    await expect(modal.getByRole('radio', { name: /Le compte de la machine/ })).toBeChecked();
    // Or a new one, with its own folder and sign-in.
    await modal.getByRole('radio', { name: /Un nouveau compte/ }).check();
    await expect(modal.getByRole('textbox', { name: 'Nom' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Créer et se connecter' })).toBeVisible();
    await modal.getByRole('radio', { name: /Le compte de la machine/ }).check();
    await modal.getByRole('button', { name: 'Ajouter ce compte' }).click();
    // Back to the accounts: it is there, and in the settings, launched without a folder of Escouade's.
    const claude = dialog.getByRole('list', { name: 'Comptes Claude Code' });
    await expect(claude.getByRole('listitem')).toHaveCount(1);
    await expect(claude.getByRole('listitem', { name: 'Principal' })).toContainText('Compte de la machine');
    const settings = () => JSON.parse(fs.readFileSync(path.join(app.root, 'data', 'settings.json'), 'utf8'));
    await expect.poll(() => settings().accounts.map((a: { id: string }) => a.id)).toEqual(['principal']);
    await page.keyboard.press('Escape');
    // Now an agent starts on it.
    await page.getByRole('button', { name: '+ Nouvel agent' }).first().click();
    await send(page, 'Bonjour');
    await expect(page.getByText('Tâche terminée')).toBeVisible();
    expect(processes(app.launches())).toEqual([principalDir(app.root)]);
  });
});

test.describe('two accounts whose claude does not list the same models (ESC-124)', () => {
  // Principal has no Fable; Pro has Mythos more, which takes two efforts. Neither is out of quota.
  test.use({
    preStart: {
      run: (root) => {
        for (const dir of [principalDir(root), proDir(root)]) {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, '.credentials.json'), SIGNED_IN);
        }
        fs.writeFileSync(path.join(principalDir(root), 'fake-models.json'), JSON.stringify({ remove: ['fable'] }));
        const mythos = {
          value: 'mythos',
          resolvedModel: 'claude-mythos-1',
          displayName: 'Mythos',
          supportsEffort: true,
          supportedEffortLevels: ['high', 'max'],
          supportsAutoMode: true,
        };
        fs.writeFileSync(path.join(proDir(root), 'fake-models.json'), JSON.stringify({ add: [mythos] }));
        return { accounts: [{ id: 'pro', name: 'Pro', configDir: proDir(root), claudePath: '', active: true }] };
      },
    },
  });

  test('the composer offers those of the agent’s account, and an agent moved to one without its model takes the default one', async ({
    app,
  }) => {
    const { page } = app;
    await addProject(page, app.repo);
    const model = page.getByRole('button', { name: /^Modèle/ });
    const option = (name: RegExp) => page.getByRole('menuitemradio', { name });
    // On Principal: what its claude listed at the start of the app, before any turn: no Fable, no Mythos.
    await model.click();
    await expect(option(/Fable/)).toHaveCount(0, { timeout: 30_000 });
    await expect(option(/Mythos/)).toHaveCount(0);
    await expect(option(/Opus 5\.5/)).toBeVisible();
    await expect(option(/Haiku 4\.5/)).toBeVisible();
    await page.keyboard.press('Escape');

    // On Pro: Fable is there, and Mythos, with its two efforts.
    await page.getByRole('button', { name: /^Compte/ }).click();
    await option(/^Pro/).click();
    await model.click();
    await expect(option(/Fable 5\.1/)).toBeVisible();
    await option(/Mythos/).click();
    await expect(page.getByRole('button', { name: 'Modèle : Mythos' })).toBeVisible();
    await page.getByRole('button', { name: /^Effort/ }).click();
    await expect(page.getByRole('menuitemradio')).toHaveText([/^✓?\s*Élevé/, /^✓?\s*Max/]);
    await page.keyboard.press('Escape');

    // Back on Principal, which has no Mythos: the default model, and its conversation says so.
    await page.getByRole('button', { name: /^Compte/ }).click();
    await option(/^Principal/).click();
    await expect(
      page.getByText('Le compte Principal n’a pas le modèle mythos : l’agent passe sur Sonnet 5.5, son modèle par défaut.'),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Modèle : Sonnet 5.5' })).toBeVisible();
    // The model asked to its process is that one, and no turn was needed to read the lists.
    await send(page, 'Bonjour');
    await expect(page.getByText('Bonjour, tu as dit : Bonjour')).toBeVisible({ timeout: 30_000 });
    const agentRuns = app.launches().filter(isAgent);
    const last = agentRuns.at(-1)!.argv;
    expect(last[last.indexOf('--model') + 1]).toBe('sonnet');
  });
});

test('the status bar projects each window to its reset, unless « Projection des quotas » is off', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  // From this turn on, the 5 h window is at 50 % with 3 h left, the week's at 34 % half way through. The clock goes on
  // while the test runs: the values leave room for it (→ 125 % and → 68 % at once, a few minutes later still in their tens).
  await send(page, 'bonjour [quota-rythme]');
  const bar = page.locator('footer.bar');
  const fiveHour = bar.locator('.q', { hasText: '5h' });
  await expect(fiveHour.locator('.p')).toHaveText(/^projection à la remise à zéro : → 12\d %$/);
  await expect(fiveHour.locator('.p')).toHaveClass(/over/);
  await expect(bar.locator('.q', { hasText: '7j' }).locator('.p')).toHaveText(/→ 6\d %$/);
  await expect(bar.locator('.q', { hasText: '7j' }).locator('.p')).toHaveClass(/ok/);

  // Off in Réglages › Comptes › « Quotas »: gone at once, and kept.
  await page.getByRole('button', { name: 'Réglages (Ctrl+,)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Réglages' });
  await dialog.getByRole('tab', { name: 'Comptes' }).click();
  await dialog.getByRole('switch', { name: 'Projection des quotas' }).click();
  await expect(bar.locator('.p')).toHaveCount(0);
  const settings = () => JSON.parse(fs.readFileSync(path.join(app.root, 'data', 'settings.json'), 'utf8'));
  await expect.poll(() => settings().quotaProjection).toBe(false);
});
