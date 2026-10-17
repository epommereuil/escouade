import path from 'node:path';
import { addProject, expect, FAKE, test } from './fixture';

// Choosing the harness (ESC-29): Réglages › Harness lists each one with its executable, its version, its state and
// « Se connecter… »; with none found, the first start says « Aucun harness trouvé » with the command that installs each.

test('Réglages › Harness shows Claude Code’s executable, version and state, and « Se connecter… » opens its sign-in', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  await page.getByRole('button', { name: 'Réglages (Ctrl+,)' }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages' });
  await settings.getByRole('tab', { name: 'Harness' }).click();
  const claude = settings.getByRole('region', { name: 'Claude Code' });
  await expect(claude.getByRole('textbox', { name: "Chemin de l'exécutable" })).toBeVisible();
  await expect(claude.locator('[data-state]')).toHaveText('2.1.301');
  // The test's Claude Code folder has no sign-in.
  await expect(claude.locator('[data-engine-state]')).toHaveText('Non connecté');
  await claude.getByRole('button', { name: 'Se connecter…' }).click();
  const signIn = page.getByRole('dialog', { name: 'Se connecter au compte « Principal »' });
  await expect(signIn).toBeVisible();
  // Closed: back to the tab it came from.
  await page.keyboard.press('Escape');
  await expect(signIn).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Réglages' }).getByRole('tab', { name: 'Harness' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test.describe('with no harness found', () => {
  test.use({ preStart: { run: (root: string) => ({ claudePath: path.join(root, 'absent', 'claude.cmd') }) } });

  test('the first start says « Aucun harness trouvé » with the command that installs each, and goes once one is found', async ({ app }) => {
    const { page } = app;
    const none = page.getByRole('region', { name: 'Aucun harness trouvé' });
    await expect(none).toBeVisible();
    await expect(none.getByRole('listitem').filter({ hasText: 'Claude Code' })).toContainText('irm https://claude.ai/install.ps1 | iex');
    // Réglages › Harness: not found, with its installer.
    await page.getByRole('button', { name: 'Réglages (Ctrl+,)' }).click();
    const settings = page.getByRole('dialog', { name: 'Réglages' });
    await settings.getByRole('tab', { name: 'Harness' }).click();
    const claude = settings.getByRole('region', { name: 'Claude Code' });
    await expect(claude.locator('[data-engine-state="absent"]')).toHaveText('Introuvable');
    await expect(claude.getByText('irm https://claude.ai/install.ps1 | iex')).toBeVisible();
    // Its path given and saved: it is found, Escouade works.
    await claude.getByRole('textbox', { name: "Chemin de l'exécutable" }).fill(FAKE);
    await settings.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(none).toHaveCount(0);
  });
});
