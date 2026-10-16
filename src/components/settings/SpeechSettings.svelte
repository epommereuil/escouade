<script lang="ts">
  import { conversation } from '../../lib/conversation.svelte';
  import { fBytes } from '../../lib/format';
  import { t } from '../../lib/i18n';
  import { api } from '../../lib/ipc';
  import { settingsForm } from '../../lib/settings.svelte';
  import { app } from '../../lib/state.svelte';
  import type { SpeechInfo, SpeechVoice } from '../../lib/types';
  import Group from './Group.svelte';
  import Row from './Row.svelte';

  // Réglages › Voix, the conversation's part (ESC-97): the voice of each language among those whose licence allows it,
  // « Écouter », its download (size, progress) and its deletion, its licences and the credit it asks for; the pace, the
  // volume, and the silence that sends what was said. Saved with the other settings.
  const s = $derived(settingsForm.settings.voice.speech);
  let info = $state<SpeechInfo | null>(null);
  let playing = $state<string | null>(null);
  let downloading = $state<Record<string, boolean>>({});

  const DEFAULTS: Record<string, string> = { fr: 'fr_FR-siwis-medium', en: 'en_US-ljspeech-medium' };
  const LANGS = ['fr', 'en'] as const;

  async function load() {
    info = await api.speechInfo().catch(() => ({ available: false, voices: [] }));
  }
  $effect(() => {
    void load();
  });

  const voicesOf = (lang: string) => (info?.voices ?? []).filter((v) => v.lang === lang);
  const chosen = (lang: string): SpeechVoice | undefined => {
    const id = s.voices[lang] || DEFAULTS[lang];
    return voicesOf(lang).find((v) => v.id === id) ?? voicesOf(lang)[0];
  };
  const quality = (q: string) => {
    const k = q === 'x_low' ? 'xLow' : q;
    return ['low', 'medium', 'high', 'xLow'].includes(k) ? t(`voice.speech.quality.${k as 'low'}`) : q;
  };
  const label = (v: SpeechVoice) =>
    t('voice.speech.voiceLabel', {
      name: `${v.name}${v.speakers > 1 ? ` (${v.speakers})` : ''}`,
      quality: quality(v.quality),
      size: fBytes(v.onnxSize + v.jsonSize),
    });

  async function download(v: SpeechVoice) {
    downloading[v.id] = true;
    try {
      await api.speechDownload(v.id);
    } catch (e) {
      app.toast(t('voice.downloadFailed', { error: String(e) }), 'error');
    }
    downloading[v.id] = false;
    delete conversation.voiceDownloads[v.id];
    await load();
  }

  async function remove(v: SpeechVoice) {
    try {
      await api.speechDelete(v.id);
    } catch (e) {
      app.toast(t('voice.deleteFailed', { error: String(e) }), 'error');
    }
    await load();
  }

  async function listen(v: SpeechVoice) {
    playing = v.id;
    try {
      await api.speechPreview(v.id, s.speakers[v.id]);
    } catch (e) {
      app.toast(t('voice.speech.previewFailed', { error: String(e) }), 'error');
    }
    playing = null;
  }

  const pct = (id: string) => {
    const p = conversation.voiceDownloads[id];
    return p && p.total ? Math.round((p.done / p.total) * 100) : 0;
  };
</script>

