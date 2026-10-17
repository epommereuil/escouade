// The voice conversation (ESC-97), for the whole window: one at a time, with the agent of the composer it was started
// from. The backend keeps the microphone open, finds the end of a sentence by its silence, transcribes it, reads aloud
// and hears a barge-in (`voice::conversation`); this leads it: what is heard goes to the agent, the passage the agent
// wrote to be read is read once its turn is over, then it listens again. A question or a permission of the agent is
// read, and a spoken answer answers it; one it cannot take puts the conversation on pause, and says so.

import {
  answerableByVoice,
  listed,
  optionAnswer,
  permissionAnswer,
  permissionWhat,
  turnOver,
  turnsIn,
  type AnswerWords,
} from './conversation';
import { conversationOf } from './conversations.svelte';
import { dictation } from './dictation.svelte';
import { t } from './i18n';
import { api } from './ipc';
import { app } from './state.svelte';
import type { Agent, ConvItem, PermissionItem, QuestionItem, VoiceEvent } from './types';

export type ConvPhase =
  'idle' | 'starting' | 'offer' | 'downloading' | 'listening' | 'hearing' | 'transcribing' | 'working' | 'speaking' | 'question' | 'paused';

/** What it does once a reading is over. */
type After = 'listen' | 'pause' | 'answer';

class VoiceConversation {
  phase = $state<ConvPhase>('idle');
  /** The agent it talks with. */
  agentId = $state<string | null>(null);
  level = $state(0);
  /** What the user said last, and what was read last. */
  heard = $state('');
  said = $state('');
  /** What is to be downloaded before it can start. */
  offer = $state<{ kind: 'model' | 'voice'; id: string; size: number } | null>(null);
  progress = $state<{ id: string; done: number; total: number } | null>(null);
  /** Every voice being downloaded, how far: Réglages › Voix shows them. */
  voiceDownloads = $state<Record<string, { done: number; total: number }>>({});
  private session: number | null = null;
  private reading: number | null = null;
  private after: After = 'listen';
  /** The turns of the agent's conversation when the last sentence was sent: one more is its answer. */
  private turns: number | null = null;
  /** The question or permission read aloud, waiting for a spoken answer. */
  private asking: QuestionItem | PermissionItem | null = null;
  /** The ones already read: each is read once. */
  private asked = new Set<string>();
  /** Readings asked so far: the number of an older one, answered late, is not taken for the last one's. */
  private says = 0;

  get active() {
    return this.phase !== 'idle';
  }

  /** « Conversation » in the composer of `agent`. */
  async start(agentId: string) {
    if (this.phase !== 'idle' && this.phase !== 'offer') return;
    if (dictation.phase !== 'idle') dictation.cancel();
    this.phase = 'starting';
    this.agentId = agentId;
    this.offer = null;
    try {
      const r = await api.conversationStart();
      if (this.phase !== 'starting' || this.agentId !== agentId) {
        if (r.kind === 'listening') void api.conversationStop();
        return;
      }
      if (r.kind === 'needsModel') {
        this.offer = { kind: 'model', id: r.model, size: r.size };
        this.phase = 'offer';
      } else if (r.kind === 'needsVoice') {
        this.offer = { kind: 'voice', id: r.voice, size: r.size };
        this.phase = 'offer';
      } else if (r.kind === 'unavailable') {
        app.toast(t('voice.conversation.unavailable'), 'error');
        this.reset();
      } else {
        this.session = r.session;
        this.phase = 'listening';
      }
    } catch (e) {
      this.reset();
      app.toast(String(e), 'error');
    }
  }

  /** « Télécharger » of the offer: the model or the voice comes, then the conversation starts. */
  async download() {
    const offer = this.offer;
    const agentId = this.agentId;
    if (!offer || !agentId || this.phase !== 'offer') return;
    this.phase = 'downloading';
    this.progress = { id: offer.id, done: 0, total: offer.size };
    try {
      if (offer.kind === 'model') await api.voiceDownload(offer.id);
      else await api.speechDownload(offer.id);
      if (this.phase !== 'downloading') return;
      this.progress = null;
      this.phase = 'idle';
      await this.start(agentId);
    } catch (e) {
      if (this.phase === 'downloading') {
        app.toast(t('voice.downloadFailed', { error: String(e) }), 'error');
        this.reset();
      }
    }
  }

