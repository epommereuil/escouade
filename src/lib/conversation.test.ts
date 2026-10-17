import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agent, fakeBackend, resetApp } from '../test/ipc';
import {
  listed,
  normalize,
  optionAnswer,
  permissionAnswer,
  turnOver,
  withoutInstruction,
  withoutPassage,
  type AnswerWords,
} from './conversation';
import { conversation } from './conversation.svelte';
import { conversationOf } from './conversations.svelte';
import { dictation } from './dictation.svelte';
import { setLang } from './i18n';
import type { Agent, ConvItem, PermissionItem, QuestionItem, VoiceEvent } from './types';

const FR: AnswerWords = {
  yes: 'oui|ouais|ok|d’accord|vas-y|bien sûr',
  no: 'non|refuse|pas question',
  always: 'toujours',
  ordinals: ['premier|première|un|1', 'deuxième|second|deux|2', 'troisième|trois|3'],
};

describe('spoken answers', () => {
  it('reads words without case, accents nor punctuation', () => {
    expect(normalize('  Oui, D’accord !  ')).toBe("oui d'accord");
    expect(normalize('Évidemment…')).toBe('evidemment');
  });

  it('allows, denies or always allows a permission, and understands nothing that says both', () => {
    expect(permissionAnswer('Oui, vas-y.', FR, true)).toBe('allow');
    expect(permissionAnswer('D’accord', FR, true)).toBe('allow');
    expect(permissionAnswer('Non merci.', FR, true)).toBe('deny');
    expect(permissionAnswer('Oui, toujours.', FR, true)).toBe('always');
    // « Toujours » where the permission cannot be kept: once.
    expect(permissionAnswer('Toujours', FR, false)).toBe('allow');
    expect(permissionAnswer('Oui… enfin non.', FR, true)).toBeNull();
    expect(permissionAnswer('Je ne sais pas trop.', FR, true)).toBeNull();
    // A word inside another is not the word.
    expect(permissionAnswer('nonobstant', FR, true)).toBeNull();
  });

  it('finds the option named, or by its rank', () => {
    const options = ['SQLite', 'Postgres', 'Postgres avec Docker'];
    expect(optionAnswer('SQLite, s’il te plaît.', options, FR)).toBe('SQLite');
    expect(optionAnswer('Postgres avec Docker', options, FR)).toBe('Postgres avec Docker');
    expect(optionAnswer('Plutôt Postgres.', options, FR)).toBe('Postgres');
    expect(optionAnswer('La deuxième.', options, FR)).toBe('Postgres');
    expect(optionAnswer('La troisième', options, FR)).toBe('Postgres avec Docker');
    expect(optionAnswer('Aucune idée', options, FR)).toBeNull();
    expect(optionAnswer('', options, FR)).toBeNull();
  });

  it('lists options as they are said', () => {
    expect(listed(['A', 'B', 'C'], 'ou')).toBe('A, B ou C');
    expect(listed(['A'], 'ou')).toBe('A');
  });

  it('shows a message and an answer without what the conversation added to them', () => {
    expect(withoutInstruction('Ajoute un test\n\n<escouade-voice>Conversation vocale : …</escouade-voice>')).toEqual({
      text: 'Ajoute un test',
      spoken: true,
    });
    expect(withoutInstruction('Un message <escouade-voice> au milieu')).toEqual({
      text: 'Un message <escouade-voice> au milieu',
      spoken: false,
    });
    expect(withoutPassage('Fait.\n\n<spoken>C’est fa')).toBe('Fait.');
    expect(withoutPassage('Rien à cacher')).toBe('Rien à cacher');
  });

  it('finds the end of the turn after the ones counted, and its passage', () => {
    const items: ConvItem[] = [
      { kind: 'turn', id: 't0', ts: 0, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null },
      { kind: 'user', id: 'u1', text: 'x', images: 0, ts: 1, queued: false },
      { kind: 'text', id: 'a', text: 'Réponse', spoken: 'Premier passage', streaming: false },
      { kind: 'text', id: 'b', text: 'Suite', spoken: 'Le passage', streaming: false },
    ];
    expect(turnOver(items, 1)).toBeNull();
    items.push({ kind: 'turn', id: 't1', ts: 2, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null });
    expect(turnOver(items, 1)?.spoken).toBe('Le passage');
    expect(turnOver(items, 0)?.turn.id).toBe('t0');
  });
});

describe('the credits', () => {
  it('name every voice the app offers, with its licences and the credit it asks for', async () => {
    const fs = await import('node:fs');
    const voices = JSON.parse(fs.readFileSync('src-tauri/src/voice/speech/voices.json', 'utf8')) as {
      id: string;
      license: string;
      attribution: string | null;
    }[];
    const credits = fs.readFileSync('CREDITS.md', 'utf8');
    expect(voices.length).toBeGreaterThan(10);
    for (const v of voices) {
      const line = credits.split('\n').find((l) => l.startsWith(`| \`${v.id}\` |`));
      expect(line, v.id).toBeTruthy();
      expect(line).toContain(v.license);
      if (v.attribution) expect(line).toContain(v.attribution);
    }
    for (const engine of ['Piper', 'eSpeak NG', 'ONNX Runtime', 'whisper.cpp']) expect(credits).toContain(engine);
  });
});

