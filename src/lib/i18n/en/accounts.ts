import { defineZone } from '../types';

// The accounts of every harness.
export default defineZone('accounts', {
  principal: 'Main',

  tab: {
    list: 'Accounts',
    group: '{harness} accounts',
    order: 'New agents start on the first active account of their harness under the pause threshold, in this order.',
    name: 'Name',
    folder: 'Folder',
    executable: 'Executable',
    executableDefault: 'The one in the settings',
    active: 'Active',
    lastActive: 'Each harness needs at least one active account.',
    up: 'Move {name} up',
    down: 'Move {name} down',
    signIn: 'Sign in…',
    signInAgain: 'Sign in again…',
    remove: 'Remove',
    add: 'Add an account…',
    none: 'No account',
    noneHint: 'No agent or ticket starts on {harness} until an account is added.',
    addTo: 'Add a {harness} account…',
    machine: 'This machine’s account',
    defaults: 'New agents',
    defaultModel: 'Model',
    defaultEffort: 'Effort',
    defaultMode: 'Mode',
    harnessDefault: 'The harness’s',
    harnessDefaultNamed: 'The harness’s ({name})',
    reserved: 'Reserved to projects',
    reservedAll: 'Every project',
    budget: 'Daily budget ($)',
    budgetNone: 'None',
    budgetHint:
      'Once reached, the autopilot pauses until midnight, as when a quota is used up. Empty: no budget. A local model costs nothing.',
    budgetInvalid: 'The daily budget is an amount in dollars, positive.',
    closedProject: '{name} (closed)',
    /** `{names}`: the projects, each quoted (`quoted`) and listed as a sentence does. */
    noAccount: {
      one: 'No active account of its default harness serves {names}: its agents and tickets won’t start.',
      other: 'No active account of their default harness serves {names}: their agents and tickets won’t start.',
    },
    quoted: '“{name}”',
    reservedHint: 'Tick projects to keep this account to them alone (a client’s projects, say): the others never start on it.',
    stillUsed: { one: 'The account is still used by {count} agent.', other: 'The account is still used by {count} agents.' },
    state: {
      checking: 'Checking…',
      connected: 'Signed in · {email}',
      connectedNoEmail: 'Signed in',
      notConnected: 'Not signed in',
      principalNotConnected: 'Not signed in with a claude.ai account (API key?)',
      inactive: 'Inactive',
    },
    removeMachineConfirm: {
      title: 'Remove this machine’s account “{name}”?',
      body: 'New agents will no longer start on it. {harness} stays signed in on this machine: removing it signs nothing out ({path}).',
      confirm: 'Remove',
    },
    removeConfirm: {
      title: 'Remove the account “{name}”?',
      body: 'New agents will no longer start on it. Its folder stays on the disk, with its sign-in and its conversations: {path}',
      confirm: 'Remove',
    },
  },

  modal: {
    addTitle: 'Add a {harness} account',
    harness: 'Harness',
    kind: 'Account',
    machine: 'This machine’s account',
    machineConnected: '{harness} is signed in on this machine · {email}',
    machineConnectedNoEmail: '{harness} is signed in on this machine',
    machineFound: '{harness} is installed on this machine',
    machineNotConnected: '{harness} isn’t signed in on this machine',
    machineAdded: 'Added already',
    machineChecking: 'Checking…',
    machineHint: 'Its usual folder, as it is: its settings, its sign-in and its conversations ({path}).',
    newAccount: 'A new account',
    newHint: 'A folder of its own under ~/.escouade, and its own sign-in.',
    addMachine: 'Add this account',
    signInTitle: 'Sign in to the account “{name}”',
    name: 'Name',
    namePlaceholder: 'Pro, Team…',
    share: 'Share with {name}',
    shareMachine: 'Share with this machine’s account',
    machineName: 'This machine’s account',
    files: 'Files',
    folders: 'Folders',
    filesCopied: 'copied (linking a file needs administrator rights)',
    mode: 'Sharing',
    link: 'Link (a change applies to both accounts)',
    copy: 'Copy',
    nothingToShare: '{name} has no settings, CLAUDE.md, skills, agents, commands, plugins, hooks or output styles to share.',
    neverShared: 'The sign-in (.credentials.json) and .claude.json are never shared: each account has its own.',
    create: 'Create and sign in',
    signInHint: 'Sign in in the terminal below (use the /login command if Claude Code doesn’t offer it).',
    connected: 'Signed in as {email}',
    connectedNoEmail: 'Signed in',
    ended: '{harness} stopped before signing in.',
    // What a Codex account keeps apart (its folder is a CODEX_HOME).
    codex: {
      nothingToShare: '{name} has no config.toml, AGENTS.md, skills, prompts or rules to share.',
      neverShared: 'The sign-in (auth.json) is never copied: each account has its own (its token changes each time it is renewed).',
      signInHint: 'Sign in in the terminal below: codex login opens your browser on ChatGPT’s sign-in.',
    },
    // What a Copilot CLI account keeps apart (its folder is a COPILOT_HOME).
    copilot: {
      nothingToShare: '{name} has no mcp-config.json, copilot-instructions.md, agents or skills to share.',
      neverShared:
        'The sign-in is never copied: each account signs in with copilot login (its config.json and the system keychain), without the GitHub CLI’s token.',
      signInHint: 'Sign in in the terminal below: copilot login gives a code to enter on github.com/login/device.',
    },
    restart: 'Restart',
    done: 'Done',
  },

  composer: {
    caption: 'Account',
    auto: 'Automatic ({name})',
    autoNone: 'Automatic (no account)',
    autoDetail: 'The project’s, else the first account under the pause threshold.',
    inactive: '{name} (inactive)',
    locked: 'An agent’s account can’t change after its first message (its conversation is filed in that account).',
  },

  project: {
    label: 'Preferred account',
    desc: 'The account this project’s new agents and tickets go to.',
    auto: 'Automatic',
    autoTitle: 'The first active account under the pause threshold, in the order of the accounts',
    inactive: '{name} (inactive)',
  },

  pause: {
    over: { one: 'The {accounts} account is past the threshold.', other: 'The {accounts} accounts are past the threshold.' },
  },

  quota: {
    hours: { label: '{n}h', name: { one: '{count}-hour quota', other: '{count}-hour quota' } },
    days: { label: '{n}d', name: { one: '{count}-day quota', other: '{count}-day quota' } },
    credits: { label: 'credits', name: 'Credits of the month' },
    week: { label: 'W' },
    reset: 'reset {countdown}',
    projected: '→ {pct}',
    projectedCost: '→ {amount}',
    tip: '{pct} · resets on {date} at {time}',
    unavailable: 'Quota unavailable',
    line: '{name}: {tip}',
  },

  panel: {
    open: 'Quota by account (current account: {name})',
    title: 'Accounts quota',
    noQuota: 'No quota: only what its turns cost counts.',
    current: 'current',
    over: 'past the pause threshold',
    today: 'Today: {amount}',
  },

  resume: {
    on: 'Resume on {account}',
    another: 'Resume on another account',
    failed: 'Resuming on {account} failed: {error}.',
    back: 'Go back to {account}',
  },

  quotas: {
    title: 'Quotas',
    projection: 'Quota projection',
    projectionDesc:
      'In the status bar, after each quota, where it will stand at its reset at the current pace (“→ 64%”): green, amber past 80%, red past 100%. For a harness without a quota, the day’s cost projected to midnight, against its budget.',
  },

  engineOrder: {
    label: 'Harness order',
    desc: 'After its default harness, a project goes on to the next ones in this order when its own quota is spent, if they have an active account that serves it.',
    up: 'Move {name} up',
    down: 'Move {name} down',
  },

  switchOnLimit: {
    label: 'Resume a ticket’s agent stopped by the usage limit on another account',
    desc: 'Otherwise it waits for its account to reset',
  },
});
