// What a harness can do, as it declares it (`EngineCaps`, docs/ENGINES.md): the window shows a function from these,
// never from the name of the agent's harness. A function its harness lacks is hidden, not greyed out.

import { app } from './state.svelte';
import type { EngineCaps, EngineDecl, EngineId } from './types';

/** The flags of `EngineCaps` that say yes or no. */
type Flag = { [K in keyof EngineCaps]: EngineCaps[K] extends boolean ? K : never }[keyof EngineCaps];

/**
 * What `engine` declares, null for one the backend does not know (none of its functions shown). No harness yet (null):
 * the default one, which the backend lists first.
 */
export function engineOf(engine: EngineId | null | undefined): EngineDecl | null {
  return (engine ? app.engines.find((e) => e.id === engine) : app.engines[0]) ?? null;
}

/** The capabilities of `engine` (null: the default harness's). */
export function capsOf(engine: EngineId | null | undefined): EngineCaps | null {
  return engineOf(engine)?.caps ?? null;
}

/** Whether the harness of `who` (an agent, or anything that runs on one) has the capability `flag`. */
export function can(who: { engine: EngineId | null | undefined }, flag: Flag): boolean {
  return capsOf(who.engine)?.[flag] === true;
}

/** Whether the harness of `who` copies a conversation (« Dupliquer la conversation »). */
export function canFork(who: { engine: EngineId | null | undefined }): boolean {
  const fork = capsOf(who.engine)?.fork;
  return !!fork && fork !== 'none';
}

/** Whether the harness of `who` tells what a turn costs, exactly or estimated (none: no cost shown). */
export function showsCost(who: { engine: EngineId | null | undefined }): boolean {
  const cost = capsOf(who.engine)?.cost;
  return !!cost && cost !== 'none';
}

/** The modes the harness of `who` takes, among `all` (in their order). */
export function modesOf<T extends { value: string }>(who: { engine: EngineId | null | undefined }, all: T[]): T[] {
  const ids = new Set(capsOf(who.engine)?.modes.map((m) => m.id) ?? []);
  return all.filter((m) => ids.has(m.value));
}

/** Whether any harness Escouade knows has the capability `flag` (for a setting of them all). */
export function anyCan(flag: Flag): boolean {
  return app.engines.some((e) => e.caps[flag]);
}

/** The harnesses offered (menus « Harness », brand): those declared whose program is found, in the backend's order. */
export function offered(): EngineDecl[] {
  return app.engines.filter((e) => app.enginesFound.includes(e.id));
}

/** Whether there is a harness to choose: the menus « Harness » show from two harnesses found on. */
export function choosesEngine(): boolean {
  return offered().length > 1;
}

/** The harnesses offered, as the options of a menu « Harness »; `current` stays listed even if it is not found any more. */
export function engineOptions(current?: EngineId | null): { value: EngineId; label: string }[] {
  const list = offered();
  const kept = current && !list.some((e) => e.id === current) ? app.engines.filter((e) => e.id === current) : [];
  return [...list, ...kept].map((e) => ({ value: e.id, label: e.name }));
}

/** The name of a harness as the interface says it (its id when the backend does not know it). */
export function engineName(engine: EngineId | null | undefined): string {
  return engineOf(engine)?.name ?? engine ?? '';
}

/** The harnesses the agents run on (archived ones aside). */
export function enginesInUse(): Set<EngineId> {
  return new Set(
    Object.values(app.agents)
      .filter((a) => !a.archived)
      .map((a) => a.engine ?? 'claude'),
  );
}

/** Whether the brand of an agent's harness shows (its card, the sidebar, the overview, its header): once agents run on two. */
export function showsMark(): boolean {
  return enginesInUse().size > 1;
}

/** The models of the composer's menu for the harness of `who` (none for a harness the backend does not know). */
export function modelsOf(who: { engine: EngineId | null | undefined }): { id: string; label: string }[] {
  return engineOf(who.engine)?.models ?? [];
}

/** The efforts of the harness of `who`, among `all` (in their order): none when it takes none. */
export function effortsOf<T extends { value: string }>(who: { engine: EngineId | null | undefined }, all: T[]): T[] {
  const decl = engineOf(who.engine);
  if (!decl?.caps.effort) return [];
  return all.filter((e) => decl.efforts.includes(e.value));
}

/**
 * Whether `model` takes an effort or the mode `auto` on the harness of `who`, as its declaration says: by its id, else by
 * the declared model its full id holds (`claude-haiku-4-5` is Haiku). A model it does not declare takes them.
 */
export function modelTakes(who: { engine: EngineId | null | undefined }, model: string, what: 'effort' | 'auto'): boolean {
  const m = model.toLowerCase();
  const models = engineOf(who.engine)?.models ?? [];
  const decl = models.find((x) => x.id === m) ?? models.find((x) => m.includes(x.id));
  return decl ? decl[what] : true;
}
