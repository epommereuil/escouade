<script lang="ts">
  import { t } from '../lib/i18n';
  import { OS } from '../lib/platform';
  import { app } from '../lib/state.svelte';

  // The first start: Escouade works as soon as one harness is found. With none, each one Escouade knows, with the command
  // that installs it.
  const none = $derived(app.enginesFound.length === 0);
</script>

<div class="welcome">
  <div class="card">
    <span class="mark">C</span>
    <h1>Escouade</h1>
    <p>{t('shell.welcome.intro')}</p>
    {#if none}
      <section class="none" aria-labelledby="no-engine">
        <h2 id="no-engine" class="warn">{t('shell.welcome.noEngine')}</h2>
        <p>{t('shell.welcome.noEngineDesc')}</p>
        <ul>
          {#each app.engines as e (e.id)}
            <li><span class="name">{e.name}</span><code class="mono">{OS === 'windows' ? e.install.windows : e.install.unix}</code></li>
          {/each}
        </ul>
      </section>
    {/if}
    <button
      class="btn primary big"
      onclick={() => {
        app.modal = { kind: 'newProject' };
      }}>+ {t('shell.welcome.addProject')}</button
    >
  </div>
</div>

<style>
  .welcome {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    max-width: 460px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .mark {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-ink);
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  h1 {
    margin: 6px 0 0;
    font-size: 22px;
  }
  p {
    margin: 0;
    color: var(--muted);
    line-height: 1.55;
  }
  .warn {
    color: var(--wait);
  }
  .none {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
  }
  h2 {
    margin: 0;
    font-size: 13px;
  }
  ul {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  li .name {
    font-weight: 600;
  }
  code {
    padding: 3px 8px;
    border-radius: var(--r-sm);
    background: var(--panel);
    font-size: 11.5px;
    user-select: all;
  }
  .big {
    margin-top: 10px;
    height: 36px;
    padding: 0 18px;
    font-size: 13px;
  }
</style>
