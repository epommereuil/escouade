import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { addProject, expect, send, test } from './fixture';

// The fake CLI runs a subagent in the background as Claude Code does (« sous-agent long », « sous-agent fini »: ESC-13).
// Its own thread asks a permission (`can_use_tool` with the subagent's `agent_id`); the long one then runs until a
// `stop_task` of its task (written to fake-claude.control.jsonl), the other hands its report back.

/**
 * The name of the first agent, read on its card once the app has named it after its first message (the fake CLI answers
 * with the first word and « -fake »): the name is the app's pick, and it changes under the test's hands before that.
 */
async function agentName(page: Page): Promise<string> {
  const name = page.locator('.card .name').first();
  await expect(name).toHaveText(/-fake$/);
  return (await name.innerText()).trim();
}

/** The subagents under the card of the agent called `name` in the sidebar. */
function sidebar(page: Page, name: string) {
  const group = page.getByRole('group', { name: `Sous-agents de ${name}` });
  return {
    group,
    toggle: group.getByRole('button', { name: /^Sous-agents/ }),
    /** The button that unfolds the finished ones (« 1 sous-agent fini »). */
    finished: group.getByRole('button', { name: /sous-agents? finis?$/ }),
    row: (title: string) => group.getByRole('button', { name: new RegExp(title) }),
  };
}

/** The conversation of the agent, and the view of a subagent that takes its place. */
function views(page: Page) {
  return { agent: page.locator('main.conv:not(.subview)'), sub: page.locator('main.conv.subview') };
}

