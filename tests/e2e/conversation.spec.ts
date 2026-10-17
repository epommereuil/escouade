// ESC-97, the voice conversation: no microphone nor speakers on CI, so the app hears a WAV of a spoken question in
// place of the microphone (`ESCOUADE_VOICE_WAV`, debug builds only), gives fixed texts in place of Whisper
// (`ESCOUADE_VOICE_TRANSCRIPT`, « a|b » one after the other), and reads aloud with a fake voice that writes what it says
// to a file and plays it in silence (`ESCOUADE_SPEECH_FAKE`). The fake claude answers a sentence said in a conversation
// with a passage to be read between <spoken> and </spoken>.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { addProject, expect, test, type App } from './fixture';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** « Ajoute un test pour la page des réglages, puis lance la suite. », said by Piper, between silences. */
const QUESTION = path.join(ROOT, 'src-tauri', 'src', 'voice', 'testdata', 'question-fr.wav');
const SAID = 'Ajoute un test pour la page des réglages, puis lance la suite.';
const VOICES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri', 'src', 'voice', 'speech', 'voices.json'), 'utf8')) as {
  id: string;
  onnxSize: number;
  jsonSize: number;
}[];
const BASE_SIZE = 147_951_465;

/** A file of `size` bytes that holds nothing (the fake transcriber and voice read nothing of it). */
function sparse(file: string, size: number) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'w');
  fs.ftruncateSync(fd, size);
  fs.closeSync(fd);
}

/** Whisper's model and the French voice, in the app's data folder: no download offered. */
function placeModels(root: string) {
  sparse(path.join(root, 'data', 'voice', 'models', 'ggml-base.bin'), BASE_SIZE);
  const v = VOICES.find((x) => x.id === 'fr_FR-siwis-medium')!;
  sparse(path.join(root, 'data', 'voice', 'voices', `${v.id}.onnx`), v.onnxSize);
  sparse(path.join(root, 'data', 'voice', 'voices', `${v.id}.onnx.json`), v.jsonSize);
}

/** The WAV of the question said twice, `gap` seconds of silence between (a sentence, then the answer to a question). */
function twice(file: string, gap: number) {
  const wav = fs.readFileSync(QUESTION);
  const data = wav.indexOf(Buffer.from('data')) + 8;
  const rate = wav.readUInt32LE(24);
  const speech = wav.subarray(data);
  const silence = Buffer.alloc(Math.round(rate * gap) * 2);
  const body = Buffer.concat([speech, silence, speech]);
  const head = Buffer.from(wav.subarray(0, 44));
  head.writeUInt32LE(36 + body.length, 4);
  head.writeUInt32LE(body.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, body]));
}

const said = (log: string) => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []);

/** What the fake CLI read on its stdin: the messages sent to the agent. */
function sent(app: App): string[] {
  const file = path.join(app.root, 'fake-claude.stdin.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.stringify(JSON.parse(l)));
}

const button = (page: Page) => page.getByRole('button', { name: 'Conversation', exact: true });
const panel = (page: Page) => page.locator('[data-conversation-phase]');

const SPOKEN_LOG = path.join(os.tmpdir(), `escouade-e2e-spoken-${process.pid}.txt`);

test.describe('a voice conversation from a WAV file', () => {
  test.use({
    appEnv: { ESCOUADE_VOICE_WAV: QUESTION, ESCOUADE_VOICE_TRANSCRIPT: SAID, ESCOUADE_SPEECH_FAKE: SPOKEN_LOG },
    preStart: {
      run: (root: string) => {
        placeModels(root);
        fs.rmSync(SPOKEN_LOG, { force: true });
      },
    },
  });

  test('the question said is sent after its silence, the passage of the answer is read aloud, then it listens again', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    await button(page).click();
    await expect(button(page)).toHaveAttribute('aria-pressed', 'true');
    // The WAV is heard: a sentence, then its silence ends it.
    await expect(panel(page)).toHaveAttribute('data-conversation-phase', /listening|hearing/);
    await expect(panel(page)).toHaveAttribute('data-conversation-phase', 'hearing', { timeout: 10_000 });
    // Sent by itself, with the instruction to end with a passage to be read.
    await expect.poll(() => sent(app).find((m) => m.includes('réglages')) ?? '', { timeout: 20_000 }).toContain('<escouade-voice>');
    // The answer: the passage apart, the whole answer in the conversation.
    const passage = page.locator('[data-spoken]');
    await expect(passage).toContainText("C'est noté, je m'en occupe.");
    await expect(page.getByText('détail technique', { exact: false })).toBeVisible();
    await expect(page.getByText('<spoken>')).toHaveCount(0);
    // The user's message, as said: without the instruction.
    await expect(page.locator('.bubble').getByText(SAID)).toBeVisible();
    await expect(page.locator('[data-said-aloud]')).toBeVisible();
    await expect(page.getByText('Conversation vocale :')).toHaveCount(0);
    // Read by the voice, then listening again.
    await expect.poll(() => said(SPOKEN_LOG), { timeout: 15_000 }).toEqual(["C'est noté, je m'en occupe."]);
    await expect(panel(page)).toHaveAttribute('data-conversation-phase', 'listening', { timeout: 15_000 });
    const log = fs.readFileSync(path.join(app.data, 'app.log'), 'utf8');
    expect(log).toMatch(/voice: conversation listening at 16000 Hz/);
    // « Arrêter »: the microphone closes.
    await panel(page)
      .getByRole('button', { name: /Arrêter/ })
      .click();
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(() => fs.readFileSync(path.join(app.data, 'app.log'), 'utf8')).toMatch(/voice: conversation stopped/);
  });
});