<Group title={t('voice.speech.title')} note={info && !info.available ? t('voice.speech.unavailable') : t('voice.speech.note')}>
  {#each LANGS as lang (lang)}
    {@const v = chosen(lang)}
    <Row label={t('voice.speech.voiceFor', { lang: t(`voice.languages.${lang}`) })} desc={t('voice.speech.voiceDesc')}>
      <div class="voice" data-speech-lang={lang}>
        <select
          class="field input"
          aria-label={t('voice.speech.voiceFor', { lang: t(`voice.languages.${lang}`) })}
          value={v?.id ?? ''}
          onchange={(e) => (s.voices = { ...s.voices, [lang]: e.currentTarget.value })}
        >
          {#each voicesOf(lang) as o (o.id)}
            <option value={o.id}>{label(o)}</option>
          {/each}
        </select>
        {#if v}
          {#if v.speakers > 1}
            <label class="speaker">
              <span class="meta">{t('voice.speech.speaker')}</span>
              <select
                class="field small-select"
                value={s.speakers[v.id] ?? 0}
                onchange={(e) => (s.speakers = { ...s.speakers, [v.id]: Number(e.currentTarget.value) })}
              >
                {#each Array.from({ length: v.speakers }, (_, i) => i) as i (i)}
                  <option value={i}>{v.speakerNames[i] && !/^voice-\d+$/.test(v.speakerNames[i]) ? v.speakerNames[i] : `#${i + 1}`}</option>
                {/each}
              </select>
            </label>
          {/if}
          <div class="actions">
            {#if downloading[v.id]}
              <span class="meta mono">{pct(v.id)} %</span>
              <button class="btn ghost small" onclick={() => api.speechDownloadCancel(v.id)}>{t('voice.conversation.cancel')}</button>
            {:else if v.downloaded}
              <button class="btn small" disabled={!info?.available || playing !== null} onclick={() => listen(v)}
                >{playing === v.id ? t('voice.speech.listening') : `▶ ${t('voice.speech.listen')}`}</button
              >
              <button class="btn ghost small" onclick={() => remove(v)}>{t('voice.speech.delete')}</button>
            {:else}
              <button class="btn small" disabled={!info?.available} onclick={() => download(v)}
                >{t('voice.speech.download')} ({fBytes(v.onnxSize + v.jsonSize)})</button
              >
            {/if}
          </div>
          <p class="licences" data-speech-licence>
            {t('voice.speech.licence', { license: v.license })} ·
            {v.datasetLicense && !/^see /i.test(v.datasetLicense)
              ? t('voice.speech.dataset', { license: v.datasetLicense })
              : t('voice.speech.datasetUnknown')}
            {#if v.attribution}<br />{t('voice.speech.attribution', { text: v.attribution })}{/if}
          </p>
        {/if}
      </div>
    </Row>
  {/each}
  <Row label={t('voice.speech.rate')} desc={t('voice.speech.rateDesc')}>
    <div class="slider">
      <input type="range" min="0.5" max="2" step="0.1" aria-label={t('voice.speech.rate')} bind:value={s.rate} />
      <span class="meta mono">{s.rate.toFixed(1)}×</span>
    </div>
  </Row>
  <Row label={t('voice.speech.volume')}>
    <div class="slider">
      <input type="range" min="0" max="1" step="0.05" aria-label={t('voice.speech.volume')} bind:value={s.volume} />
      <span class="meta mono">{Math.round(s.volume * 100)} %</span>
    </div>
  </Row>
  <Row label={t('voice.speech.silence')} desc={t('voice.speech.silenceDesc')}>
    <div class="slider">
      <input type="range" min="500" max="3000" step="100" aria-label={t('voice.speech.silence')} bind:value={s.silenceMs} />
      <span class="meta mono">{t('voice.speech.seconds', { n: (s.silenceMs / 1000).toFixed(1) })}</span>
    </div>
  </Row>
</Group>

<style>
  .voice {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    min-width: 360px;
    max-width: 60%;
  }
  .input {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    background: var(--panel);
    font-size: 12px;
  }
  .speaker {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .small-select {
    height: 26px;
    padding: 0 6px;
    background: var(--panel);
    font-size: 12px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .licences {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--dim);
    text-align: right;
    overflow-wrap: anywhere;
  }
  .meta {
    font-size: 11.5px;
    color: var(--dim);
  }
  .small {
    height: 24px;
    padding: 0 8px;
    font-size: 11.5px;
  }
  .slider {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .slider input {
    width: 200px;
  }
</style>
