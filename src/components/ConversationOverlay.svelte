<script lang="ts">
  import { onMount } from 'svelte';
  import { conversation, type ConvPhase } from '../lib/conversation.svelte';
  import { t } from '../lib/i18n';
  import { keyLabel } from '../lib/platform';
  import { app } from '../lib/state.svelte';

  // The voice conversation over the whole window (ESC-97, « A · Orbe » chosen on preview, design/voice-conversation):
  // an orb in the middle whose edge and halo follow the sound (the agent's voice as played while it speaks, the
  // microphone while it listens), an arc turning around it while Whisper transcribes and the agent works; subtitles at
  // the bottom, one or two lines, who speaks named soberly. Escape or « Arrêter » ends the conversation. The animation
  // runs only while this panel is there (requestAnimationFrame, stopped when it goes).
  const agent = $derived(conversation.agentId ? app.agents[conversation.agentId] : undefined);
  const project = $derived(agent ? app.projects.find((p) => p.id === agent.projectId) : undefined);
  const phase = $derived(conversation.phase);
  const name = $derived(agent?.name ?? '');
  const subtitle = $derived(conversation.subtitle);

  let canvas = $state<HTMLCanvasElement>();

  /** The tint of each state: amber while the agent speaks, a soft red while it listens, blue while it thinks. */
  const WARM = [232, 148, 92];
  const RED = [228, 112, 98];
  const COOL = [120, 170, 235];
  const DIM = [168, 160, 149];

  function tintOf(p: ConvPhase): number[] {
    if (p === 'speaking' || p === 'question') return WARM;
    if (p === 'listening' || p === 'hearing') return RED;
    if (p === 'paused' || p === 'starting') return DIM;
    return COOL;
  }

  /** What the orb follows now: the voice played while the agent speaks, the microphone while it listens. */
  function target(): number {
    const p = conversation.phase;
    if (p === 'speaking' || p === 'question') return Math.max(conversation.played, p === 'question' ? conversation.level * 0.6 : 0);
    if (p === 'listening' || p === 'hearing') return conversation.level;
    return 0;
  }

  const thinking = (p: ConvPhase) => p === 'transcribing' || p === 'working' || p === 'starting';

  onMount(() => {
    const ctx = canvas!.getContext('2d');
    if (!ctx) return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let level = 0;
    let tint = tintOf(conversation.phase);
    const rgba = (c: number[], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

    function size() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
    observer?.observe(canvas!);

    function draw(ms: number) {
      const t = ms / 1000;
      const p = conversation.phase;
      // Toward the level and the tint of now, quickly up and slower down: a voice, not a flicker.
      const goal = target();
      level += (goal - level) * (goal > level ? 0.45 : 0.18);
      const want = tintOf(p);
      tint = tint.map((v, i) => v + (want[i] - v) * 0.08);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      ctx!.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2 - 40;
      const base = Math.min(92, Math.max(56, Math.min(w, h) * 0.11));
      const r0 = base + level * base * 0.3 + (thinking(p) && !still ? 3 * Math.sin(t * 1.6) : 0);
      // The halo, wider with the sound.
      const halo = ctx!.createRadialGradient(cx, cy, r0 * 0.2, cx, cy, r0 * 2.6);
      halo.addColorStop(0, rgba(tint, 0.2 + level * 0.22));
      halo.addColorStop(1, rgba(tint, 0));
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(cx, cy, r0 * 2.6, 0, Math.PI * 2);
      ctx!.fill();
      // The body: its edge breathes with the sound.
      ctx!.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const k = still ? 1 : 1 + (0.04 + level * 0.1) * Math.sin(a * 3 + t * 1.7) + (0.025 + level * 0.07) * Math.sin(a * 5 - t * 2.3);
        const x = cx + Math.cos(a) * r0 * k;
        const y = cy + Math.sin(a) * r0 * k;
        if (i) ctx!.lineTo(x, y);
        else ctx!.moveTo(x, y);
      }
      const body = ctx!.createRadialGradient(cx - r0 * 0.35, cy - r0 * 0.45, r0 * 0.1, cx, cy, r0 * 1.1);
      body.addColorStop(0, 'rgba(255,236,214,0.95)');
      body.addColorStop(0.35, rgba(tint, 0.95));
      body.addColorStop(
        1,
        rgba(
          tint.map((v) => v * 0.35),
          1,
        ),
      );
      ctx!.fillStyle = body;
      ctx!.fill();
      // Whisper transcribes, the agent works: an arc turns around it.
      if (thinking(p)) {
        ctx!.strokeStyle = 'rgba(255,236,214,0.3)';
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        const s = still ? 0 : t * 2;
        ctx!.arc(cx, cy, r0 + 26, s, s + 1.2);
        ctx!.stroke();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  });

  // Escape ends it, before anything else of the window takes the key.
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    conversation.stop();
  }
</script>

<svelte:window onkeydowncapture={onKey} />

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={t('voice.conversation.overlay.label', { name })}
  data-conversation-overlay
  data-conversation-phase={phase}
>
  <div class="top">
    <span class="dot"></span>
    <span class="who">{name}</span>
    {#if project}<span class="muted">· {project.name}</span>{/if}
    <span class="muted">· {t('voice.conversation.overlay.context')}</span>
    <span class="quit"><kbd>{keyLabel('Esc')}</kbd> {t('voice.conversation.overlay.quit')}</span>
  </div>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <div class="state" role="status" aria-live="polite">
    {t(`voice.conversation.phase.${phase}` as 'voice.conversation.phase.working', { name })}
  </div>
  <div class="subs" aria-live="polite">
    {#if subtitle}
      {#key subtitle}
        <div class="sub" data-subtitle={subtitle.who}>
          <span class="speaker">{subtitle.who === 'user' ? t('voice.conversation.overlay.you') : name}</span>
          <p class="line" class:user={subtitle.who === 'user'}>{subtitle.text}</p>
        </div>
      {/key}
    {/if}
  </div>
  <div class="bar">
    {#if phase === 'paused'}
      <button class="pill" onclick={() => conversation.resume()}>{t('voice.conversation.resume')}</button>
    {/if}
    <button class="pill stop" onclick={() => conversation.stop()}
      ><span class="sq" aria-hidden="true"></span>{t('voice.conversation.stop')}</button
    >
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: radial-gradient(120% 90% at 50% 42%, rgba(27, 25, 23, 0.9), rgba(14, 12, 11, 0.98));
    backdrop-filter: blur(6px);
    color: var(--text);
    animation: in 0.18s ease-out;
  }
  @keyframes in {
    from {
      opacity: 0;
    }
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .top {
    position: absolute;
    top: 18px;
    left: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--muted);
    z-index: 1;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
  }
  .who {
    color: var(--text);
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
  .quit {
    margin-left: auto;
    color: var(--dim);
  }
  kbd {
    font: 11px var(--mono);
    padding: 1px 6px;
    border: 1px solid var(--line2);
    border-radius: 5px;
    color: var(--muted);
  }
  .state {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(50% + 110px);
    text-align: center;
    color: var(--muted);
    font-size: 13px;
  }
  .subs {
    position: absolute;
    left: 50%;
    bottom: 96px;
    transform: translateX(-50%);
    width: min(860px, 84%);
    text-align: center;
  }
  .sub {
    animation: in 0.2s ease-out;
  }
  .speaker {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--dim);
  }
  /* One or two lines at a time: a longer sentence keeps its end, the part being heard. */
  .line {
    margin: 0;
    font-size: 22px;
    line-height: 1.42;
    text-wrap: balance;
    text-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .line.user {
    color: color-mix(in oklch, var(--text) 78%, var(--muted));
  }
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 28px;
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  .pill {
    height: 36px;
    padding: 0 18px;
    border-radius: 18px;
    border: 1px solid var(--line2);
    background: rgba(42, 39, 36, 0.8);
    color: var(--text);
    font: 600 13px var(--ui);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .pill.stop {
    background: var(--text);
    color: #1b1512;
    border-color: transparent;
  }
  .sq {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    background: currentColor;
  }
  @media (prefers-reduced-motion: reduce) {
    .overlay,
    .sub {
      animation: none;
    }
  }
</style>