/** What a view of a subagent says of it: its state in the head, its facts (Type, Modèle, Tokens…), its prompt. */
function brief(view: Locator, title: string) {
  const facts = view.getByRole('group', { name: title });
  return {
    crumbs: view.getByRole('navigation', { name: 'Fil d’Ariane' }),
    state: view.locator('header.head .st'),
    fact: (label: string) =>
      facts
        .locator('div')
        .filter({ has: view.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
        .locator('dd'),
    prompt: view.locator('.prompt .ptext'),
    report: view.getByRole('region', { name: 'Rapport' }),
    stop: view.getByRole('button', { name: 'Arrêter' }),
  };
}

/** The lines of a log of the fake CLI (one JSON each): none while it was not written. */
function lines(file: string): Record<string, any>[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/** The text of each message the fake CLI read on its input (its `.stdin.jsonl`). */
function userTexts(file: string): string[] {
  return lines(file).map((m) => {
    const content = m.message?.content;
    return typeof content === 'string' ? content : ((content ?? []) as { text?: string }[]).map((b) => b.text ?? '').join(' ');
  });
}

test('a subagent that runs is read, answered and stopped from its own view', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  await send(page, 'sous-agent long');
  const name = await agentName(page);

  // Under the card of its agent, unfolded while it runs: its title, its model, what it does.
  const subs = sidebar(page, name);
  await expect(subs.group).toBeVisible();
  await expect(subs.toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(subs.toggle).toContainText('1 en cours');
  const row = subs.row('Surveiller le serveur');
  await expect(row).toContainText('Haiku');
  await expect(row).toContainText('curl localhost:3000');
  await expect(row).not.toHaveAttribute('aria-current', 'page');

  // The stack of dots in the « Sous-agents » banner opens it too (one subagent runs: the button is named after it and opens
  // its conversation at once, with no menu); Escape goes back to the agent's conversation, and the focus back to the
  // stack it was opened from.
  const stack = page.locator('main.conv:not(.subview) .plan').getByRole('button', {
    name: 'Ouvrir la conversation du sous-agent Surveiller le serveur',
  });
  // The circles are 16 px; their button, on the real layout, is at least 24 × 24 (WCAG 2.5.8).
  const target = await stack.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(24);
  expect(target?.height).toBeGreaterThanOrEqual(24);
  await stack.click();
  await expect(page.locator('main.conv.subview')).toBeVisible();
  await expect(page.locator('main.conv.subview [aria-current="page"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('main.conv.subview')).toHaveCount(0);
  await expect(stack).toBeFocused();

  // A click in the sidebar opens its conversation, in place of the agent's.
  await row.click();
  await expect(row).toHaveAttribute('aria-current', 'page');
  const { agent: conv, sub: view } = views(page);
  await expect(view).toBeVisible();
  await expect(conv).toBeHidden();
  const sub = brief(view, 'Surveiller le serveur');
  await expect(sub.crumbs.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(sub.crumbs.locator('[aria-current="page"]')).toHaveText('Surveiller le serveur');
  await expect(sub.state).toHaveText('En cours');
  await expect(sub.fact('Type')).toHaveText('Explore');
  // Named with the version the claude of its account runs for the alias (it lists `haiku`, as Claude Code 2.1.302 does).
  await expect(sub.fact('Modèle')).toHaveText('Haiku 5.5');
  await expect(view.locator('.prompt .k')).toHaveText('Consigne');
  await expect(sub.prompt).toHaveText('Surveille le serveur de dev\net dis-moi quand il répond.');
  await expect(sub.stop).toBeVisible();
  await expect(sub.report).toHaveCount(0);

  // Its thread, and the request it made: answered here.
  await expect(view.getByText('Je regarde le serveur.')).toBeVisible();
  const ask = view.getByTestId('permission-pending');
  await expect(ask).toContainText('curl localhost:3000');
  await ask.getByRole('button', { name: 'Autoriser', exact: true }).click();
  await expect(view.getByTestId('permission-pending')).toHaveCount(0);
  await expect(view.getByText('Le serveur répond, je continue de surveiller.')).toBeVisible();
  // It goes on.
  await expect(sub.state).toHaveText('En cours');
  await expect(sub.stop).toBeVisible();

  // « Arrêter » stops it alone: one stop_task for its task, the state says so and the button goes.
  await sub.stop.click();
  await expect(sub.state).toHaveText('Arrêté');
  await expect(sub.stop).toHaveCount(0);
  const control = path.join(app.root, 'fake-claude.control.jsonl');
  const stops = lines(control).filter((r) => r.subtype === 'stop_task');
  expect(stops).toHaveLength(1);
  expect(stops[0]).toMatchObject({ subtype: 'stop_task', task_id: 'fakelong-agent' });
  // It ended without a report.
  await expect(view.getByText('Ce sous-agent n’a pas rendu de rapport.')).toBeVisible();
  await expect(sub.report).toHaveCount(0);

  // The breadcrumb leads back to the conversation of the agent, which says the subagent was stopped.
  await sub.crumbs.getByRole('button', { name, exact: true }).click();
  await expect(conv).toBeVisible();
  await expect(view).toHaveCount(0);
  await expect(conv.getByText('Le sous-agent a été arrêté.')).toBeVisible();
  // Its request, answered in its view, is there too, no longer waiting.
  await expect(conv.getByText('↳ Demande du sous-agent « Surveiller le serveur »')).toBeVisible();
  await expect(conv.getByTestId('permission-pending')).toHaveCount(0);

  // In the sidebar none runs: the group folds, and counts one finished, which the button unfolds.
  await expect(subs.toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(subs.toggle).toContainText('1 fini');
  await expect(subs.toggle).not.toContainText('en cours');
  await expect(row).toHaveCount(0);
  await subs.toggle.click();
  await expect(subs.finished).toContainText('1 sous-agent fini');
  await subs.finished.click();
  await expect(row).toContainText('Arrêté');
  await expect(row).not.toHaveAttribute('aria-current', 'page');
});

test('a finished subagent is answered from the conversation of its agent, and stays readable after a restart', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  await send(page, 'sous-agent fini');
  const name = await agentName(page);

  // The request of the subagent is in the conversation of the agent, with who asks.
  const { agent: conv, sub: view } = views(page);
  await expect(conv.getByText('↳ Demande du sous-agent « Chercher la cause »')).toBeVisible();
  const ask = conv.getByTestId('permission-pending');
  await expect(ask).toContainText('grep -n pdf src/filter.ts');
  await ask.getByRole('button', { name: 'Autoriser', exact: true }).click();
  await expect(conv.getByText('Rapport reçu.')).toBeVisible();
  await expect(sidebar(page, name).toggle).toContainText('1 fini');

  // The line of its call has the way to its conversation.
  await conv.locator('.tool').getByRole('button', { name: 'Ouvrir la conversation du sous-agent Chercher la cause', exact: true }).click();
  const sub = brief(view, 'Chercher la cause');
  await expect(view).toBeVisible();
  await expect(sub.state).toHaveText('Terminé');
  await expect(sub.fact('Type')).toHaveText('general-purpose');
  await expect(sub.fact('Modèle')).toHaveText(/^Sonnet/);
  await expect(sub.fact('Tokens')).toHaveText('4,2 k');
  await expect(sub.prompt).toHaveText('Cherche pourquoi les PDF sont refusés.');
  await expect(view.getByText('Trouvé : le filtre refuse les PDF.')).toBeVisible();
  await expect(sub.report).toContainText('Cause trouvée');
  await expect(sub.report).toContainText('le filtre de src/filter.ts refuse les PDF.');
  await expect(sub.stop).toHaveCount(0);

  // The app stopped and started again: the conversation of the subagent and its report are still there.
  const before = page;
  const back = await app.restart();
  expect(back).toBe(app.page);
  expect(back).not.toBe(before);
  // A second start of the app, on the same data: what is shown below is what it read back, not what it kept in memory. Its
  // log line may come after its page: waited for.
  const starts = () => fs.readFileSync(path.join(app.data, 'app.log'), 'utf8').match(/Escouade \S+ starting/g)?.length ?? 0;
  await expect.poll(starts).toBe(2);
  await back.locator('.card', { hasText: name }).first().click();
  const subs = sidebar(back, name);
  await expect(subs.group).toBeVisible();
  if ((await subs.toggle.getAttribute('aria-expanded')) !== 'true') await subs.toggle.click();
  await expect(subs.finished).toContainText('1 sous-agent fini');
  await subs.finished.click();
  const row = subs.row('Chercher la cause');
  await expect(row).toContainText('Terminé');
  await row.click();
  const again = views(back).sub;
  const kept = brief(again, 'Chercher la cause');
  await expect(again).toBeVisible();
  await expect(kept.state).toHaveText('Terminé');
  await expect(kept.fact('Modèle')).toHaveText(/^Sonnet/);
  await expect(kept.fact('Tokens')).toHaveText('4,2 k');
  await expect(kept.prompt).toHaveText('Cherche pourquoi les PDF sont refusés.');
  await expect(again.getByText('Trouvé : le filtre refuse les PDF.')).toBeVisible();
  await expect(kept.report).toContainText('Cause trouvée');
  await expect(kept.report).toContainText('Correction proposée');
});

test('a message written in the view of a subagent goes to its agent, who passes it on with SendMessage', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  await send(page, 'sous-agent long');
  const name = await agentName(page);

  const subs = sidebar(page, name);
  await subs.row('Surveiller le serveur').click();
  const { sub: view } = views(page);
  const sub = brief(view, 'Surveiller le serveur');
  await expect(sub.state).toHaveText('En cours');
  await view.getByTestId('permission-pending').getByRole('button', { name: 'Autoriser', exact: true }).click();
  await expect(view.getByText('Le serveur répond, je continue de surveiller.')).toBeVisible();

  // Claude Code lets no host write to a subagent: the field says it goes through the agent.
  const field = view.getByRole('textbox', { name: `Lui écrire, par ${name}` });
  const submit = view.getByRole('button', { name: `Envoyer à ${name}` });
  await expect(submit).toBeDisabled();
  await field.fill('Regarde aussi le port 8080');
  await submit.click();
  await expect(field).toHaveValue('');
  await expect(page.getByText(`Message envoyé à ${name}, qui le transmet au sous-agent.`)).toBeVisible();

  // What the agent got on its input: the instruction to pass the text on to the task, as it is.
  const stdin = path.join(app.root, 'fake-claude.stdin.jsonl');
  const passedOn = () => userTexts(stdin).filter((text) => text.includes('SendMessage'));
  await expect.poll(passedOn).toHaveLength(1);
  const [passed] = passedOn();
  expect(passed).toContain('fakelong-agent');
  expect(passed).toContain('Surveiller le serveur');
  expect(passed).toContain('Regarde aussi le port 8080');
  // The message is the agent's turn, in its own conversation: it passed it on with SendMessage.
  await sub.crumbs.getByRole('button', { name, exact: true }).click();
  const { agent: conv } = views(page);
  await expect(conv.getByText('Message transmis au sous-agent.')).toBeVisible();
  await expect(conv.locator('.tool .badge', { hasText: 'SendMessage' })).toBeVisible();
});

test('a subagent whose call names no model shows the one its messages come from', async ({ app }) => {
  const { page } = app;
  await addProject(page, app.repo);
  await send(page, 'sous-agent sans modèle');
  const name = await agentName(page);
  await expect(page.getByText('Rapport reçu.')).toBeVisible();
  // Finished: under its agent's card, in the finished ones, with the model it ran on.
  const subs = sidebar(page, name);
  await expect(subs.group).toBeVisible();
  if ((await subs.toggle.getAttribute('aria-expanded')) !== 'true') await subs.toggle.click();
  await subs.finished.click();
  const row = subs.row('Lister les fichiers');
  await expect(row).toContainText('Haiku 5.5');
  // Its view says it too.
  await row.click();
  const { sub } = views(page);
  await expect(brief(sub, 'Lister les fichiers').fact('Modèle')).toHaveText('Haiku 5.5');
});
