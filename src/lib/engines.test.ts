import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  anyCan,
  can,
  canFork,
  capsOf,
  choosesEngine,
  effortsOf,
  engineOf,
  engineOptions,
  modelsOf,
  modelTakes,
  modesOf,
  offered,
  showsCost,
  showsMark,
} from './engines';
import { EFFORTS, MODES } from './models';
import { app } from './state.svelte';
import { agent, BARE_ENGINE, CLAUDE_ENGINE, resetApp } from '../test/ipc';

describe('the capabilities of a harness', () => {
  beforeEach(() => {
    resetApp();
    app.engines = [CLAUDE_ENGINE, BARE_ENGINE];
  });

  it('are read from what the harness declares, the default one for what has none yet', () => {
    expect(engineOf('claude')?.name).toBe('Claude Code');
    expect(engineOf(null)?.name).toBe('Claude Code');
    expect(engineOf('codex')?.name).toBe('Harness nu');
    // One the backend does not declare: nothing of it is shown.
    expect(capsOf('cursor')).toBeNull();
    expect(can({ engine: 'cursor' }, 'remoteControl')).toBe(false);
  });

  it('show what Claude Code does today and hide what a bare harness lacks', () => {
    const claude = { engine: 'claude' as const };
    const bare = { engine: 'codex' as const };
    for (const flag of ['terminalView', 'remoteControl', 'backgroundTasks', 'effort', 'images', 'pdf', 'slashCommands'] as const) {
      expect(can(claude, flag)).toBe(true);
      expect(can(bare, flag)).toBe(false);
    }
    expect(canFork(claude)).toBe(true);
    expect(canFork(bare)).toBe(false);
    expect(showsCost(claude)).toBe(true);
    expect(showsCost(bare)).toBe(false);
    expect(modesOf(claude, MODES).map((m) => m.value)).toEqual(['auto', 'default', 'plan', 'acceptEdits', 'bypassPermissions']);
    expect(modesOf(bare, MODES).map((m) => m.value)).toEqual(['default', 'plan']);
  });

  it('tell whether any harness has a function, for a setting of them all', () => {
    expect(anyCan('remoteControl')).toBe(true);
    app.engines = [BARE_ENGINE];
    expect(anyCan('remoteControl')).toBe(false);
  });
});

describe('the harnesses offered (ESC-29)', () => {
  beforeEach(() => {
    resetApp();
    app.engines = [CLAUDE_ENGINE, BARE_ENGINE];
  });

  it('are the harnesses found: a harness that is not found is offered nowhere', () => {
    app.enginesFound = ['claude'];
    expect(offered().map((e) => e.id)).toEqual(['claude']);
    expect(choosesEngine()).toBe(false);
    app.enginesFound = ['claude', 'codex'];
    expect(choosesEngine()).toBe(true);
    expect(engineOptions()).toEqual([
      { value: 'claude', label: 'Claude Code' },
      { value: 'codex', label: 'Harness nu' },
    ]);
    // The one a ticket or a project has stays listed, though it is not found any more.
    app.enginesFound = ['claude'];
    expect(engineOptions('codex').map((o) => o.value)).toEqual(['claude', 'codex']);
  });

  it('show their brand only once agents run on two of them, archived ones aside', () => {
    resetApp({ agents: [agent({ id: 'a1' }), agent({ id: 'a2' })] });
    expect(showsMark()).toBe(false);
    resetApp({ agents: [agent({ id: 'a1' }), agent({ id: 'a2', engine: 'codex', archived: true })] });
    expect(showsMark()).toBe(false);
    resetApp({ agents: [agent({ id: 'a1' }), agent({ id: 'a2', engine: 'codex' })] });
    expect(showsMark()).toBe(true);
  });

  it('give the composer the models and efforts of the harness, each model with what it takes', () => {
    const claude = { engine: 'claude' as const };
    const bare = { engine: 'codex' as const };
    expect(modelsOf(claude).map((m) => m.id)).toEqual(['fable', 'opus', 'sonnet', 'haiku']);
    expect(modelsOf(bare).map((m) => m.id)).toEqual(['gpt-5.5', 'gpt-5.5-mini']);
    expect(effortsOf(claude, EFFORTS).map((e) => e.value)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(effortsOf(bare, EFFORTS)).toEqual([]);
    // As Claude Code's rule: all but Haiku, its full ids too; a model it does not declare takes them.
    expect(modelTakes(claude, 'opus', 'effort')).toBe(true);
    expect(modelTakes(claude, 'haiku', 'effort')).toBe(false);
    expect(modelTakes(claude, 'claude-haiku-4-5-20251001', 'auto')).toBe(false);
    expect(modelTakes(claude, 'claude-opus-5-5', 'auto')).toBe(true);
    expect(modelTakes(bare, 'gpt-5.5', 'effort')).toBe(false);
  });
});

describe('the window', () => {
  /** Every source file of the window but the tests. */
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
    });
  }

  it('never decides from the name of a harness, only from its capabilities', () => {
    const offenders: string[] = [];
    // `engine === 'claude'`, `.engine !== "codex"`, `engine == 'opencode'`, `case 'copilot':` after a switch on an engine…
    const byName =
      /engine\)?\s*[!=]==?\s*['"](claude|codex|copilot|cursor|opencode)['"]|['"](claude|codex|copilot|cursor|opencode)['"]\s*[!=]==?\s*\S*engine\b|switch\s*\([^)]*engine[^)]*\)/;
    // The search finds what it is for.
    for (const line of ["if (agent.engine === 'claude')", 'a.engine !== "codex"', "'opencode' === t.engine", 'switch (agent.engine) {']) {
      expect(byName.test(line), line).toBe(true);
    }
    expect(byName.test("can(agent, 'remoteControl')")).toBe(false);
    for (const file of sources(join(__dirname, '..'))) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (byName.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