  /** « Arrêter », Escape, the agent's composer gone. */
  stop() {
    if (this.phase === 'idle') return;
    if (this.phase === 'downloading' && this.offer) {
      if (this.offer.kind === 'model') void api.voiceDownloadCancel(this.offer.id);
      else void api.speechDownloadCancel(this.offer.id);
    }
    void api.conversationStop().catch(() => {});
    this.reset();
  }

  /** « Reprendre » after a pause: it listens again (the agent's question, if still open, is answered in the window). */
  resume() {
    if (this.phase !== 'paused' || this.session === null) return;
    this.asking = null;
    this.phase = 'listening';
    void api.conversationListen(this.session);
  }

  /** What the backend says. */
  take(e: VoiceEvent) {
    if (e.kind === 'download' || e.kind === 'speechDownload') {
      const id = e.kind === 'download' ? e.model : e.voice;
      if (e.kind === 'speechDownload') this.voiceDownloads[id] = { done: e.done, total: e.total };
      if (this.progress?.id === id) this.progress = { id, done: e.done, total: e.total };
      return;
    }
    if (!('session' in e) || e.session !== this.session || this.session === null) return;
    const session = this.session;
    switch (e.kind) {
      case 'convLevel':
        this.level = e.level;
        break;
      case 'convSpeech':
        if (this.phase === 'listening' || this.phase === 'question') this.phase = 'hearing';
        break;
      case 'convTranscribing':
        this.phase = 'transcribing';
        break;
      case 'convHeard':
        if (e.error) app.toast(e.error, 'error');
        void this.heardSaid(e.text, session);
        break;
      case 'convBargeIn':
        if (this.ours(e.reading)) {
          this.reading = null;
          this.phase = 'hearing';
        }
        break;
      case 'convSpoken':
        if (!this.ours(e.reading)) break;
        this.reading = null;
        if (e.error) app.toast(t('voice.speech.previewFailed', { error: e.error }), 'error');
        if (this.after === 'pause') {
          this.phase = 'paused';
          void api.conversationHold(session);
        } else {
          // The backend listens again by itself.
          this.phase = this.after === 'answer' ? 'question' : 'listening';
        }
        break;
      case 'convEnded':
        if (e.error) app.toast(e.error, 'error');
        this.reset();
        break;
    }
  }

  /** Whether `reading` is the one under way: its number, or any while its number is not known yet (one at a time). */
  private ours(reading: number) {
    return this.reading !== null && (this.reading === reading || this.reading === -1);
  }

  /** A sentence heard: an answer to what the agent asks, or a message for it. */
  private async heardSaid(text: string, session: number) {
    const agentId = this.agentId;
    if (!agentId) return;
    if (!text.trim()) {
      // Nothing understood: it listens again, waiting for the answer still if one was asked.
      this.phase = this.asking ? 'question' : 'listening';
      void api.conversationListen(session);
      return;
    }
    this.heard = text;
    if (this.asking) return this.answer(text, session);
    this.turns = turnsIn(conversationOf(agentId).items);
    this.phase = 'working';
    try {
      await api.conversationSend(agentId, text);
    } catch (e) {
      app.toast(t('voice.conversation.sendFailed', { error: String(e) }), 'error');
      this.turns = null;
      if (this.session === session) {
        this.phase = 'listening';
        void api.conversationListen(session);
      }
    }
  }

  private words(): AnswerWords {
    return {
      yes: t('voice.conversation.words.yes'),
      no: t('voice.conversation.words.no'),
      always: t('voice.conversation.words.always'),
      ordinals: [1, 2, 3, 4].map((n) => t(`voice.conversation.words.ordinals.o${n}` as 'voice.conversation.words.ordinals.o1')),
    };
  }

