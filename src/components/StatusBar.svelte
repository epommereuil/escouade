<script lang="ts">
  import { keyLabel } from '../lib/platform';
  import {
    accountName,
    metersShown,
    meterName,
    newAgentAccount,
    principalId,
    projectedDayCost,
    projectionLevel,
    quotaTip,
    statusEngine,
  } from '../lib/accounts';
  import { capsOf, engineName } from '../lib/engines';
  import { fAgo, fBytes, fPct, fUsd } from '../lib/format';
  import { t } from '../lib/i18n';
  import Rich from '../lib/i18n/Rich.svelte';
  import { gitSync, syncInfo, type SyncOp } from '../lib/git-sync.svelte';
  import { api } from '../lib/ipc';
  import { estimatedBy, estimateHint, fSpentUsd } from '../lib/spend';
  import { app } from '../lib/state.svelte';
  import AccountsPanel from './AccountsPanel.svelte';
  import BranchPicker from './branches/BranchPicker.svelte';
  import QuotaMeter from './QuotaMeter.svelte';
  import { tip } from '../lib/tip';

  const agents = $derived(Object.values(app.agents).filter((a) => !a.archived));
  // The day's cost: an estimate while a turn runs, or once a harness that tells none (Codex) spent some of it.
  const today = $derived.by(() => {
    const byHarness = app.usage.accounts.some((u) => u.todayCost > 0 && estimatedBy(u.engine));
    return { cost: app.usage.todayCost + app.liveCost, estimated: byHarness || app.liveCost > 0, byHarness };
  });
  const running = $derived(agents.filter((a) => a.status === 'running').length);
  const waiting = $derived(agents.filter((a) => a.status === 'waiting').length);
  const done = $derived(agents.filter((a) => a.status === 'done').length);
  // The Claude processes running, each with the tools and MCP servers it started.
  const procs = $derived(app.resources);
  const procsTitle = $derived(
    [
      t('shell.status.procsTitle'),
      ...[...procs.agents]
        .sort((a, b) => b.memory - a.memory)
        .map((r) => t('shell.status.procRow', { name: app.agents[r.id]?.name ?? '?', memory: fBytes(r.memory), cpu: fPct(r.cpu) })),
    ].join('\n'),
  );
  // The quota of the current account of the harness of the agent shown (else of the project's default harness): with several
  // accounts, the name in front, and the whole group opens the panel of every account's. A harness without a quota has no
  // bar. (The bar is there before the settings are: no accounts yet.)
  const several = $derived((app.settings.accounts?.length ?? 0) > 1);
  const engine = $derived(statusEngine());
  // Every account reserved to projects (Principal too): the one whose meters the bars show (`usage.current`).
  const shown = $derived(newAgentAccount(undefined, engine) ?? app.settings.accounts?.find((a) => a.id === app.usage.current[engine]));
  const current = $derived(several ? shown : undefined);
  const currentName = $derived(current ? accountName(current) : '');
  const shownUsage = $derived(app.usage.accounts.find((u) => u.id === (shown?.id ?? principalId(engine))) ?? null);
  const meters = $derived(metersShown(shownUsage, engine));
  // A harness without a quota (OpenCode, which goes through the providers' APIs): its account's cost of the day stands in
  // for the bars, out of its « Budget par jour ($) » when it has one.
  const day = $derived.by(() => {
    if (capsOf(engine)?.quota !== 'none' || !shownUsage) return null;
    const cost = shownUsage.todayCost;
    const budget = shownUsage.dailyBudget || null;
    const harness = engineName(engine);
    const tip = budget
      ? t('shell.status.dayBudgetTip', { harness, cost: fUsd(cost), budget: fUsd(budget) })
      : t('shell.status.dayCostTip', { harness, cost: fUsd(cost) });
    // Where the day's cost would end at midnight, against the budget: none without one, which it would be measured by.
    const end = budget && app.settings.quotaProjection !== false ? projectedDayCost(cost, app.now) : null;
    const projection = end === null ? null : { text: fUsd(end), level: projectionLevel((end / budget!) * 100) };
    return { cost, budget, over: !!budget && cost >= budget, tip, harness, projection };
  });
  let panelOpen = $state(false);
  // Down to one account: nothing left to compare.
  $effect(() => {
    if (!several) panelOpen = false;
  });
  // The two windows as their bars say them. Under the button the bars are not reached one by one, so the button says them
  // (to a screen reader as its description, `aria-describedby` rather than `aria-description`, which not every engine reads;
  // in its tooltip, one line each, but while the panel that writes them is open).
  const quotaLines = $derived([
    ...meters.map((m) => t('accounts.quota.line', { name: meterName(m.minutes), tip: quotaTip(m.usage) })),
    ...(day ? [day.tip] : []),
  ]);

  function toggleSound() {
    app.settings.sound = !app.settings.sound;
    app.run(api.saveSettings($state.snapshot(app.settings)));
  }

  /** Seconds left before the automatic restart for the update, when one is planned. */
  const restartIn = $derived(app.restartAt === null ? null : Math.max(0, Math.ceil((app.restartAt - app.now) / 1000)));

  function postpone() {
    app.restartAt = null;
    app.run(api.updatePostpone());
  }

  /** What the branch button says while a sync runs. */
  const runningLabel = (op: SyncOp) =>
    ({ pull: t('branches.sync.pulling'), push: t('branches.sync.pushing'), fetch: t('branches.sync.fetching') })[op];

  /** The active project's checkout, when it is a repository with a branch (or a detached HEAD) checked out. */
  const repo = $derived.by(() => {
    const p = app.ui.view === 'project' ? app.project : null;
    const g = p ? app.git[p.id] : undefined;
    return p && g?.isRepo && g.branch ? { projectId: p.id, git: g, detached: g.branch === '(detached)' } : null;
  });
  /** What it can sync with, when it has a remote. */
  const sync = $derived(repo ? syncInfo(repo.git) : null);
  const busy = $derived(repo ? gitSync.running[repo.projectId] : undefined);

  /** The branch picker, open over the button. */
  let pickerOpen = $state(false);
  let branchButton = $state<HTMLButtonElement>();
  let quotaButton = $state<HTMLButtonElement>();
  // The button is disabled while a sync runs, and a browser takes the focus off a control that becomes disabled: the
  // sync started from the picker, which gave the focus to the button, so the button gets it back when the sync ends (unless
  // the user has put it somewhere since).
  let wasBusy = false;
  $effect(() => {
    const now = !!busy;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (wasBusy && !now && lost) branchButton?.focus();
    wasBusy = now;
  });
  // Nothing to pick a branch of any more (another view, another folder): the picker goes.
  $effect(() => {
    if (!repo) pickerOpen = false;
  });

  const branchTitle = $derived.by(() => {
    if (!sync) return t('branches.picker.switchTitle');
    const fetched = sync.lastFetch ? fAgo(sync.lastFetch / 1000, app.now) : t('shell.status.sync.never');
    return [
      sync.tracked
        ? t('shell.status.sync.tracked', { upstream: sync.upstream ?? '', behind: sync.behind, ahead: sync.ahead })
        : sync.upstream
          ? t('shell.status.sync.gone', { upstream: sync.upstream })
          : t('shell.status.sync.unpublished'),
      t('shell.status.sync.lastFetch', { when: fetched }),
    ].join('\n');
  });
