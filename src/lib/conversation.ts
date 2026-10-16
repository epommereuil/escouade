// What the voice conversation does with words, apart from the window (ESC-97): a spoken answer to a permission or to a
// question understood, and what the agent asks put into a sentence to be read aloud.

import type { ConvItem, PermissionItem, QuestionItem, TextItem, TurnItem } from './types';

/** Lower case, no accents, the typographic apostrophe as the plain one, words separated by single spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

/** Whether `text` holds one of the words or phrases of `alternatives` (« oui|vas-y|bien sûr »), whole. */
export function says(text: string, alternatives: string): boolean {
  const t = ` ${normalize(text)} `;
  return alternatives
    .split('|')
    .map(normalize)
    .filter(Boolean)
    .some((w) => t.includes(` ${w} `));
}

export interface AnswerWords {
  yes: string;
  no: string;
  always: string;
  /** For each rank, its words: « premier|première|un|1 ». */
  ordinals: string[];
}

/** A spoken answer to a permission: allowed (once or always), denied, or not understood (null, also when it says both). */
export function permissionAnswer(heard: string, words: AnswerWords, canAlways: boolean): 'allow' | 'always' | 'deny' | null {
  const yes = says(heard, words.yes);
  const no = says(heard, words.no);
  const always = says(heard, words.always);
  if (no && (yes || always)) return null;
  if (no) return 'deny';
  if (always) return canAlways ? 'always' : 'allow';
  return yes ? 'allow' : null;
}

/** A question read aloud may be answered aloud: one question, one choice among its options. */
export function answerableByVoice(item: QuestionItem): boolean {
  return item.questions.length === 1 && !item.questions[0].multiSelect && item.questions[0].options.length > 0;
}

/**
 * The option a spoken answer names: by its label (said whole, or the answer being part of it), or by its rank (« la
 * deuxième »). Null when none, or more than one, fits.
 */
export function optionAnswer(heard: string, options: string[], words: AnswerWords): string | null {
  const h = normalize(heard);
  if (!h) return null;
  const named = options.filter((o) => {
    const n = normalize(o);
    return n && (` ${h} `.includes(` ${n} `) || (h.length >= 3 && ` ${n} `.includes(` ${h} `)));
  });
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    // The longest name said whole wins (« Postgres » and « Postgres avec Docker »).
    const whole = named.filter((o) => ` ${h} `.includes(` ${normalize(o)} `)).sort((a, b) => b.length - a.length);
    if (whole.length && (whole.length === 1 || whole[0].length > whole[1].length)) return whole[0];
    return null;
  }
  const ranks = words.ordinals.map((w, i) => (says(heard, w) ? i : -1)).filter((i) => i >= 0 && i < options.length);
  return ranks.length === 1 ? options[ranks[0]] : null;
}

/** The options of a question as said: « A, B ou C ». */
export function listed(options: string[], or: string): string {
  if (options.length < 2) return options.join('');
  return `${options.slice(0, -1).join(', ')} ${or} ${options[options.length - 1]}`;
}

/** What a permission is about, in a few words: its title, else its description, else the tool and its command. */
export function permissionWhat(item: PermissionItem): string {
  if (item.title) return item.title;
  if (item.description) return item.description;
  const command = typeof item.input?.command === 'string' ? item.input.command : '';
  return command ? `${item.toolName} ${command.slice(0, 80)}` : item.toolName;
}

/** How many turns the conversation has ended: one more is the end of the turn of what was said. */
export function turnsIn(items: ConvItem[]): number {
  return items.filter((i) => i.kind === 'turn').length;
}

/**
 * The end of the turn after the first `turns`: the turn, and the passage to be read the agent wrote in it (the last
 * one), if any. Null while it goes on.
 */
export function turnOver(items: ConvItem[], turns: number): { turn: TurnItem; spoken: string | null } | null {
  let seen = 0;
  let from = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind !== 'turn') continue;
    seen++;
    if (seen === turns) from = i + 1;
    if (seen === turns + 1) {
      const texts = items.slice(from, i).filter((x): x is TextItem => x.kind === 'text' && !x.parent && !!x.spoken);
      return { turn: it, spoken: texts.at(-1)?.spoken ?? null };
    }
  }
  return null;
}

/** A text being written: what is shown of it, its passage to be read cut off (it shows apart once written). */
export function withoutPassage(text: string): string {
  const i = text.indexOf('<spoken>');
  return i < 0 ? text : text.slice(0, i).trimEnd();
}

/** A message said in a conversation, as sent (its instruction at its end), without the instruction. */
export function withoutInstruction(text: string): { text: string; spoken: boolean } {
  const i = text.lastIndexOf('<escouade-voice>');
  if (i < 0 || !text.trimEnd().endsWith('</escouade-voice>')) return { text, spoken: false };
  return { text: text.slice(0, i).trimEnd(), spoken: true };
}
