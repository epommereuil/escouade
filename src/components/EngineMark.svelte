<script lang="ts">
  import { engineName, showsMark } from '../lib/engines';
  import { t } from '../lib/i18n';
  import { tip } from '../lib/tip';
  import type { EngineId } from '../lib/types';

  // The brand of an agent's harness: on its card, in the overview, in its header. Only once agents run on two harnesses:
  // with one, it would say nothing.
  let { engine }: { engine: EngineId | null | undefined } = $props();

  const name = $derived(engineName(engine ?? 'claude'));
  /** Its first word: « Claude » for Claude Code, « Copilot » for Copilot CLI. */
  const short = $derived(name.split(' ')[0]);
</script>

{#if showsMark()}
  <span
    class="mark"
    data-engine={engine ?? 'claude'}
    role="img"
    aria-label={t('nav.sidebar.engineMark', { engine: name })}
    use:tip={{ text: t('nav.sidebar.engineMark', { engine: name }), aria: false }}>{short}</span
  >
{/if}

<style>
  .mark {
    flex: none;
    padding: 0 5px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 10px;
    line-height: 15px;
    color: var(--muted);
    white-space: nowrap;
  }
</style>
