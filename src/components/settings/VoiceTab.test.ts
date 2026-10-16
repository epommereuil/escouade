import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dictation } from '../../lib/dictation.svelte';
import { setLang } from '../../lib/i18n';
import { app } from '../../lib/state.svelte';
import type { VoiceInfo } from '../../lib/types';
import { fakeBackend, resetApp } from '../../test/ipc';
import SettingsModal from '../modals/SettingsModal.svelte';

vi.mock('../../lib/terminals', () => ({ launchLog: () => ({}), disposeLog() {} }));

const INFO: VoiceInfo = {
  devices: [
    { id: 'wasapi:{a}', name: 'Micro du casque', default: true },
    { id: 'wasapi:{b}', name: 'Micro de la webcam', default: false },
  ],
  models: [
    { id: 'tiny', size: 77_691_713, speed: 5, quality: 1, downloaded: false },
    { id: 'base', size: 147_951_465, speed: 4, quality: 2, downloaded: true },
    { id: 'small', size: 487_601_967, speed: 3, quality: 3, downloaded: false },
  ],
};

const save = () => userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

function open(over: Record<string, (a: any) => unknown> = {}) {
  const backend = fakeBackend({ voice_info: () => INFO, save_settings: () => [], ...over });
  render(SettingsModal, { tab: 'voice' });
  return backend;
}

describe('Réglages › Voix', () => {
  beforeEach(() => {
    resetApp();
    setLang('fr');
    app.modal = { kind: 'settings' };
  });

  it('lists the microphones, the system’s first, and saves the one chosen', async () => {
    const backend = open();
    const select = (await screen.findByRole('combobox', { name: 'Micro utilisé' })) as HTMLSelectElement;
    await waitFor(() => expect(select.options).toHaveLength(3));
    expect([...select.options].map((o) => o.text)).toEqual(['Celui du système (Micro du casque)', 'Micro du casque', 'Micro de la webcam']);
    expect(select.value).toBe('');
    await userEvent.selectOptions(select, 'wasapi:{b}');
    await save();
    expect(backend.called('save_settings')[0].args.settings.voice).toEqual({
      device: 'wasapi:{b}',
      model: 'base',
      language: 'ui',
      shortcut: 'Mod+Shift+Space',
      speech: { voices: {}, speakers: {}, rate: 1, volume: 1, silenceMs: 1200 },
    });
  });

  it('shows each model with its size, speed and quality: base by default, downloaded; another chosen is saved', async () => {
    const backend = open();
    const base = await screen.findByRole('radio', { name: /^base/ });
    expect(base).toBeChecked();
    expect(screen.getByText(/^base/).closest('.model')).toHaveTextContent('Téléchargé');
    expect(screen.getByRole('radio', { name: /^small/ }).closest('label')).toHaveTextContent(/4\d\d Mo · Vitesse 3\/5 · qualité 3\/5/);
    await userEvent.click(screen.getByRole('radio', { name: /^small/ }));
    await save();
    expect(backend.called('save_settings')[0].args.settings.voice.model).toBe('small');
  });

  it('deletes a model at once, and downloads one with its progress', async () => {
    let info = INFO;
    let finish!: () => void;
    const backend = open({
      voice_info: () => info,
      voice_delete_model: () => {
        info = { ...INFO, models: INFO.models.map((m) => ({ ...m, downloaded: false })) };
      },
      voice_download: () => new Promise<void>((r) => (finish = r)),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Effacer' }));
    expect(backend.called('voice_delete_model')[0].args).toEqual({ model: 'base' });
    await waitFor(() => expect(screen.queryByText('Téléchargé')).toBeNull());
    await userEvent.click(screen.getAllByRole('button', { name: 'Télécharger' })[0]);
    expect(backend.called('voice_download')[0].args).toEqual({ model: 'tiny' });
    dictation.take({ kind: 'download', model: 'tiny', done: 38_845_856, total: 77_691_713 });
    await waitFor(() => expect(screen.getByText('50 %')).toBeInTheDocument());
    info = { ...INFO, models: INFO.models.map((m) => ({ ...m, downloaded: m.id === 'tiny' })) };
    finish();
    await waitFor(() => expect(screen.getByText(/^tiny/).closest('.model')).toHaveTextContent('Téléchargé'));
  });

  it('sets the language spoken: the interface’s by default, automatic detection, or one named in itself', async () => {
    const backend = open();
    const group = await screen.findByRole('group', { name: 'Langue parlée' });
    expect(within(group).getByRole('button', { name: 'Celle de l’interface' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Español' })).toHaveAttribute('lang', 'es');
    await userEvent.click(within(group).getByRole('button', { name: 'Détection automatique' }));
    await save();
    expect(backend.called('save_settings')[0].args.settings.voice.language).toBe('auto');
  });

  it('records a new shortcut, keeps the old one on Escape, and goes back to the default one', async () => {
    const backend = open();
    expect(await screen.findByText('Ctrl+Maj+Espace')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Changer' }));
    const rec = screen.getByRole('button', { name: 'Appuie sur le raccourci…' });
    expect(dictation.recording).toBe(true);
    await fireEvent.keyDown(rec, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Ctrl+Maj+Espace')).toBeInTheDocument();
    expect(dictation.recording).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Changer' }));
    // A letter without Ctrl or Alt would be typed in every field: not taken.
    await fireEvent.keyDown(screen.getByRole('button', { name: 'Appuie sur le raccourci…' }), { key: 'd', code: 'KeyD' });
    await fireEvent.keyDown(screen.getByRole('button', { name: 'Appuie sur le raccourci…' }), {
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      altKey: true,
    });
    expect(screen.getByText('Ctrl+Alt+D')).toBeInTheDocument();
    await save();
    expect(backend.called('save_settings')[0].args.settings.voice.shortcut).toBe('Mod+Alt+KeyD');
  });

  it('in English', async () => {
    open();
    setLang('en');
    expect(await screen.findByRole('combobox', { name: 'Microphone used' })).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Shift+Space')).toBeInTheDocument();
    setLang('fr');
  });
});
