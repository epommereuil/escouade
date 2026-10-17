<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { t } from '../../lib/i18n';
  import { api } from '../../lib/ipc';
  import { EFFORTS, MODES, modelOptions } from '../../lib/models';
  import { IS_MAC } from '../../lib/platform';
  import { settingsForm } from '../../lib/settings.svelte';
  import { app } from '../../lib/state.svelte';
  import { privacyUrl } from '../../lib/telemetry';
  import { CREDITS_URL } from '../../lib/conversation';
  import type { ClaudeLocated } from '../../lib/types';
  import { checkForUpdate } from '../../lib/updater';
  import Chips from './Chips.svelte';
  import Group from './Group.svelte';
  import McpSection from './McpSection.svelte';
  import Row from './Row.svelte';
  import Switch from './Switch.svelte';

  // The tabs of the app's own settings.
  let { tab }: { tab: 'claude' | 'notifications' | 'terminals' | 'network' | 'about' } = $props();

  const s = $derived(settingsForm.settings);
  const bigTextOptions = $derived([
    { value: 'path' as const, label: t('settings.claude.attachBigTextPath') },
    { value: 'refuse' as const, label: t('settings.claude.attachBigTextRefuse') },
  ]);
  let checking = $state(false);

  // Where the `claude` of the path is, asked a moment after the path or the distribution changes (a look into WSL
  // may take seconds): an answer to an earlier path is dropped.
  let located = $state<ClaudeLocated | null>(null);
  $effect(() => {
    if (tab !== 'claude') return;
    const [path, distro] = [s.claudePath, s.wslDistro];
    let stale = false;
    const timer = setTimeout(async () => {
      const found = await api.locateClaude(path, distro).catch(() => null);
      if (!stale) located = found ?? null;
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  });

  /** The line under the path: where its `claude` was found, or how to name one. */
  function locatedText(l: ClaudeLocated | null): string {
    if (!l) return '';
    if (l.path === null) return l.canWsl ? t('settings.claude.notLocated') : t('settings.claude.notLocatedHere');
    return l.wsl ? t('settings.claude.locatedWsl', { distro: l.wsl, path: l.path }) : t('settings.claude.located', { path: l.path });
  }

  async function check() {
    checking = true;
    const found = await checkForUpdate(true);
    checking = false;
    // A check that failed has told why: it is not "nothing new".
    if (found === false) app.toast(t('settings.about.noUpdate'), 'info');
  }
</script>

{#snippet text(label: string, hint: string, value: string, set: (v: string) => void, placeholder = '')}
  <Row {label} {hint}>
    <input
      class="field mono input"
      aria-label={label}
      spellcheck="false"
      {placeholder}
      {value}
      oninput={(e) => set(e.currentTarget.value)}
    />
  </Row>
{/snippet}

{#if tab === 'claude'}
  <Group title={t('settings.claude.executable')} note={located?.nat ? t('settings.claude.nat') : undefined}>
    <Row label={t('settings.claude.path')} hint={t('settings.claude.pathHint')} desc={locatedText(located)} descId="claude-located">
      <input
        class="field mono input"
        aria-label={t('settings.claude.path')}
        aria-describedby={located ? 'claude-located' : undefined}
        spellcheck="false"
        placeholder={app.claudePathFound ? t('settings.claude.pathFound') : t('settings.claude.pathMissing')}
        value={s.claudePath}
        oninput={(e) => (s.claudePath = e.currentTarget.value)}
      />
    </Row>
  </Group>
  <Group title={t('settings.claude.newAgents')}>
    <Row label={t('settings.claude.defaultModel')}>
      <Chips label={t('settings.claude.defaultModel')} options={modelOptions(app.models)} bind:value={s.defaultModel} />
    </Row>
    <Row label={t('settings.claude.defaultEffort')}>
      <Chips label={t('settings.claude.defaultEffort')} options={EFFORTS} bind:value={s.defaultEffort} />
    </Row>
    <Row label={t('settings.claude.defaultMode')}>
      <Chips label={t('settings.claude.defaultMode')} options={MODES} bind:value={s.defaultMode} />
    </Row>
  </Group>
  <Group title={t('settings.claude.processes')}>
    <Row label={t('settings.claude.autoResume')} desc={t('settings.claude.autoResumeDesc')}>
      <Switch label={t('settings.claude.autoResume')} bind:on={s.autoResume} />
    </Row>
    <!-- With a single account there is nothing to go on on. -->
    {#if (app.settings.accounts?.length ?? 0) > 1}
      <Row label={t('accounts.switchOnLimit.label')} desc={t('accounts.switchOnLimit.desc')}>
        <Switch label={t('accounts.switchOnLimit.label')} bind:on={s.switchOnLimit} />
      </Row>
    {/if}
    <Row label={t('settings.claude.terminalView')} desc={t('settings.claude.terminalViewDesc')}>
      <Switch label={t('settings.claude.terminalView')} bind:on={s.terminalView} />
    </Row>
    <Row label={t('settings.claude.todoTools')} desc={t('settings.claude.todoToolsDesc')}>
      <Switch label={t('settings.claude.todoTools')} bind:on={s.todoTools} />
    </Row>
    <Row label={t('settings.claude.idleStop')} hint={t('settings.claude.idleStopHint')}>
      <input
        class="field mono input short"
        type="number"
        min="0"
        aria-label={t('settings.claude.idleStopLabel')}
        bind:value={s.idleStopMinutes}
      />
    </Row>
  </Group>
  <Group title={t('settings.claude.attachments')} note={t('settings.claude.attachmentsNote')}>
    <Row label={t('settings.claude.attachMax')} hint={t('settings.claude.attachMaxHint')}>
      <input
        class="field mono input short"
        type="number"
        min="0"
        aria-label={t('settings.claude.attachMaxLabel')}
        bind:value={s.attachMaxMb}
      />
    </Row>
    <Row label={t('settings.claude.attachWarn')} hint={t('settings.claude.attachWarnHint')}>
      <input
        class="field mono input short"
        type="number"
        min="0"
        aria-label={t('settings.claude.attachWarnLabel')}
        bind:value={s.attachWarnMb}
      />
    </Row>
    <Row label={t('settings.claude.attachOrigin')} desc={t('settings.claude.attachOriginDesc')}>
      <Switch label={t('settings.claude.attachOrigin')} bind:on={s.attachOrigin} />
    </Row>
    <Row label={t('settings.claude.attachBigText')} desc={t('settings.claude.attachBigTextDesc')}>
      <Chips label={t('settings.claude.attachBigText')} options={bigTextOptions} bind:value={s.attachBigText} />
    </Row>
    <Row label={t('settings.claude.attachKeep')} hint={t('settings.claude.attachKeepHint')}>
      <input
        class="field mono input short"
        type="number"
        min="0"
        aria-label={t('settings.claude.attachKeepLabel')}
        bind:value={s.attachKeepDays}
      />
    </Row>
  </Group>
  <!-- Beside « Claude et les agents peuvent piloter Escouade », before its activity log, which can be long. -->
  <Group title={t('settings.claude.remoteTitle')}>
    <Row label={t('settings.claude.remoteAll')} desc={t('settings.claude.remoteAllDesc')}>
      <Switch label={t('settings.claude.remoteAll')} bind:on={s.remoteControlAll} />
    </Row>
  </Group>
  <McpSection />
{:else if tab === 'notifications'}
  <Group
    title={t('settings.notifications.notifyFor')}
    note={IS_MAC ? t('settings.notifications.noteMac') : t('settings.notifications.noteOther')}
  >
    <Row label={t('settings.notifications.questions')}>
      <Switch label={t('settings.notifications.questions')} bind:on={s.notifyFor.questions} />
    </Row>
    <Row label={t('settings.notifications.done')}>
      <Switch label={t('settings.notifications.done')} bind:on={s.notifyFor.done} />
    </Row>
    <Row label={t('settings.notifications.errors')}>
      <Switch label={t('settings.notifications.errors')} bind:on={s.notifyFor.errors} />
    </Row>
    <Row label={t('settings.notifications.tickets')}>
      <Switch label={t('settings.notifications.tickets')} bind:on={s.notifyFor.tickets} />
    </Row>
  </Group>
  <Group title={t('settings.notifications.channels')}>
    <Row label={t('settings.notifications.system', { os: IS_MAC ? 'macOS' : 'Windows' })}>
      <Switch label={t('settings.notifications.systemLabel')} bind:on={s.osNotifications} />
    </Row>
  </Group>
  <Group title={t('settings.notifications.sound')}>
    <Row label={t('settings.notifications.soundOn')} desc={t('settings.notifications.soundOnDesc')}>
      <Switch label={t('settings.notifications.soundOn')} bind:on={s.sound} />
    </Row>
    <Row label={t('settings.notifications.soundTest')}>
      <button class="btn" onclick={() => api.playChime()}>{t('settings.notifications.soundTestButton')}</button>
    </Row>
  </Group>
{:else if tab === 'terminals'}
  <Group
    title={t('settings.terminals.paths')}
    note={t('settings.terminals.detected', { list: app.shells.map((x) => x.label).join(', ') || t('settings.terminals.none') })}
  >
    {#if IS_MAC}
      {@render text('bash', t('settings.terminals.auto'), s.bashPath, (v) => (s.bashPath = v))}
    {:else}
      {@render text('PowerShell 7', t('settings.terminals.auto'), s.pwshPath, (v) => (s.pwshPath = v))}
      {@render text('Git Bash', t('settings.terminals.auto'), s.bashPath, (v) => (s.bashPath = v))}
      {@render text(t('settings.terminals.wsl'), t('settings.terminals.wslHint'), s.wslDistro, (v) => (s.wslDistro = v), 'Ubuntu')}
    {/if}
  </Group>
{:else if tab === 'network'}
  <Group title={t('settings.network.proxy')} note={t('settings.network.proxyNote')}>
    {@render text(
      t('settings.network.proxyUrl'),
      t('settings.network.proxyUrlHint'),
      s.proxyUrl,
      (v) => (s.proxyUrl = v),
      t('settings.network.proxyUrlNone'),
    )}
    {@render text(t('settings.network.exclusions'), t('settings.network.exclusionsHint'), s.noProxy, (v) => (s.noProxy = v))}
    <Row label={t('settings.network.proxyTerminals')}>
      <Switch label={t('settings.network.proxyTerminals')} bind:on={s.proxyTerminals} />
    </Row>
  </Group>
  <Group title={t('settings.network.certificates')} note={t('settings.network.certificatesNote')}>
    <Row label={t('settings.network.insecureTls')} desc={t('settings.network.insecureTlsDesc')}>
      <Switch label={t('settings.network.insecureTls')} bind:on={s.insecureTls} />
    </Row>
  </Group>
{:else}
  <Group title="Escouade">
    <Row label="Escouade {app.version}" desc={app.claudeFound ? t('settings.about.claudeFound') : t('settings.about.claudeMissing')}>
      <button class="btn" disabled={checking} onclick={check}>{checking ? t('settings.about.checking') : t('settings.about.check')}</button>
    </Row>
    <Row label={t('settings.about.autoUpdate')} desc={t('settings.about.autoUpdateDesc')}>
      <Switch label={t('settings.about.autoUpdate')} bind:on={s.autoUpdate} />
    </Row>
    <Row label={t('settings.about.telemetry')} desc={t('settings.about.telemetryDesc')}>
      <button class="btn ghost" onclick={() => openUrl(privacyUrl()).catch((e) => app.toast(String(e), 'error'))}
        >{t('settings.about.telemetryMore')}</button
      >
      <Switch label={t('settings.about.telemetry')} bind:on={() => s.telemetry === true, (on) => (s.telemetry = on)} />
    </Row>
    <Row label={t('settings.about.localData')} desc="~/.escouade/" />
    <Row label={t('settings.about.credits')} desc={t('settings.about.creditsDesc')}>
      <button class="btn ghost" onclick={() => openUrl(CREDITS_URL).catch((e) => app.toast(String(e), 'error'))}
        >{t('settings.about.creditsOpen')}</button
      >
    </Row>
  </Group>
{/if}

<style>
  .input {
    width: 340px;
    max-width: 50%;
    flex: none;
    height: 32px;
    padding: 0 10px;
    background: var(--panel);
    font-size: 12px;
  }
  .input.short {
    width: 110px;
  }
</style>
