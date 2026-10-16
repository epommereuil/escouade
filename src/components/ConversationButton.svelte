<script lang="ts">
  import { conversation } from '../lib/conversation.svelte';
  import { conversationOf } from '../lib/conversations.svelte';
  import { fBytes } from '../lib/format';
  import { t } from '../lib/i18n';
  import { tip } from '../lib/tip';
  import type { Agent } from '../lib/types';

  // « Conversation » in the composer of the Escouade view (ESC-97): a click starts the voice conversation with the
  // agent, its panel says where it is (listening, transcribing, the agent at work, its answer read aloud) and stops it.
  let { agent }: { agent: Agent } = $props();

  // Only its id: the agent object is replaced at each update of the backend.
  const agentId = $derived(agent.id);
  const mine = $derived(conversation.agentId === agentId);
  const phase = $derived(mine ? conversation.phase : 'idle');
  const conv = $derived(conversationOf(agentId));
  const progress = $derived(mine ? conversation.progress : null);
  const pct = $derived(progress && progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0);
  const ears = $derived(phase === 'listening' || phase === 'hearing' || phase === 'question');

  // The agent's state and conversation, as they change: its questions are read, the end of its turn has its passage read.
  $effect(() => {
    if (conversation.agentId === agentId) conversation.observe(agent, conv.items);
  });

  // Another agent in this composer, or the composer gone: the conversation stops.
  $effect(() => {
    const id = agentId;
    return () => {
      if (conversation.agentId === id) conversation.stop();
    };
  });

  function toggle() {
    if (mine && conversation.active) conversation.stop();
    else void conversation.start(agentId);
  }
</script>

<div class="conv-wrap">
  {#if phase !== 'idle'}
    <div class="panel" role="status" aria-live="polite" data-conversation-phase={phase}>
      {#if phase === 'offer' && conversation.offer}
        <span class="small">
          {conversation.offer.kind === 'model'
            ? t('voice.conversation.offerModel', { model: conversation.offer.id, size: fBytes(conversation.offer.size) })
            : t('voice.conversation.offerVoice', { voice: conversation.offer.id, size: fBytes(conversation.offer.size) })}
        </span>
        <div class="actions">
          <button class="btn ghost" onclick={() => conversation.stop()}>{t('voice.conversation.cancel')}</button>
          <button class="btn primary" onclick={() => conversation.download()}>{t('voice.conversation.download')}</button>
        </div>
      {:else if phase === 'downloading' && progress}
        <span class="muted small"
          >{t('voice.conversation.downloading', { name: progress.id, done: fBytes(progress.done), total: fBytes(progress.total) })}</span
        >
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}>
          <div class="fill dl" style:width="{pct}%"></div>
        </div>
        <div class="actions">
          <button class="btn ghost" onclick={() => conversation.stop()}>{t('voice.conversation.cancel')}</button>
        </div>
      {:else}
        <div class="row">
          <span class="dot" class:ears class:speaking={phase === 'speaking'} aria-hidden="true"></span>
          <span class="strong state"
            >{t(`voice.conversation.phase.${phase}` as 'voice.conversation.phase.working', { name: agent.name })}</span
          >
        </div>
        {#if ears}
          <div
            class="meter"
            role="meter"
            aria-label={t('voice.conversation.level')}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(conversation.level * 100)}
          >
            <div class="fill" style:width="{Math.round(conversation.level * 100)}%"></div>
          </div>
        {/if}
        {#if conversation.heard && phase !== 'listening' && phase !== 'hearing'}
          <p class="small quote"><span class="muted">{t('voice.conversation.youSaid')} :</span> {conversation.heard}</p>
        {/if}
        {#if conversation.said && (phase === 'speaking' || phase === 'question' || phase === 'paused')}
          <p class="small quote said" data-conversation-said>
            <span class="muted">{t('voice.conversation.read')} :</span>
            {conversation.said}
          </p>
        {/if}
        <span class="muted small">{t('voice.conversation.hint')}</span>
        <div class="actions">
          {#if phase === 'paused'}
            <button class="btn ghost" onclick={() => conversation.resume()}>{t('voice.conversation.resume')}</button>
          {/if}
          <button class="btn primary stop" use:tip={t('voice.conversation.stopTitle')} onclick={() => conversation.stop()}
            >■ {t('voice.conversation.stop')}</button
          >
        </div>
      {/if}
    </div>
  {/if}
  <button
    class="icon-btn conv"
    class:on={mine && conversation.active}
    aria-pressed={mine && conversation.active}
    aria-label={t('voice.conversation.button')}
    use:tip={t('voice.conversation.buttonTitle')}
    style:--level={ears ? conversation.level : 0}
    onclick={toggle}
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
      aria-hidden="true"><path d="M3 10v4" /><path d="M7 6v12" /><path d="M11 3v18" /><path d="M15 7v10" /><path d="M19 10v4" /></svg
    >
  </button>
</div>

<style>
  .conv-wrap {
    position: relative;
    flex: none;
  }
  .conv.on {
    color: var(--accent);
    box-shadow: 0 0 0 calc(2px + var(--level) * 6px) color-mix(in oklch, var(--accent) 30%, transparent);
    transition: box-shadow 0.06s linear;
  }
  .panel {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: 40;
    width: 340px;
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
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
  }
  .dot.ears {
    background: var(--del);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .dot.speaking {
    background: var(--accent);
    animation: pulse 0.8s ease-in-out infinite;
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
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12px;
    line-height: 1.45;
  }
  .quote {
    margin: 0;
    max-height: 7.5em;
    overflow: auto;
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
    .dot.ears,
    .dot.speaking {
      animation: none;
    }
    .conv.on,
    .fill {
      transition: none;
    }
  }
</style>