describe('the conversation', () => {
  let backend: ReturnType<typeof fakeBackend>;
  let reading = 0;
  let a: Agent;
  const SESSION = 7;

  beforeEach(() => {
    setLang('fr');
    reading = 0;
    backend = fakeBackend({
      conversation_start: () => ({ kind: 'listening', session: SESSION }),
      conversation_say: () => ++reading,
      get_conversation: () => [],
    });
    a = agent({ id: 'a1', name: 'Alice' });
    resetApp({ agents: [a] });
  });

  afterEach(() => conversation.clear());

  const ev = (e: Record<string, unknown>) => conversation.take({ session: SESSION, ...e } as VoiceEvent);
  const said = () => backend.called('conversation_say').map((c) => c.args.text);
  const tick = () => new Promise((r) => setTimeout(r, 0));

  async function startTalking() {
    await conversation.start('a1');
    expect(conversation.phase).toBe('listening');
  }

  it('listens, sends what was said once its silence came, and reads the passage of the answer', async () => {
    await startTalking();
    ev({ kind: 'convSpeech' });
    expect(conversation.phase).toBe('hearing');
    ev({ kind: 'convTranscribing' });
    expect(conversation.phase).toBe('transcribing');
    ev({ kind: 'convHeard', text: 'Ajoute un test', error: null });
    await tick();
    expect(conversation.phase).toBe('working');
    expect(backend.called('conversation_send')[0].args).toEqual({ id: 'a1', text: 'Ajoute un test' });
    // The agent works: nothing read yet.
    const items: ConvItem[] = [{ kind: 'user', id: 'u', text: 'Ajoute un test', images: 0, ts: 1, queued: false }];
    conversation.observe(a, items);
    expect(said()).toEqual([]);
    items.push(
      { kind: 'text', id: 'm', text: 'J’ai ajouté `a.test.ts`.', spoken: 'J’ai ajouté le test.', streaming: false },
      { kind: 'turn', id: 't', ts: 2, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null },
    );
    conversation.observe(a, items);
    await tick();
    expect(conversation.phase).toBe('speaking');
    expect(said()).toEqual(['J’ai ajouté le test.']);
    // Read to its end: it listens again (the backend does by itself).
    ev({ kind: 'convSpoken', reading: 1, error: null });
    expect(conversation.phase).toBe('listening');
    // Read once only.
    conversation.observe(a, items);
    expect(said()).toHaveLength(1);
  });

  it('says the answer is in the conversation when the agent wrote no passage', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: 'Bonjour', error: null });
    await tick();
    conversation.observe(a, [
      { kind: 'text', id: 'm', text: 'Bonjour !', streaming: false },
      { kind: 'turn', id: 't', ts: 2, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null },
    ]);
    expect(said()).toEqual(['C’est fait. La réponse est dans la conversation.']);
  });

  it('speaking over the reading cuts it: what is said next is heard', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: 'Résume', error: null });
    await tick();
    conversation.observe(a, [
      { kind: 'text', id: 'm', text: '…', spoken: 'Un long résumé.', streaming: false },
      { kind: 'turn', id: 't', ts: 2, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null },
    ]);
    await tick();
    ev({ kind: 'convBargeIn', reading: 1 });
    expect(conversation.phase).toBe('hearing');
    // The end of the reading cut off never comes; if it did, it would not count.
    ev({ kind: 'convSpoken', reading: 1, error: null });
    expect(conversation.phase).toBe('hearing');
    ev({ kind: 'convHeard', text: 'Non, plutôt la page d’accueil', error: null });
    await tick();
    expect(backend.called('conversation_send').map((c) => c.args.text)).toEqual(['Résume', 'Non, plutôt la page d’accueil']);
  });

  it('nothing understood: it listens again without sending anything', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: '  ', error: null });
    await tick();
    expect(conversation.phase).toBe('listening');
    expect(backend.called('conversation_send')).toHaveLength(0);
    expect(backend.called('conversation_listen')).toHaveLength(1);
  });

  it('reads a permission and a spoken « oui » allows it', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: 'Supprime le build', error: null });
    await tick();
    const perm: PermissionItem = {
      kind: 'permission',
      id: 'p1',
      toolUseId: 'tu',
      toolName: 'Bash',
      input: { command: 'rm -rf build' },
      canAlways: true,
      defaultNo: false,
      decision: null,
      ts: 3,
      title: null,
    };
    conversation.observe({ ...a, pending: ['p1'] }, [perm]);
    expect(conversation.phase).toBe('question');
    expect(said()[0]).toBe('Alice demande la permission : Bash rm -rf build. Tu autorises ?');
    ev({ kind: 'convSpoken', reading: 1, error: null });
    expect(conversation.phase).toBe('question');
    ev({ kind: 'convHeard', text: 'Oui, vas-y.', error: null });
    await tick();
    expect(backend.called('answer_permission')[0].args).toMatchObject({ id: 'a1', requestId: 'p1', decision: 'allow' });
    expect(conversation.phase).toBe('working');
  });

  it('reads a question and the option said answers it', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: 'Crée la base', error: null });
    await tick();
    const q: QuestionItem = {
      kind: 'question',
      id: 'q1',
      toolUseId: 'tu',
      questions: [{ question: 'Quelle base de données ?', options: [{ label: 'SQLite' }, { label: 'Postgres' }] }],
      answers: null,
      ts: 3,
    } as QuestionItem;
    conversation.observe({ ...a, pending: ['q1'] }, [q]);
    expect(said()[0]).toBe('Quelle base de données ? Les choix sont : SQLite ou Postgres.');
    ev({ kind: 'convSpoken', reading: 1, error: null });
    ev({ kind: 'convHeard', text: 'La deuxième.', error: null });
    await tick();
    expect(backend.called('answer_question')[0].args).toMatchObject({ answers: { 'Quelle base de données ?': 'Postgres' } });
  });

  it('an answer it does not understand puts the conversation on pause, and says so', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: 'Crée la base', error: null });
    await tick();
    const q = {
      kind: 'question',
      id: 'q2',
      toolUseId: 'tu',
      questions: [{ question: 'Quelle base ?', options: [{ label: 'SQLite' }, { label: 'Postgres' }] }],
      answers: null,
      ts: 3,
    } as QuestionItem;
    conversation.observe({ ...a, pending: ['q2'] }, [q]);
    ev({ kind: 'convSpoken', reading: 1, error: null });
    ev({ kind: 'convHeard', text: 'Je réfléchis encore', error: null });
    await tick();
    expect(said()[1]).toBe('Je n’ai pas compris ta réponse. La conversation est en pause : réponds dans la fenêtre.');
    ev({ kind: 'convSpoken', reading: 2, error: null });
    expect(conversation.phase).toBe('paused');
    expect(backend.called('conversation_hold').length).toBeGreaterThan(0);
    expect(backend.called('answer_question')).toHaveLength(0);
    // « Reprendre »: it listens again.
    conversation.resume();
    expect(conversation.phase).toBe('listening');
  });

  it('a question of several choices at once is not answered aloud: on pause at once', async () => {
    await startTalking();
    ev({ kind: 'convHeard', text: 'Configure', error: null });
    await tick();
    const q = {
      kind: 'question',
      id: 'q3',
      toolUseId: 'tu',
      questions: [{ question: 'Lesquels ?', multiSelect: true, options: [{ label: 'A' }, { label: 'B' }] }],
      answers: null,
      ts: 3,
    } as QuestionItem;
    conversation.observe({ ...a, pending: ['q3'] }, [q]);
    expect(said()[0]).toBe('Cette question attend une réponse dans la fenêtre. La conversation est en pause.');
  });

  it('asks for the model, then for the voice, before it listens; « Arrêter » closes the microphone', async () => {
    let step = 0;
    backend = fakeBackend({
      conversation_start: () =>
        [
          { kind: 'needsVoice', voice: 'fr_FR-siwis-medium', size: 63_206_169 },
          { kind: 'listening', session: SESSION },
        ][step++],
      speech_download: () => null,
      get_conversation: () => [],
    });
    await conversation.start('a1');
    expect(conversation.phase).toBe('offer');
    expect(conversation.offer).toEqual({ kind: 'voice', id: 'fr_FR-siwis-medium', size: 63_206_169 });
    await conversation.download();
    expect(backend.called('speech_download')[0].args).toEqual({ id: 'fr_FR-siwis-medium' });
    expect(conversation.phase).toBe('listening');
    conversation.stop();
    expect(conversation.phase).toBe('idle');
    expect(backend.called('conversation_stop')).toHaveLength(1);
  });

  it('a dictation under way is called off by a conversation', async () => {
    dictation.phase = 'listening';
    await startTalking();
    expect(dictation.phase).toBe('idle');
  });

  it('keeps the transcript of the turn read for the right agent only', async () => {
    await startTalking();
    conversationOf('a1');
    ev({ kind: 'convHeard', text: 'Bonjour', error: null });
    await tick();
    conversation.observe(agent({ id: 'other' }), [
      { kind: 'turn', id: 't', ts: 2, durationMs: 1, cost: 0, tokens: 0, isError: false, interrupted: false, error: null },
    ]);
    expect(said()).toEqual([]);
  });
});
