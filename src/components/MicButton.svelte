<script lang="ts">
  import { DEFAULT_SHORTCUT, duration, shortcutLabel } from '../lib/dictation';
  import { dictation, type DictationTarget } from '../lib/dictation.svelte';
  import { fBytes } from '../lib/format';
  import { t } from '../lib/i18n';
  import { app } from '../lib/state.svelte';
  import { tip } from '../lib/tip';

  // The microphone beside a field: a click starts the dictation and another ends it, a press held dictates until it is
  // let go. While it listens, its panel shows the level and the time; the first time, it offers the model's download.
  let { target, below = false }: { target: DictationTarget; below?: boolean } = $props();

  $effect(() => dictation.register(target));

  const mine = $derived(dictation.targetId === target.id);
  const phase = $derived(mine ? dictation.phase : 'idle');
  const listening = $derived(phase === 'listening');
  const key = $derived(shortcutLabel(app.settings.voice?.shortcut || DEFAULT_SHORTCUT));
  const progress = $derived(dictation.progress);
  const pct = $derived(progress && progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0);

  function down(e: PointerEvent) {
    // Only the main button (a right click is a menu).
    if (e.button > 0) return;
    // The field keeps the focus, and its cursor: the text goes there.
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dictation.press(target);
  }

  function key_(e: KeyboardEvent, isDown: boolean) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (isDown && !e.repeat) dictation.press(target);
    if (!isDown) dictation.release();
  }
</script>

<div class="mic-wrap">
  {#if phase !== 'idle'}
    <div class="panel" class:below role="status" aria-live="polite" data-voice-phase={phase}>
      {#if phase === 'starting'}
        <span class="muted">{t('voice.panel.starting')}</span>
      {:else if phase === 'listening'}
        <div class="row">
          <span class="dot" aria-hidden="true"></span>
          <span class="strong">{t('voice.panel.listening')}</span>
          <span class="time mono">{duration(dictation.ms)}</span>
        </div>
        <div
          class="meter"
          role="meter"
          aria-label={t('voice.panel.level')}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(dictation.level * 100)}
        >
          <div class="fill" style:width="{Math.round(dictation.level * 100)}%"></div>
        </div>
        <span class="muted small">{t('voice.panel.hint', { key })}</span>
      {:else if phase === 'transcribing'}
        <span class="muted">{t('voice.panel.transcribing')}</span>
      {:else if phase === 'offer' && dictation.offer}
        <span class="strong">{t('voice.panel.offerTitle')}</span>
        <span class="muted small">{t('voice.panel.offerBody', { model: dictation.offer.model, size: fBytes(dictation.offer.size) })}</span>
        <div class="actions">
          <button class="btn ghost" onclick={() => dictation.cancel()}>{t('voice.panel.cancel')}</button>
          <button class="btn primary" onclick={() => dictation.download()}>{t('voice.panel.download')}</button>
        </div>
      {:else if phase === 'downloading' && progress}
        <span class="muted small"
          >{t('voice.panel.downloading', { model: progress.model, done: fBytes(progress.done), total: fBytes(progress.total) })}</span
        >
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}>
          <div class="fill dl" style:width="{pct}%"></div>
        </div>
        <div class="actions">
          <button class="btn ghost" onclick={() => dictation.cancel()}>{t('voice.panel.cancel')}</button>
        </div>
      {/if}
    </div>
  {/if}
  <button
    class="icon-btn mic"
    class:on={listening}
    class:busy={phase === 'transcribing' || phase === 'starting'}
    aria-pressed={listening}
    aria-label={listening ? t('voice.button.stop') : t('voice.button.label')}
    aria-keyshortcuts={(app.settings.voice?.shortcut || DEFAULT_SHORTCUT).replace('Mod', 'Control')}
    use:tip={t('voice.button.title', { key })}
    style:--level={listening ? dictation.level : 0}
    onpointerdown={down}
    onpointerup={() => dictation.release()}
    onpointercancel={() => dictation.release()}
    onkeydown={(e) => key_(e, true)}
    onkeyup={(e) => key_(e, false)}
  >
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /></svg
    >
  </button>
</div>

<style>
  .mic-wrap {
    position: relative;
    flex: none;
  }
  .mic {
    position: relative;
  }
  .mic.on {
    color: var(--del);
    /* The level, as a halo that grows with the voice. */
    box-shadow: 0 0 0 calc(2px + var(--level) * 6px) color-mix(in oklch, var(--del) 30%, transparent);
    transition: box-shadow 0.06s linear;
  }
  .mic.busy {
    opacity: 0.6;
  }
  .panel {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: 40;
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: var(--r);
    border: 1px solid var(--line2);
    background: var(--elev);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    font-size: 12.5px;
    text-align: left;
  }
  .panel.below {
    bottom: auto;
    top: calc(100% + 8px);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--del);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
  .strong {
    font-weight: 600;
    color: var(--fg);
  }
  .time {
    margin-left: auto;
    color: var(--muted);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12px;
    line-height: 1.45;
  }
  .meter {
    height: 6px;
    border-radius: 3px;
    background: var(--panel);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--del);
    transition: width 0.06s linear;
  }
  .fill.dl {
    background: var(--accent);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
    .mic.on,
    .fill {
      transition: none;
    }
  }
</style>
