import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLang } from '../../lib/i18n';
import { app } from '../../lib/state.svelte';
import type { SpeechInfo, SpeechVoice, VoiceInfo } from '../../lib/types';
import { fakeBackend, resetApp } from '../../test/ipc';
import SettingsModal from '../modals/SettingsModal.svelte';

vi.mock('../../lib/terminals', () => ({ launchLog: () => ({}), disposeLog() {} }));

const VOICE: VoiceInfo = { devices: [], models: [{ id: 'base', size: 147_951_465, speed: 4, quality: 2, downloaded: true }] };

function voice(over: Partial<SpeechVoice>): SpeechVoice {
  return {
    id: 'x',
    lang: 'fr',
    locale: 'fr_FR',
    name: 'X',
    quality: 'medium',
    speakers: 1,
    speakerNames: [],
    sampleRate: 22_050,
    repo: 'rhasspy/piper-voices',
    onnxSize: 63_201_294,
    jsonSize: 4_875,
    license: 'mit',
    datasetLicense: null,
    datasetUrl: null,
    attribution: null,
    downloaded: false,
    ...over,
  };
}

const SPEECH: SpeechInfo = {
  available: true,
  voices: [
    voice({
      id: 'fr_FR-siwis-medium',
      name: 'Siwis',
      datasetLicense: 'CC-BY 4.0',
      attribution: 'https://datashare.is.ed.ac.uk/handle/10283/2353 (CC-BY 4.0)',
      downloaded: true,
    }),
    voice({ id: 'fr_FR-mls-medium', name: 'MLS', speakers: 125, onnxSize: 76_733_750, datasetLicense: 'CC-BY 4.0' }),
    voice({ id: 'fr_FR-gilles-low', name: 'Gilles', quality: 'low', datasetLicense: 'CC0' }),
    voice({ id: 'en_US-ljspeech-medium', lang: 'en', name: 'LJSpeech', datasetLicense: 'public domain' }),
  ],
};

function open(over: Record<string, (a: any) => unknown> = {}) {
  const backend = fakeBackend({ voice_info: () => VOICE, speech_info: () => SPEECH, save_settings: () => [], ...over });
  render(SettingsModal, { tab: 'voice' });
  return backend;
}

describe('Réglages › Voix, the conversation', () => {
  beforeEach(() => {
    resetApp();
    setLang('fr');
    app.modal = { kind: 'settings' };
  });

  it('shows the voice of each language with its licences and its credit; another one chosen is saved', async () => {
    const backend = open();
    const fr = await waitFor(() => {
      const el = document.querySelector('[data-speech-lang="fr"]') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    const select = within(fr).getByRole('combobox', { name: 'Voix en Français' }) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('fr_FR-siwis-medium'));
    // Only the French ones, with their quality and size.
    expect([...select.options].map((o) => o.text)).toEqual([
      'Siwis · qualité moyenne · 60 Mo',
      'MLS (125) · qualité moyenne · 73 Mo',
      'Gilles · qualité basse · 60 Mo',
    ]);
    const licence = fr.querySelector('[data-speech-licence]')!.textContent!;
    expect(licence).toContain('Licence du modèle : mit');
    expect(licence).toContain('Jeu de données : CC-BY 4.0');
    expect(licence).toContain('Crédit : https://datashare.is.ed.ac.uk/handle/10283/2353 (CC-BY 4.0)');
    // Downloaded: it can be listened to.
    await userEvent.click(within(fr).getByRole('button', { name: '▶ Écouter' }));
    expect(backend.called('speech_preview')[0].args).toEqual({ id: 'fr_FR-siwis-medium', speaker: undefined });
    // Another, with several speakers: its speaker is chosen too, and both are saved.
    await userEvent.selectOptions(select, 'fr_FR-mls-medium');
    const speaker = within(fr).getByRole('combobox', { name: 'Locuteur' }) as HTMLSelectElement;
    expect(speaker.options).toHaveLength(125);
    await userEvent.selectOptions(speaker, '3');
    expect(within(fr).getByRole('button', { name: 'Télécharger (73 Mo)' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const saved = backend.called('save_settings')[0].args.settings.voice.speech;
    expect(saved.voices).toEqual({ fr: 'fr_FR-mls-medium' });
    expect(saved.speakers).toEqual({ 'fr_FR-mls-medium': 3 });
  });

  it('downloads a voice from here', async () => {
    const backend = open({ speech_download: () => null });
    const en = await waitFor(() => {
      const el = document.querySelector('[data-speech-lang="en"]') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    await userEvent.click(await within(en).findByRole('button', { name: /^Télécharger/ }));
    expect(backend.called('speech_download')[0].args).toEqual({ id: 'en_US-ljspeech-medium' });
  });

  it('says when this machine cannot speak', async () => {
    open({ speech_info: () => ({ ...SPEECH, available: false }) });
    expect(
      await screen.findByText('La synthèse vocale n’est pas disponible : le moteur de la voix (ONNX Runtime) est introuvable dans l’app.'),
    ).toBeTruthy();
  });
});
