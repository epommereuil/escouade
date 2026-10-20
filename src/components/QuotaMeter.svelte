<script lang="ts">
  import { fProjection, meterLabel, meterName, projectedPct, projectionLevel, quotaTip } from '../lib/accounts';
  import { fCountdown, fPct } from '../lib/format';
  import { t } from '../lib/i18n';
  import { app } from '../lib/state.svelte';
  import { tip } from '../lib/tip';
  import type { RateWindow } from '../lib/types';

  // One meter of an account's quota: a window labelled by its length (« 5h <bar> reset 3h01 → 64 % », « 7j », « 30j »), or the
  // month's credits. The bar is a meter that says its value to the keyboard and to screen readers; the percentage is not
  // written (a sighted pointer finds it in a tooltip over the bar, a keyboard on the bar's focus) unless `detail`: the
  // panel of the accounts writes it next to the bar.
  let {
    minutes,
    usage,
    now,
    detail = false,
    focusable = true,
  }: {
    /** The window's length (300: 5 hours); null for the month's credits. */
    minutes: number | null;
    /** The meter as last read; null while it is not known. */
    usage: RateWindow | null;
    /** The clock (ms), to count down to the reset. */
    now: number;
    /** The panel's form: the percentage written, no tooltip. */
    detail?: boolean;
    /** The bar takes the focus. Off when a button around it does (the keyboard then opens the panel, which writes the values). */
    focusable?: boolean;
  } = $props();

  const label = $derived(meterLabel(minutes));
  const name = $derived(meterName(minutes));
  const pct = $derived(usage ? Math.min(100, Math.max(0, usage.pct)) : 0);
  /** Where the window would end at the pace used so far (`projectedPct`), written after the reset; null when too early, or « Projection des quotas » off. */
  const projected = $derived(app.settings.quotaProjection === false ? null : projectedPct(minutes, usage, now));
  /** « 42 % · remise à zéro le 10/10 à 18:00 »: the tooltip and the bar's value as the screen reader reads it. */
  const text = $derived(quotaTip(usage));
</script>

<!-- The tooltip over the label, the bar and the reset, a bigger target than the bar; the bar says it to a screen reader. -->
<span class="q" class:detail use:tip={detail ? null : { text, aria: false }}>
  <span class="lbl" aria-hidden="true">{label}</span>
  <!-- The bar is a meter, and reached by Tab: its value is the only way to read it without a pointer. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <span
    class="bar"
    class:warn={pct > 80}
    role="meter"
    tabindex={focusable && !detail ? 0 : undefined}
    aria-label={name}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(pct)}
    aria-valuetext={text}
  >
    <span class="fill" style:width="{pct}%"></span>
  </span>
  {#if detail}<span class="v">{usage ? fPct(usage.pct) : '—'}</span>{/if}
  {#if usage?.resetsAt}
    <span class="d">{t('accounts.quota.reset', { countdown: fCountdown(usage.resetsAt, now) })}</span>
    {#if projected !== null}
      <span class="p {projectionLevel(projected)}">{t('accounts.quota.projected', { pct: fProjection(projected) })}</span>
    {/if}
  {:else if !usage && !detail}
    <span class="d">—</span>
  {/if}
</span>

<style>
  .q {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .bar {
    width: 48px;
    height: 5px;
    border-radius: 3px;
    background: var(--elev2);
    overflow: hidden;
    margin-left: 2px;
    flex: none;
  }
  .bar:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.4s;
  }
  .warn .fill {
    background: var(--wait);
  }
  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
  .v {
    color: var(--text);
  }
  /* The rows of the panel line up: the same width for the label, the bar and the percentage. */
  .detail .lbl {
    min-width: 22px;
    color: var(--muted);
  }
  .detail .bar {
    width: 120px;
    margin-left: 0;
  }
  .detail .v {
    width: 44px;
    text-align: right;
  }
  .d {
    color: var(--dim);
  }
  /* The projection at the reset: green, amber past 80 %, red past 100 % (the window runs out before its end). */
  .p.ok {
    color: var(--ok);
  }
  .p.warn {
    color: var(--wait);
  }
  .p.over {
    color: var(--del);
  }
</style>
