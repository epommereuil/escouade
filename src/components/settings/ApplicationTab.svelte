<script lang="ts">
  import { DEFAULT_FONT_SIZE, FONT_SIZE_MAX, FONT_SIZE_MIN, fontSize, setDisplay, ZOOM_LEVELS, zoomState } from '../../lib/display.svelte';
  import { writerOf, writerOptions } from '../../lib/engines';
  import { LANG_NAMES, t, type Lang } from '../../lib/i18n';
  import { keyLabel } from '../../lib/platform';
  import { settingsForm } from '../../lib/settings.svelte';
  import { app } from '../../lib/state.svelte';
  import Chips from './Chips.svelte';
  import Group from './Group.svelte';
  import Row from './Row.svelte';
  import Switch from './Switch.svelte';

  // The « Application » tab: the language of the interface and that of the texts Claude writes, saved with the other
  // settings and applied at once (the backend tells the window, the menus and its own texts); and the display (the zoom,
  // the font sizes of the terminals and of the editor), applied and saved as it changes, apart from the draft: its
  // shortcuts change it too, the modal open or not.
  const s = $derived(settingsForm.settings);
  /** Each language named in itself, whatever the interface's: who does not read it still finds their own. */
  const own = (['en', 'fr'] as const).map((l: Lang) => ({ value: l, label: LANG_NAMES[l], lang: l }));
  /** The system's language is named in the interface's: « Système (Anglais) », « System (English) ». */
  const uiOptions = $derived([
    { value: 'system' as const, label: t('settings.app.system', { lang: t(`settings.app.langName.${app.lang.system}`) }) },
    ...own,
  ]);
  /** « Modèle des textes rédigés »: the harnesses found. */
  const writers = $derived(writerOptions());
  /** The harness the texts go to, when it takes the model chosen here (OpenCode): its models, as its account listed them. */
  const writer = $derived(writerOf(s.writerEngine) ?? writers[0]?.value ?? null);
  const writerModels = $derived(
    writer && app.engines.find((e) => e.id === writer)?.writerTakesModel ? (app.engineModels[writer] ?? []) : null,
  );
  /** Its default model (« Par défaut »), named. */
  const writerDefault = $derived(writerModels?.find((m) => m.default));
  /** What the menu shows: the model chosen while it is one of them, else the default. */
  const writerModel = $derived(writerModels?.some((m) => m.id === s.writerModel) ? (s.writerModel ?? '') : '');
  const percent = (n: number) => t('settings.app.percent', { n });
  /** The steps the window cannot hold are not offered (`zoomState.fit`). */
  const zoomOptions = $derived(
    ZOOM_LEVELS.map((z) => ({
      value: z as number,
      label: percent(z),
      disabled: z > zoomState.fit,
      title: z > zoomState.fit ? t('settings.app.zoomTooBig') : undefined,
    })),
  );
  /** The zoom chosen, when the window is too small for it: what it is shown at meanwhile. */
  const held = $derived((app.settings.uiZoom ?? 100) > zoomState.fit);
  const zoomKeys = $derived(t('settings.app.zoomKeys', { in: keyLabel('Ctrl+='), out: keyLabel('Ctrl+-'), reset: keyLabel('Ctrl+0') }));

  /** A font size as typed, kept once the field is left (or its arrows used): held in range, shown as kept. */
  function setSize(key: 'terminalFontSize' | 'editorFontSize', input: HTMLInputElement) {
    const size = fontSize(input.value === '' ? NaN : Number(input.value));
    setDisplay({ [key]: size });
    input.value = String(size);
  }
  const claudeOptions = $derived([{ value: 'ui' as const, label: t('settings.app.sameAsUi') }, ...own]);
</script>

<Group title={t('settings.app.display')}>
  <Row label={t('settings.app.zoom')} desc={`${t('settings.app.zoomDesc')} ${zoomKeys}`}>
    <Chips
      label={t('settings.app.zoom')}
      options={zoomOptions}
      bind:value={() => app.settings.uiZoom ?? 100, (z) => setDisplay({ uiZoom: z })}
    />
  </Row>
  {#if held}
    <p class="held" role="status">
      {t('settings.app.zoomHeld', { zoom: percent(app.settings.uiZoom), shown: percent(zoomState.shown) })}
    </p>
  {/if}
  {#each ['terminalFontSize', 'editorFontSize'] as const as key (key)}
    <Row
      label={t(`settings.app.${key}`)}
      hint={t('settings.app.fontSizeHint', { n: DEFAULT_FONT_SIZE })}
      desc={t('settings.app.fontSizeDesc')}
    >
      <input
        class="field mono input"
        type="number"
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step="0.5"
        aria-label={t(`settings.app.${key}`)}
        value={app.settings[key] ?? DEFAULT_FONT_SIZE}
        onchange={(e) => setSize(key, e.currentTarget)}
      />
    </Row>
  {/each}
  <Row label={t('settings.app.quotaProjection')} desc={t('settings.app.quotaProjectionDesc')}>
    <Switch label={t('settings.app.quotaProjection')} bind:on={s.quotaProjection} />
  </Row>
</Group>

<Group title={t('settings.app.language')}>
  <Row label={t('settings.app.uiLanguage')}>
    <Chips label={t('settings.app.uiLanguage')} options={uiOptions} bind:value={s.language} />
  </Row>
  <Row label={t('settings.app.claudeLanguage')} desc={t('settings.app.claudeLanguageHelp')}>
    <Chips label={t('settings.app.claudeLanguage')} options={claudeOptions} bind:value={s.claudeLanguage} />
  </Row>
</Group>

<!-- Only the harnesses found are offered; none found, nothing to choose. -->
{#if writers.length}
  <Group title={t('settings.app.writing')}>
    <Row label={t('settings.app.writer')} desc={t('settings.app.writerHelp')}>
      <Chips
        label={t('settings.app.writer')}
        options={writers}
        bind:value={() => writerOf(s.writerEngine) ?? writers[0].value, (v) => (s.writerEngine = v)}
      />
    </Row>
    {#if writerModels}
      <Row label={t('settings.app.writerModel')} desc={t('settings.app.writerModelHelp')}>
        <select
          class="field select"
          aria-label={t('settings.app.writerModel')}
          disabled={!writerModels.length}
          value={writerModel}
          onchange={(e) => (s.writerModel = e.currentTarget.value)}
        >
          <option value=""
            >{writerDefault
              ? t('settings.app.writerModelDefault', { model: writerDefault.label })
              : t('settings.app.writerModelNone')}</option
          >
          {#each writerModels as m (m.id)}
            <option value={m.id}>{m.provider ? `${m.label} · ${m.provider}` : m.label}</option>
          {/each}
        </select>
      </Row>
    {/if}
  </Group>
{/if}

<style>
  .held {
    margin: 0;
    padding: 0 16px 12px;
    font-size: 11.5px;
    color: var(--wait);
  }
  .select {
    width: 260px;
    max-width: 50%;
    flex: none;
    height: 32px;
    background: var(--panel);
    font-size: 12px;
  }
  .input {
    width: 90px;
    flex: none;
    height: 32px;
    padding: 0 10px;
    background: var(--panel);
    font-size: 12px;
  }
</style>
