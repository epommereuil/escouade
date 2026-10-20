<script lang="ts">
  import { onMount } from 'svelte';
  import {
    accountDefaults,
    accountName,
    accountsTabEngines,
    addAccount,
    agentsOn,
    backToAccounts,
    engineOfAccount,
    engineOrder,
    isPrincipal,
    PRINCIPAL,
    projectsWithoutAccount,
  } from '../../lib/accounts';
  import { capsOf, defaultModelOf, effortsOf, engineName, modelsOf, modesOf } from '../../lib/engines';
  import { EFFORTS, MODES } from '../../lib/models';
  import { fList, tildify } from '../../lib/format';
  import { t } from '../../lib/i18n';
  import { api } from '../../lib/ipc';
  import { app } from '../../lib/state.svelte';
  import type { Account, AccountStatus, ClosedProject, EngineId } from '../../lib/types';
  import Group from './Group.svelte';
  import Row from './Row.svelte';
  import Switch from './Switch.svelte';
  import { tip } from '../../lib/tip';

  // The accounts, a group per harness in « Ordre des harness ». Each change goes to the backend at once (`account_*`,
  // `engine_order_set`), not through the modal's draft: an account is made, signed in and removed on the disk, which
  // « Annuler » could not take back.

  const accounts = $derived(app.settings.accounts ?? []);
  /** Every harness installed, an empty one with « Aucun compte » (ESC-128), and those with accounts. */
  const groups = $derived(accountsTabEngines().map((engine) => ({ engine, list: accounts.filter((a) => engineOfAccount(a) === engine) })));
  /** How many accounts of each harness are active: its last one stays on. */
  const activeOf = (engine: EngineId) => accounts.filter((a) => a.active && engineOfAccount(a) === engine).length;
  /** « Ordre des harness », once there are two harnesses to put in order. */
  const order = $derived(engineOrder());
  /** Principal may be reserved like any account: the projects none serves then, told under the list. */
  const orphans = $derived(projectsWithoutAccount());
  const orphansText = $derived(
    orphans.length
      ? t('accounts.tab.noAccount', {
          count: orphans.length,
          names: fList(orphans.map((p) => t('accounts.tab.quoted', { name: p.name }))),
        })
      : '',
  );
  /** The projects closed with their history kept, read when the tab opens: an account stays reserved to them until it is erased. */
  let closed = $state<ClosedProject[]>([]);
  onMount(async () => {
    closed = await api.closedProjects().catch(() => []);
  });
  /** The closed projects the account is reserved to (a file the app cannot read has no name to show). */
  const closedReserved = (a: Account) => closed.filter((c) => !c.unreadable && (a.projects ?? []).includes(c.id));
  /** Each account's sign-in, as last read. */
  let statuses = $state<Record<string, AccountStatus>>({});
  /** Why an account was not removed, by account. */
  let refused = $state<Record<string, string>>({});
  /** The accounts whose sign-in was asked for (not reactive: asked once each). */
  const asked = new Set<string>();

  // Each account's sign-in, read when the tab opens, and for an account added since.
  $effect(() => {
    for (const a of accounts) {
      if (asked.has(a.id)) continue;
      asked.add(a.id);
      void load(a.id);
    }
  });

  async function load(id: string) {
    try {
      statuses[id] = await api.accountStatus(id);
    } catch {
      // Removed meanwhile: nothing to show.
    }
  }

  /** The account as plain data, to send. */
  const plain = (a: Account): Account => ({ ...$state.snapshot(a) });

  /** What its quota's last reading says of its sign-in when it is there but out of date. */
  function expired(id: string): string | null {
    const u = app.usage.accounts.find((x) => x.id === id);
    return u?.connected && u.reason ? u.reason : null;
  }

  function stateOf(a: Account, s: AccountStatus | undefined): string {
    if (!a.active) return t('accounts.tab.state.inactive');
    if (!s) return t('accounts.tab.state.checking');
    if (s.connected) return s.email ? t('accounts.tab.state.connected', { email: s.email }) : t('accounts.tab.state.connectedNoEmail');
    return a.id === PRINCIPAL ? t('accounts.tab.state.principalNotConnected') : t('accounts.tab.state.notConnected');
  }

  /** The harness moved by `by` places in « Ordre des harness ». */
  /** « Projection des quotas »: shown at once, saved with the rest of the app's settings as they are, like the accounts. */
  function setProjection(on: boolean) {
    app.settings.quotaProjection = on;
    app.run(api.saveSettings($state.snapshot(app.settings)));
  }

  async function moveEngine(i: number, by: number) {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    const saved = await app.run(api.engineOrderSet(next));
    if (saved) app.settings.engineOrder = saved;
  }

  /** Saved as the backend has it: the accounts it then gives are the window's. */
  async function save(next: Account): Promise<boolean> {
    const list = await app.run(api.accountUpdate(next));
    if (list) app.settings.accounts = list;
    return !!list;
  }

  /** The project ticked or unticked in « Réservé aux projets ». */
  function reserve(a: Account, project: string, on: boolean) {
    const now = a.projects ?? [];
    const projects = on ? [...now, project] : now.filter((p) => p !== project);
    void save({ ...plain(a), projects });
  }

  /** A field left: what it says saved when it changed, else (or refused) as it was. */
  async function commit(a: Account, input: HTMLInputElement, field: 'name' | 'claudePath') {
    const shown = field === 'name' ? accountName(a) : a.claudePath;
    if (input.value === shown) return;
    if (!(await save({ ...plain(a), [field]: input.value }))) input.value = shown;
  }

  /** The account `a` swapped with `other`, the one before or after it in its harness's group. */
  async function move(a: Account, other: Account) {
    const ids = accounts.map((x) => x.id);
    const [i, j] = [ids.indexOf(a.id), ids.indexOf(other.id)];
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const list = await app.run(api.accountReorder(ids));
    if (list) app.settings.accounts = list;
  }

  /** Asks before removing it, unless agents still run on it; back to this tab either way. The machine's stays signed in. */
  function remove(a: Account) {
    const n = agentsOn(a.id);
    if (n) {
      refused[a.id] = t('accounts.tab.stillUsed', { count: n });
      return;
    }
    delete refused[a.id];
    const { id } = a;
    const path = tildify(a.configDir || statuses[a.id]?.dir || '');
    const machine = isPrincipal(a);
    const says = machine ? 'removeMachineConfirm' : 'removeConfirm';
    app.modal = {
      kind: 'confirm',
      title: t(`accounts.tab.${says}.title`, { name: accountName(a) }),
      body: t(`accounts.tab.${says}.body`, { path, harness: engineName(engineOfAccount(a)) }),
      confirm: t(`accounts.tab.${says}.confirm`),
      danger: true,
      onConfirm: async () => {
        const list = await app.run(api.accountRemove(id));
        if (list) app.settings.accounts = list;
        backToAccounts();
      },
      onCancel: backToAccounts,
    };
  }

  /** A harness without a quota (OpenCode): a budget of the day stands in for it. */
  const noQuota = (engine: EngineId) => capsOf(engine)?.quota === 'none';

  /** « Budget par jour ($) » left: empty (or 0) for none; refused, as it was. */
  async function commitBudget(a: Account, input: HTMLInputElement) {
    const typed = input.value.trim().replace(',', '.');
    const budget = typed === '' ? null : Number(typed);
    const shown = a.dailyBudget ? String(a.dailyBudget) : '';
    if ((budget || null) === (a.dailyBudget || null)) {
      input.value = shown;
      return;
    }
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      refused[a.id] = t('accounts.tab.budgetInvalid');
      input.value = shown;
      return;
    }
    delete refused[a.id];
    if (!(await save({ ...plain(a), dailyBudget: budget || null }))) input.value = shown;
  }

  /** What its new agents go with, as its harness has it (ESC-128): its models, the efforts of its model, its modes. */
  function defaultsOf(a: Account) {
    const engine = engineOfAccount(a);
    const who = { engine, account: a.id };
    const d = accountDefaults(a);
    const models = modelsOf(who);
    // Claude Code's Sonnet; another harness's own default, as it lists it for the account.
    const harnessModel = accountDefaults(undefined, engine).model || defaultModelOf(who);
    const named = models.find((m) => m.id === harnessModel)?.label ?? harnessModel;
    return {
      models,
      // A model it saved that its harness does not list (any more): kept in the menu, as it is.
      kept: a.defaultModel && !models.some((m) => m.id === a.defaultModel) ? a.defaultModel : '',
      harnessLabel: named ? t('accounts.tab.harnessDefaultNamed', { name: named }) : t('accounts.tab.harnessDefault'),
      efforts: effortsOf({ ...who, model: d.model }, EFFORTS),
      modes: modesOf(who, MODES),
    };
  }

  /** One of the defaults of its new agents chosen; empty: its harness's. */
  function setDefault(a: Account, field: 'defaultModel' | 'defaultEffort' | 'defaultMode', value: string) {
    void save({ ...plain(a), [field]: value });
  }

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
  };