  /** A spoken answer to the question or the permission read: given, or the conversation paused. */
  private async answer(text: string, session: number) {
    const item = this.asking!;
    const agentId = this.agentId!;
    this.asking = null;
    // Held before the answer goes: the agent may answer back at once, and its passage be read before a hold sent after.
    void api.conversationHold(session);
    try {
      if (item.kind === 'permission') {
        const r = permissionAnswer(text, this.words(), item.canAlways);
        if (!r) return this.pause('pausedQuestion');
        this.phase = 'working';
        await api.answerPermission(agentId, item.id, r, r === 'deny' ? text : undefined);
      } else {
        const q = item.questions[0];
        const label = optionAnswer(
          text,
          q.options.map((o) => o.label),
          this.words(),
        );
        if (!label) return this.pause('pausedQuestion');
        this.phase = 'working';
        await api.answerQuestion(agentId, item.id, { [q.question]: label });
      }
    } catch (e) {
      app.toast(String(e), 'error');
      this.pause('pausedQuestion');
    }
  }

  /** Says why, then holds until « Reprendre ». */
  private pause(why: 'pausedQuestion' | 'pausedMulti') {
    this.say(t(`voice.conversation.say.${why}`), 'pause');
  }

  private say(text: string, after: After) {
    const session = this.session;
    if (session === null) return;
    this.after = after;
    this.said = text;
    this.phase = after === 'answer' ? 'question' : 'speaking';
    // While the reading starts, its number is not known: a barge-in or an end of it is not taken for another one.
    this.reading = -1;
    const mine = ++this.says;
    api
      .conversationSay(session, text)
      .then((n) => {
        if (this.says === mine && this.reading === -1 && this.session === session) this.reading = n;
      })
      .catch((e) => {
        app.toast(String(e), 'error');
        if (this.session === session) {
          this.phase = 'listening';
          void api.conversationListen(session);
        }
      });
  }

  /**
   * The agent and its conversation as they change (the composer's effect): its question or permission is read, the
   * end of its turn has its passage read.
   */
  observe(agent: Agent, items: ConvItem[]) {
    if (agent.id !== this.agentId || this.session === null) return;
    if (this.phase !== 'working' && this.phase !== 'question' && this.phase !== 'paused') return;
    const pending = agent.pending.length ? items.find((i) => i.id === agent.pending[0]) : undefined;
    if (this.phase === 'working' && pending && (pending.kind === 'question' || pending.kind === 'permission')) {
      if (this.asked.has(pending.id)) return;
      this.asked.add(pending.id);
      if (pending.kind === 'permission') {
        this.asking = pending;
        return this.say(t('voice.conversation.say.permission', { name: agent.name, what: permissionWhat(pending) }), 'answer');
      }
      if (!answerableByVoice(pending)) return this.pause('pausedMulti');
      const q = pending.questions[0];
      this.asking = pending;
      return this.say(
        t('voice.conversation.say.question', {
          question: q.question,
          options: listed(
            q.options.map((o) => o.label),
            t('voice.conversation.say.or'),
          ),
        }),
        'answer',
      );
    }
    // Answered in the window meanwhile: back to waiting for the agent.
    if ((this.phase === 'question' || this.phase === 'paused') && this.asking && !agent.pending.includes(this.asking.id)) {
      this.asking = null;
      if (this.reading === null) {
        this.phase = 'working';
        void api.conversationHold(this.session);
      }
      return;
    }
    if (this.phase !== 'working' || this.turns === null) return;
    const over = turnOver(items, this.turns);
    if (!over) return;
    this.turns = null;
    const text =
      over.spoken ??
      (over.turn.isError && !over.turn.interrupted ? t('voice.conversation.say.error') : t('voice.conversation.say.noPassage'));
    this.say(text, 'listen');
  }

  private reset() {
    this.phase = 'idle';
    this.agentId = null;
    this.session = null;
    this.reading = null;
    this.after = 'listen';
    this.turns = null;
    this.asking = null;
    this.offer = null;
    this.progress = null;
    this.level = 0;
    this.heard = '';
    this.said = '';
  }

  /** Back to rest (the tests). */
  clear() {
    this.reset();
    this.asked.clear();
  }
}

export const conversation = new VoiceConversation();