const TWICE = path.join(os.tmpdir(), `escouade-e2e-twice-${process.pid}.wav`);
twice(TWICE, 12);

test.describe('a question of the agent answered aloud', () => {
  test.use({
    appEnv: {
      ESCOUADE_VOICE_WAV: TWICE,
      ESCOUADE_VOICE_TRANSCRIPT: 'Crée la base de données|La deuxième.',
      ESCOUADE_SPEECH_FAKE: SPOKEN_LOG,
    },
    preStart: {
      run: (root: string) => {
        placeModels(root);
        fs.rmSync(SPOKEN_LOG, { force: true });
      },
    },
  });

  test('the question is read with its choices, the option said answers it, and the answer is read', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    await button(page).click();
    await expect.poll(() => said(SPOKEN_LOG)[0] ?? '', { timeout: 25_000 }).toBe('Quelle base de données?');
    await expect.poll(() => said(SPOKEN_LOG).slice(1, 2), { timeout: 5_000 }).toEqual(['Les choix sont: PostgreSQL ou SQLite.']);
    // « La deuxième »: SQLite, answered for the user.
    await expect.poll(() => said(SPOKEN_LOG).at(-1), { timeout: 30_000 }).toBe('Tu as choisi SQLite.');
    await expect(page.getByText('Tu as choisi SQLite.').first()).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-conversation-phase', 'listening', { timeout: 15_000 });
  });
});

const realModel = process.env.ESCOUADE_E2E_WHISPER_MODEL;
const realVoice = process.env.ESCOUADE_E2E_PIPER_VOICE;

test.describe('a voice conversation with the real Whisper and the real Piper', () => {
  test.skip(!realModel || !realVoice, 'ESCOUADE_E2E_WHISPER_MODEL and ESCOUADE_E2E_PIPER_VOICE (fr_FR-siwis-medium.onnx) not given');
  test.use({
    appEnv: { ESCOUADE_VOICE_WAV: QUESTION, ESCOUADE_SPEECH_SILENT: '1' },
    preStart: {
      run: (root: string) => {
        const models = path.join(root, 'data', 'voice', 'models');
        const voices = path.join(root, 'data', 'voice', 'voices');
        fs.mkdirSync(models, { recursive: true });
        fs.mkdirSync(voices, { recursive: true });
        fs.copyFileSync(realModel!, path.join(models, 'ggml-base.bin'));
        fs.copyFileSync(realVoice!, path.join(voices, 'fr_FR-siwis-medium.onnx'));
        fs.copyFileSync(`${realVoice}.json`, path.join(voices, 'fr_FR-siwis-medium.onnx.json'));
      },
    },
  });

  test('transcribes the question on the machine, sends it, and reads the passage with Piper', async ({ app }) => {
    const { page } = app;
    await addProject(page, app.repo);
    await button(page).click();
    await expect.poll(() => sent(app).find((m) => m.includes('<escouade-voice>')) ?? '', { timeout: 60_000 }).toMatch(/r[ée]glages/i);
    await expect(page.locator('[data-spoken]')).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => fs.readFileSync(path.join(app.data, 'app.log'), 'utf8'), { timeout: 60_000 })
      .toMatch(/speech: voice loaded in/);
    await expect(panel(page)).toHaveAttribute('data-conversation-phase', 'listening', { timeout: 30_000 });
    const log = fs.readFileSync(path.join(app.data, 'app.log'), 'utf8');
    console.log(
      log
        .split('\n')
        .filter((l) => /voice:|speech:/.test(l))
        .join('\n'),
    );
  });
});
