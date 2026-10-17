import type { Page } from '@playwright/test';
import { addProject, expect, send, test } from './fixture';

// The registry of the harnesses (ESC-28): the version of Claude Code found, placed against the ones Escouade was tested
// with. The fake `claude` prints FAKE_CLAUDE_VERSION for `--version` (2.1.301 by default, the newest tested).

async function claudeSettings(page: Page) {
  await page.getByRole('button', { name: 'Réglages (Ctrl+,)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Réglages' });
  await dialog.getByRole('tab', { name: 'Harness' }).click();
  return dialog;
}

test('the settings tell the version of Claude Code found, one Escouade was tested with', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  const dialog = await claudeSettings(page);
  const version = dialog.locator('[data-state]');
  await expect(version).toHaveText('2.1.301');
  // The test's Claude Code folder has no sign-in: that is what keeps it from being ready.
  await expect(version).toHaveAttribute('data-state', 'notConnected');
  await expect(
    dialog.getByText(
      'Testée avec Escouade (de la 2.1.283 à la 2.1.301). Aucun compte connecté : connecte-toi dans l’onglet Comptes Claude.',
    ),
  ).toBeVisible();
});

test.describe('a Claude Code older than the tested ones', () => {
  test.use({ appEnv: { FAKE_CLAUDE_VERSION: '2.0.14' } });

  test('is refused, with its reason, in the settings and when an agent starts', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    const refusal =
      'Claude Code 2.0.14 est trop ancien pour Escouade, qui demande au moins la version 2.1.283 : son flux JSON n’a été vérifié qu’à partir de celle-ci (docs/PROTOCOL.md). Mets-le à jour (claude update).';
    await send(page, 'Bonjour');
    await expect(page.getByText(refusal).first()).toBeVisible();
    // Nothing was started: the fake CLI never got the message.
    await expect(page.getByText('Bonjour, tu as dit : Bonjour')).toHaveCount(0);
    expect(app.launches().filter((l: { argv: string[] }) => l.argv.includes('stream-json'))).toEqual([]);
    const dialog = await claudeSettings(page);
    await expect(dialog.locator('[data-state]')).toHaveAttribute('data-state', 'tooOld');
    await expect(dialog.getByText(refusal)).toBeVisible();
  });
});

test.describe('a Claude Code newer than the tested ones', () => {
  test.use({ appEnv: { FAKE_CLAUDE_VERSION: '2.1.999' } });

  test('runs the agent, and the settings warn that it was not tested', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    await send(page, 'Bonjour');
    await expect(page.getByText('Bonjour, tu as dit : Bonjour')).toBeVisible();
    const dialog = await claudeSettings(page);
    await expect(dialog.locator('[data-state]')).toHaveText('2.1.999');
    await expect(
      dialog.getByText(
        'Claude Code 2.1.999 n’a pas été testé avec Escouade (testé jusqu’à la 2.1.301) : il est utilisé quand même, et ce qu’Escouade ne reconnaît pas de lui est ignoré. Aucun compte connecté : connecte-toi dans l’onglet Comptes Claude.',
      ),
    ).toBeVisible();
  });
});