</script>

{#each groups as g, gi (g.engine)}
  {@const harness = engineName(g.engine)}
  {@const list = g.list}
  <Group title={t('accounts.tab.group', { harness })} note={gi === 0 ? t('accounts.tab.order') : undefined} plain>
    {#if !list.length}
      <!-- A harness installed without an account (ESC-128): nothing starts on it until one is added. -->
      <div class="list empty" role="group" aria-label={t('accounts.tab.group', { harness })}>
        <div class="line">
          <span class="none">{t('accounts.tab.none')}</span>
          <div style="flex:1"></div>
          <button class="btn" onclick={() => addAccount(g.engine)}>{t('accounts.tab.addTo', { harness })}</button>
        </div>
        <p class="k hint">{t('accounts.tab.noneHint', { harness })}</p>
      </div>
    {:else}
      <ul class="list" aria-label={t('accounts.tab.group', { harness })}>
        {#each list as a, i (a.id)}
          {@const name = accountName(a)}
          {@const status = statuses[a.id]}
          {@const late = expired(a.id)}
          {@const last = a.active && activeOf(g.engine) === 1}
          {@const reserved = a.projects ?? []}
          {@const closedOnes = closedReserved(a)}
          {@const defaults = defaultsOf(a)}
          <li class="acct" aria-label={name}>
            <div class="line">
              <input
                class="field name"
                aria-label={t('accounts.tab.name')}
                spellcheck="false"
                value={name}
                onkeydown={blurOnEnter}
                onblur={(e) => commit(a, e.currentTarget, 'name')}
              />
              {#if isPrincipal(a)}<span class="machine">{t('accounts.tab.machine')}</span>{/if}
              <span class="state" class:on={a.active && status?.connected} class:off={!a.active}>
                <span class="dot" aria-hidden="true"></span>{stateOf(a, status)}
              </span>
              <div style="flex:1"></div>
              <span class="k" aria-hidden="true">{t('accounts.tab.active')}</span>
              <button
                class="switch"
                class:on={a.active}
                role="switch"
                aria-checked={a.active}
                aria-label={t('accounts.tab.active')}
                aria-describedby={last ? 'accounts-last-active' : undefined}
                use:tip={last ? t('accounts.tab.lastActive') : undefined}
                disabled={last}
                onclick={() => save({ ...plain(a), active: !a.active })}
              ></button>
              <button class="icon-btn" aria-label={t('accounts.tab.up', { name })} disabled={i === 0} onclick={() => move(a, list[i - 1])}
                >↑</button
              >
              <button
                class="icon-btn"
                aria-label={t('accounts.tab.down', { name })}
                disabled={i === list.length - 1}
                onclick={() => move(a, list[i + 1])}>↓</button
              >
            </div>
            <div class="line">
              <span class="k">{t('accounts.tab.folder')}</span>
              <span class="dir mono">{tildify(a.configDir || status?.dir || '')}</span>
            </div>
            <div class="line">
              <label class="k" for="account-exe-{a.id}">{t('accounts.tab.executable')}</label>
              <input
                id="account-exe-{a.id}"
                class="field mono exe"
                spellcheck="false"
                placeholder={t('accounts.tab.executableDefault')}
                value={a.claudePath}
                onkeydown={blurOnEnter}
                onblur={(e) => commit(a, e.currentTarget, 'claudePath')}
              />
              <div style="flex:1"></div>
              {#if status}
                <!-- Not signed in, or out of date: to sign in. Signed in: to sign in again (another claude.ai account, say). -->
                <button class="btn" onclick={() => (app.modal = { kind: 'account', accountId: a.id })}>
                  {status.connected && !late ? t('accounts.tab.signInAgain') : t('accounts.tab.signIn')}
                </button>
              {/if}
              <button class="btn ghost danger" onclick={() => remove(a)}>{t('accounts.tab.remove')}</button>
            </div>
            <!-- What its new agents go with, as its harness has it (ESC-128). -->
            <div class="line wrap" role="group" aria-label={t('accounts.tab.defaults')}>
              <span class="k">{t('accounts.tab.defaults')}</span>
              <label class="pick">
                <span class="k">{t('accounts.tab.defaultModel')}</span>
                <select class="field" value={a.defaultModel ?? ''} onchange={(e) => setDefault(a, 'defaultModel', e.currentTarget.value)}>
                  <option value="">{defaults.harnessLabel}</option>
                  {#each defaults.models as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
                  {#if defaults.kept}<option value={defaults.kept}>{defaults.kept}</option>{/if}
                </select>
              </label>
              {#if defaults.efforts.length}
                <label class="pick">
                  <span class="k">{t('accounts.tab.defaultEffort')}</span>
                  <select
                    class="field"
                    value={a.defaultEffort ?? ''}
                    onchange={(e) => setDefault(a, 'defaultEffort', e.currentTarget.value)}
                  >
                    <option value="">{t('accounts.tab.harnessDefault')}</option>
                    {#each defaults.efforts as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
                  </select>
                </label>
              {/if}
              {#if defaults.modes.length}
                <label class="pick">
                  <span class="k">{t('accounts.tab.defaultMode')}</span>
                  <select class="field" value={a.defaultMode ?? ''} onchange={(e) => setDefault(a, 'defaultMode', e.currentTarget.value)}>
                    <option value="">{t('accounts.tab.harnessDefault')}</option>
                    {#each defaults.modes as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
                  </select>
                </label>
              {/if}
            </div>
            {#if noQuota(g.engine)}
              <div class="line">
                <label class="k" for="account-budget-{a.id}">{t('accounts.tab.budget')}</label>
                <input
                  id="account-budget-{a.id}"
                  class="field mono budget"
                  type="text"
                  inputmode="decimal"
                  spellcheck="false"
                  placeholder={t('accounts.tab.budgetNone')}
                  aria-describedby="account-budget-hint-{a.id}"
                  value={a.dailyBudget ? String(a.dailyBudget) : ''}
                  onkeydown={blurOnEnter}
                  onblur={(e) => commitBudget(a, e.currentTarget)}
                />
                <span class="k hint" id="account-budget-hint-{a.id}">{t('accounts.tab.budgetHint')}</span>
              </div>
            {/if}
            {#if app.projects.length || closedOnes.length}
              <div class="line wrap" role="group" aria-label={t('accounts.tab.reserved')}>
                <span class="k" use:tip={t('accounts.tab.reservedHint')}>{t('accounts.tab.reserved')}</span>
                {#each app.projects as p (p.id)}
                  <label class="chip">
                    <input type="checkbox" checked={reserved.includes(p.id)} onchange={(e) => reserve(a, p.id, e.currentTarget.checked)} />
                    {p.name}
                  </label>
                {/each}
                <!-- Closed, but their history is kept and so is the reservation: it goes only when they are unticked or erased. -->
                {#each closedOnes as c (c.id)}
                  <label class="chip">
                    <input type="checkbox" checked={reserved.includes(c.id)} onchange={(e) => reserve(a, c.id, e.currentTarget.checked)} />
                    {t('accounts.tab.closedProject', { name: c.name })}
                  </label>
                {/each}
                {#if !reserved.length}<span class="k">· {t('accounts.tab.reservedAll')}</span>{/if}
              </div>
            {/if}
            {#if late}<p class="late">{late}</p>{/if}
            {#if refused[a.id]}<p class="refused" role="alert">{refused[a.id]}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Group>
{/each}
<!-- Always there, empty while every project has an account: a screen reader hears it fill. -->
<p class="orphans" class:on={orphans.length > 0} role="status">{orphansText}</p>
<span id="accounts-last-active" hidden>{t('accounts.tab.lastActive')}</span>
<div>
  <button class="btn" onclick={() => (app.modal = { kind: 'account' })}>{t('accounts.tab.add')}</button>
</div>
{#if order.length > 1}
  <Group title={t('accounts.engineOrder.label')} note={t('accounts.engineOrder.desc')} plain>
    <ol class="list" aria-label={t('accounts.engineOrder.label')}>
      {#each order as e, i (e)}
        {@const name = engineName(e)}
        <li class="acct line">
          <span class="rank" aria-hidden="true">{i + 1}</span>
          <span class="engine">{name}</span>
          <div style="flex:1"></div>
          <button class="icon-btn" aria-label={t('accounts.engineOrder.up', { name })} disabled={i === 0} onclick={() => moveEngine(i, -1)}
            >↑</button
          >
          <button
            class="icon-btn"
            aria-label={t('accounts.engineOrder.down', { name })}
            disabled={i === order.length - 1}
            onclick={() => moveEngine(i, 1)}>↓</button
          >
        </li>
      {/each}
    </ol>
  </Group>
{/if}
<Group title={t('accounts.quotas.title')}>
  <Row label={t('accounts.quotas.projection')} desc={t('accounts.quotas.projectionDesc')}>
    <Switch label={t('accounts.quotas.projection')} bind:on={() => app.settings.quotaProjection !== false, setProjection} />
  </Row>
</Group>

<style>
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    border-radius: var(--r);
    border: 1px solid var(--line);
    background: var(--bg);
  }
  .acct {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
  }
  .acct:not(:first-child) {
    border-top: 1px solid var(--line);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .wrap {
    flex-wrap: wrap;
    gap: 6px 12px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
  }
  .name {
    width: 200px;
    height: 30px;
    padding: 0 10px;
    background: var(--panel);
    font-size: 13px;
    font-weight: 600;
  }
  .state {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .dot {
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: 50%;
    background: var(--wait);
  }
  .state.on .dot {
    background: var(--add);
  }
  .state.off .dot {
    background: var(--dim);
  }
  .k {
    flex: none;
    font-size: 12px;
    color: var(--dim);
  }
  .dir {
    min-width: 0;
    font-size: 11.5px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .exe {
    width: 300px;
    max-width: 45%;
    height: 28px;
    padding: 0 10px;
    background: var(--panel);
    font-size: 12px;
  }
  .empty {
    padding: 12px 16px;
    gap: 6px;
  }
  .none {
    font-size: 13px;
    color: var(--muted);
  }
  .machine {
    flex: none;
    font-size: 11px;
    color: var(--dim);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .pick select {
    height: 28px;
    padding: 0 8px;
    background: var(--panel);
    font-size: 12px;
    max-width: 220px;
  }
  .budget {
    width: 90px;
    flex: none;
    height: 28px;
    padding: 0 10px;
    background: var(--panel);
    font-size: 12px;
  }
  .hint {
    min-width: 0;
    white-space: normal;
    line-height: 1.4;
  }
  .btn {
    height: 28px;
    font-size: 12px;
  }
  .icon-btn:disabled {
    opacity: 0.35;
    background: transparent;
    cursor: default;
  }
  /* As `Switch` has it: the last account active stays on. */
  .switch:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .late,
  .refused {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
  }
  .late,
  .orphans {
    color: var(--wait);
  }
  .orphans {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .orphans.on {
    margin-top: 8px;
  }
  .refused {
    color: var(--del);
  }
  .rank {
    width: 16px;
    font-size: 12px;
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
  .engine {
    font-size: 13px;
    font-weight: 600;
  }
  li.line {
    flex-direction: row;
    padding: 8px 16px;
  }
</style>