</script>

{#snippet quotas(focusable: boolean)}
  {#if several}<span class="v acct" use:tip={{ text: currentName, cut: true }}>{currentName}</span>{#if meters.length}<span class="d"
        >·</span
      >{/if}{/if}
  {#each meters as m, i (m.minutes ?? 'credits')}
    {#if i}<span class="vsep"></span>{/if}
    <QuotaMeter minutes={m.minutes} usage={m.usage} now={app.now} {focusable} />
  {/each}
  {#if day}
    {#if several}<span class="d">·</span>{/if}
    <span class="day" class:over={day.over} use:tip={several ? undefined : day.tip}
      >{#if !several}<span>{day.harness}</span>{/if}<span class="v"
        >{fUsd(day.cost)}{#if day.budget}<span class="d">{` / ${fUsd(day.budget)}`}</span>{/if}</span
      >{#if day.projection}<span class="p {day.projection.level}"
          ><span class="sr">{t('accounts.quota.projectedSr')}</span>{t('accounts.quota.projectedCost', {
            amount: day.projection.text,
          })}</span
        >{/if}</span
    >
  {/if}
{/snippet}

<footer class="bar mono">
  <!-- What the bar tells, which gives way when the window is narrow; the buttons on the right always stay whole. -->
  <div class="main">
    <span class="it"
      ><span class="dot" style="width:7px;height:7px;background:var(--ok)"></span>{t('shell.status.active', { count: running })}</span
    >
    <button
      class="it link"
      style:color={waiting ? 'var(--wait)' : 'var(--muted)'}
      onclick={() => app.nextWaiting()}
      use:tip={t('shell.status.nextWaiting', { key: keyLabel('Ctrl+J') })}
    >
      {#if waiting}<span class="pulse" style="width:7px;height:7px"></span>{:else}<span
          class="dot"
          style="width:7px;height:7px;background:var(--dim)"
        ></span>{/if}
      {t('shell.status.waiting', { n: waiting })}
    </button>
    <span class="it"><span style="color:var(--ok)">✓</span>{t('shell.status.done', { count: done })}</span>
    {#if procs.instances}
      <span class="vsep"></span>
      <span class="it procs" use:tip={procsTitle}
        ><Rich k="shell.status.procs" count={procs.instances}
          >{#snippet memory()}<span class="v">{fBytes(procs.memory)}</span>{/snippet}{#snippet cpu()}<span class="v">{fPct(procs.cpu)}</span
            >{/snippet}</Rich
        ></span
      >
    {/if}
    {#if several || meters.length || day}<span class="vsep"></span>{/if}
    {#if several}
      <!-- The panel's button: its bars are only seen here (their values are in the panel, which the keyboard opens). -->
      <button
        class="it link group"
        bind:this={quotaButton}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        aria-controls="accounts-panel"
        aria-label={t('accounts.panel.open', { name: currentName })}
        aria-describedby="quota-description"
        use:tip={panelOpen ? null : { text: quotaLines.join('\n'), aria: false }}
        onclick={() => (panelOpen = !panelOpen)}
      >
        {@render quotas(false)}
      </button>
      <span id="quota-description" hidden>{quotaLines.join('. ')}</span>
    {:else if meters.length || day}
      <span class="it group">{@render quotas(true)}</span>
    {/if}
    <span class="vsep"></span>
    <span class="it" use:tip={today.estimated ? estimateHint(today) : undefined}
      >{t('shell.status.today')}
      <span class="v strong">{fSpentUsd(today)}</span></span
    >
    {#if repo}
      <span class="vsep"></span>
      <button
        class="it link sync branch"
        bind:this={branchButton}
        disabled={!!busy}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onclick={() => (pickerOpen = !pickerOpen)}
        use:tip={branchTitle}
      >
        <span class="v name">⎇ {repo.detached ? t('branches.picker.detached') : repo.git.branch}</span>
        {#if busy}
          <span>{runningLabel(busy)}</span>
        {:else if sync?.tracked}
          <span style:color={sync.ahead ? 'var(--text)' : 'var(--dim)'}>↑{sync.ahead}</span>
          <span style:color={sync.behind ? 'var(--wait)' : 'var(--dim)'}>↓{sync.behind}</span>
        {:else if sync}
          <span class="d">{sync.upstream ? t('shell.status.sync.goneShort') : t('shell.status.sync.unpublishedShort')}</span>
        {/if}
      </button>
    {/if}
  </div>
  {#if restartIn !== null}
    <span class="it v">{t('shell.status.restartIn', { seconds: restartIn })}</span>
    <button class="small" onclick={postpone}>{t('common.later')}</button>
  {:else if app.update?.ready}
    <button class="upd" onclick={() => (app.modal = { kind: 'update' })}
      >{t('shell.status.updateReady', { version: app.update.version })}</button
    >
  {:else if app.update}
    <span class="it">{t('shell.status.updating', { version: app.update.version })}</span>
  {/if}
  <button class="small" onclick={toggleSound} use:tip={t('shell.status.sound')}
    >♪ {app.settings.sound ? t('shell.status.soundOn') : t('shell.status.soundOff')}</button
  >
  <button
    class="small"
    onclick={() => {
      app.modal = { kind: 'settings' };
    }}
    use:tip={t('shell.status.settings', { key: keyLabel('Ctrl+,') })}>⚙</button
  >
</footer>

{#if panelOpen}
  <AccountsPanel id="accounts-panel" anchor={quotaButton} onclose={() => (panelOpen = false)} />
{/if}

{#if pickerOpen && repo}
  {#key repo.projectId}
    <BranchPicker projectId={repo.projectId} anchor={branchButton} onclose={() => (pickerOpen = false)} />
  {/key}
{/if}

<style>
  .bar {
    height: 30px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 8px 0 16px;
    background: var(--panel);
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--muted);
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    container: status / inline-size;
  }
  /* Past its width, what it tells is cut at its edge rather than pushing the buttons out of the window: the activity, the
     processes, the quotas, the day's cost and the branch. Its height is the bar's, so a focus ring is not cut. */
  .main {
    flex: 1;
    min-width: 0;
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 14px;
    overflow: hidden;
  }
  .main > * {
    flex: none;
  }
  /* The processes and the branch give way first, cut short (the tooltip of the processes says them whole, the picker the
     branch opens names it). */
  .main > .procs {
    display: block;
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .main > .branch {
    flex: 0 1 auto;
    min-width: 6em;
  }
  .branch .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* A narrow window (the interface is laid out for 1000 pixels): tighter, and the quotas without their countdown, which
     their tooltips give. */
  @container status (max-width: 1199px) {
    .main {
      gap: 10px;
    }
    .main :global(.q .d) {
      display: none;
    }
  }
  .it {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .day {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  /* The day's budget reached: the autopilot waits for midnight. */
  .day.over .v {
    color: var(--wait);
  }
  /* The day's cost at midnight, against the budget: as the quotas' projection (`QuotaMeter`). */
  .p.ok {
    color: var(--ok);
  }
  .p.warn {
    color: var(--wait);
  }
  .p.over {
    color: var(--del);
  }
  /* Read by screen readers only. */
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .link {
    border: none;
    background: transparent;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
  .sync:hover:not(:disabled) .v {
    text-decoration: underline;
  }
  .sync:disabled {
    cursor: default;
  }
  .vsep {
    width: 1px;
    height: 14px;
    background: var(--line2);
  }
  .group {
    gap: 8px;
  }
  button.group {
    color: inherit;
    height: 22px;
    padding: 0 6px;
    margin: 0 -6px;
    border-radius: var(--r-sm);
  }
  /* Lighter than the bars' track, which would otherwise melt into it. */
  button.group:hover {
    background: var(--elev);
  }
  .v {
    color: var(--text);
  }
  /* A long name is cut short (it is whole in its title), not the bars after it. */
  .acct {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .strong {
    font-weight: 600;
  }
  .d {
    color: var(--dim);
  }
  .small {
    height: 22px;
    padding: 0 8px;
    border: none;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }
  .small:hover {
    background: var(--elev2);
    color: var(--text);
  }
  .upd {
    height: 22px;
    padding: 0 10px;
    border: none;
    border-radius: var(--r-sm);
    background: var(--accent);
    color: var(--accent-ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
