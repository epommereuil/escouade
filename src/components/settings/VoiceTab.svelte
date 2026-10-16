<script lang="ts">
  import { DEFAULT_SHORTCUT, shortcutLabel, shortcutOf } from '../../lib/dictation';
  import { dictation } from '../../lib/dictation.svelte';
  import { fBytes } from '../../lib/format';
  import { t } from '../../lib/i18n';
  import { api } from '../../lib/ipc';
  import { settingsForm } from '../../lib/settings.svelte';
  import { app } from '../../lib/state.svelte';
  import type { VoiceInfo } from '../../lib/types';
  import Chips from './Chips.svelte';
  import Group from './Group.svelte';
  import Row from './Row.svelte';
  import { tip } from '../../lib/tip';

  // « Voix »: the microphone, the Whisper model (downloaded or deleted at once, chosen with the draft), the language
  // spoken and the shortcut, saved with the other settings.
  const v = $derived(settingsForm.settings.voice);
  let info = $state<VoiceInfo | null>(null);
  let recording = $state(false);
  /** The model being downloaded from here, and how far. */
  const progress = $derived(dictation.progress);
  let busy = $state<string | null>(null);

  async function load() {
    info = await api.voiceInfo().catch(() => ({ devices: [], models: [] }));
  }
  $effect(() => {
    void load();
  });

  const LANGS = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl'] as const;
  const languageOptions = $derived([
    { value: 'ui', label: t('voice.settings.languageUi') },
    { value: 'auto', label: t('voice.settings.languageAuto') },
    ...LANGS.map((l) => ({ value: l, label: t(`voice.languages.${l}`), lang: l })),
  ]);
  const systemDevice = $derived(info?.devices.find((d) => d.default));

  async function download(model: string) {
    busy = model;
    dictation.offer = { model, size: info?.models.find((m) => m.id === model)?.size ?? 0 };
    dictation.phase = 'offer';
    await dictation.download();
    busy = null;
    await load();
  }

  async function remove(model: string) {
    try {
      await api.voiceDeleteModel(model);
    } catch (e) {
      app.toast(t('voice.deleteFailed', { error: String(e) }), 'error');
    }
    await load();
  }

  function record(e: KeyboardEvent) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return stopRecording();
    const s = shortcutOf(e);
    if (!s) return;
    v.shortcut = s;
    stopRecording();
  }

  function startRecording() {
    recording = true;
    dictation.recording = true;
  }

  function stopRecording() {
    recording = false;
    dictation.recording = false;
  }

  $effect(() => () => (dictation.recording = false));
</script>

<Group title={t('voice.settings.microphone')}>
  <Row label={t('voice.settings.device')} desc={info && !info.devices.length ? t('voice.settings.noDevice') : undefined}>
    <select class="field input" aria-label={t('voice.settings.device')} bind:value={v.device}>
      <option value=""
        >{systemDevice ? t('voice.settings.deviceSystemNamed', { name: systemDevice.name }) : t('voice.settings.deviceSystem')}</option
      >
      {#each info?.devices ?? [] as d (d.id)}
        <option value={d.id}>{d.name}</option>
      {/each}
      {#if v.device && info && !info.devices.some((d) => d.id === v.device)}
        <option value={v.device}>{v.device}</option>
      {/if}
    </select>
  </Row>
</Group>

<Group title={t('voice.settings.transcription')} note={t('voice.settings.transcriptionNote')}>
  <Row label={t('voice.settings.model')} desc={t('voice.settings.modelDesc')}>
    <div class="models" role="radiogroup" aria-label={t('voice.settings.model')}>
      {#each info?.models ?? [] as m (m.id)}
        {@const on = v.model === m.id}
        <div class="model" class:on>
          <label class="pick">
            <input type="radio" name="voice-model" value={m.id} checked={on} onchange={() => (v.model = m.id)} />
            <span class="name mono">{m.id}</span>
            <span class="meta">{fBytes(m.size)} · {t('voice.settings.modelSpeed', { speed: m.speed, quality: m.quality })}</span>
          </label>
          {#if progress && progress.model === m.id}
            <span class="meta mono">{Math.round((progress.done / Math.max(1, progress.total)) * 100)} %</span>
            <button class="btn ghost small" onclick={() => dictation.cancel()}>{t('voice.panel.cancel')}</button>
          {:else if m.downloaded}
            <span class="ok">{t('voice.settings.downloaded')}</span>
            <button
              class="btn ghost small"
              use:tip={t('voice.settings.deleteTitle', { model: m.id, size: fBytes(m.size) })}
              onclick={() => remove(m.id)}>{t('voice.settings.delete')}</button
            >
          {:else}
            <button class="btn small" disabled={!!busy || dictation.phase !== 'idle'} onclick={() => download(m.id)}
              >{t('voice.settings.download')}</button
            >
          {/if}
        </div>
      {/each}
    </div>
  </Row>
  <Row label={t('voice.settings.language')} desc={t('voice.settings.languageDesc')}>
    <Chips label={t('voice.settings.language')} options={languageOptions} bind:value={v.language} />
  </Row>
</Group>

<Group title={t('voice.settings.use')}>
  <Row label={t('voice.settings.shortcut')} desc={t('voice.settings.shortcutDesc')}>
    <div class="keys">
      {#if recording}
        <!-- svelte-ignore a11y_autofocus -->
        <button class="btn recording" autofocus onkeydown={record} onblur={stopRecording}>{t('voice.settings.recording')}</button>
        <span class="meta">{t('voice.settings.recordingHint')}</span>
      {:else}
        <kbd class="mono">{shortcutLabel(v.shortcut || DEFAULT_SHORTCUT)}</kbd>
        <button class="btn" onclick={startRecording}>{t('voice.settings.change')}</button>
        {#if v.shortcut !== DEFAULT_SHORTCUT}
          <button class="btn ghost" onclick={() => (v.shortcut = DEFAULT_SHORTCUT)}>{t('voice.settings.restore')}</button>
        {/if}
      {/if}
    </div>
  </Row>
</Group>

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
  .models {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 360px;
  }
  .model {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
  }
  .model.on {
    border-color: var(--line2);
    background: var(--panel);
  }
  .pick {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 8px;
    cursor: pointer;
    min-width: 0;
  }
  .name {
    font-size: 12.5px;
  }
  .meta {
    font-size: 11.5px;
    color: var(--dim);
  }
  .ok {
    font-size: 11.5px;
    color: var(--add);
  }
  .small {
    height: 24px;
    padding: 0 8px;
    font-size: 11.5px;
  }
  .keys {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  kbd {
    padding: 3px 8px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line2);
    background: var(--panel);
    font-size: 12px;
  }
  .recording {
    border-color: var(--accent);
  }
</style>
