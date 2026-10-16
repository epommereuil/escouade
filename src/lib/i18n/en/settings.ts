import { defineZone } from '../types';

// The settings window and the settings of a project.
export default defineZone('settings', {
  tabs: {
    app: { label: 'Application', desc: 'Language of the interface and of texts written by Claude' },
    claude: { label: 'Claude Code', desc: 'Executable, model, and default permissions' },
    accounts: { label: 'Claude accounts', desc: 'The accounts agents start on, saved as you change them' },
    notifications: { label: 'Notifications', desc: 'Visual and sound alerts' },
    projects: { label: 'Projects', desc: 'Settings specific to each project' },
    board: { label: 'Kanban', desc: 'Autopilot and approved tickets' },
    integrations: { label: 'Integrations', desc: 'Jira, Trello, GitHub Issues, and Linear' },
    terminals: { label: 'Terminals', desc: 'Shells available in the built-in terminals' },
    network: {
      label: 'Network',
      desc: 'HTTP(S) proxy and TLS certificates for Claude Code, integrations, and updates',
    },
    voice: { label: 'Voice', desc: 'Dictating messages: microphone, transcription model, language and shortcut' },
    about: { label: 'About', desc: 'Version and local data' },
  },

  modal: {
    changed: 'Modified, not saved yet',
    saved: 'Settings saved',
    noProject: 'No project open.',
  },

  problem: {
    projectName: 'The project “{name}” needs a name.',
    command: 'Every launch command in “{name}” needs a name and a command line.',
    worktrees: 'The worktrees folder or a branch prefix of “{name}” isn’t valid.',
  },

  suggest: {
    nothing: 'Claude found no command to run for this project.',
    proposed: {
      one: '1 command suggested: review it before saving.',
      other: '{count} commands suggested: review them before saving.',
    },
    proposedLeftOne: {
      one: '1 command suggested, 1 left out (invisible characters or too long): review it before saving.',
      other: '{count} commands suggested, 1 left out (invisible characters or too long): review them before saving.',
    },
    proposedLeftMany: {
      one: '1 command suggested, {refused} left out (invisible characters or too long): review it before saving.',
      other: '{count} commands suggested, {refused} left out (invisible characters or too long): review them before saving.',
    },
  },

  fields: {
    shell: 'Shell',
    shellNotFound: '{name} (not found)',
    subfolder: 'Subfolder',
    addCommand: '+ Add a command',
  },

  app: {
    language: 'Language',
    uiLanguage: 'Interface language',
    system: 'System ({lang})',
    claudeLanguage: 'Language of texts written by Claude',
    sameAsUi: 'Same as the interface (default)',
    claudeLanguageHelp:
      'Proposed commit messages and pull request descriptions, comments posted to Jira, Trello, GitHub, and Linear, instructions given to agents (by default, the proposed commit message follows the language of the repository’s latest commits).',
    langName: { fr: 'French', en: 'English' },
  },

  claude: {
    executable: 'Executable',
    path: 'Executable path',
    pathHint: 'blank = detect automatically',
    pathFound: 'claude (found in PATH)',
    pathMissing: 'not found — enter the path to claude.exe',
    /** Under the path: where its `claude` is. */
    located: 'Found: {path}',
    locatedWsl: 'Found in WSL ({distro}): {path}',
    nat: 'WSL’s network is NAT: Escouade’s MCP server and the tracking of the Claude Code view can’t reach the app. Switch it to mirrored (networkingMode=mirrored under [wsl2] in %UserProfile%\\.wslconfig), then run wsl --shutdown.',
    notLocated:
      'Not found. Give the path to claude.exe, or to Claude Code installed in WSL: ~/.local/bin/claude, /home/<user>/…, or \\\\wsl.localhost\\<distribution>\\….',
    notLocatedHere: 'Not found. Give the path to claude.',
    newAgents: 'New agents',
    defaultModel: 'Default model',
    defaultEffort: 'Default effort',
    defaultMode: 'Default permission mode',
    processes: 'Processes',
    autoResume: 'Auto-resume after the usage limit',
    autoResumeDesc: '“continue” is sent once the quota has reset',
    idleStop: 'Stop idle Claude processes after',
    idleStopHint: 'minutes, 0 = never',
    idleStopLabel: 'Stop idle Claude processes after (minutes)',
    terminalView: 'Open new agents in Claude Code’s interface',
    terminalViewDesc:
      'A new agent runs in a terminal with Claude Code’s own interface rather than in Escouade’s conversation. Each agent switches views from its header; ticket agents stay in Escouade’s view.',
    todoTools: 'Agents keep a task list',
    todoToolsDesc:
      'Gives agents Claude Code’s task list tool: if they keep a list, Escouade shows their progress in the “Plan” banner (the model does not have to use it). Applies to agents started afterwards.',
    attachments: 'Attachments',
    attachmentsNote:
      'Images, PDFs and text files within their limits go in the message. Any other file, or one too big for the message, is attached by its path: Claude reads it with its tools.',
    attachMax: 'Largest attached file',
    attachMaxHint: 'MB, 0 = no limit',
    attachMaxLabel: 'Largest attached file (MB)',
    attachWarn: 'Warn above',
    attachWarnHint: 'MB, 0 = never',
    attachWarnLabel: 'Warn for an attached file over (MB)',
    attachOrigin: 'Attach the original file',
    attachOriginDesc:
      'A file you drop is attached where it is, without a copy: Claude reads it at its location. When off, Escouade always keeps a copy. Tickets and the Claude Code view always copy.',
    attachBigText: 'Text over 256 KB',
    attachBigTextDesc: 'A text file too big for the message is attached by its path, or refused.',
    attachBigTextPath: 'Attached by its path',
    attachBigTextRefuse: 'Refused',
    attachKeep: 'Purge copies after',
    attachKeepHint: 'days, 0 = as long as their owner exists',
    attachKeepLabel: 'Purge copies after (days)',
    remoteTitle: 'Remote control',
    remoteAll: 'Remote control for all agents',
    remoteAllDesc:
      'Every agent of every project, existing or new (ticket agents included), is reachable from claude.ai and the Claude app. Escouade starts each one’s claude process right away, and it stays running. The session appears on claude.ai as “project · agent” (for a ticket agent, the name comes from the ticket). In Claude Code view, an interface that is already open only picks it up at its next launch. To set an agent apart: right-click, “Turn off remote control”.',
  },

  notifications: {
    notifyFor: 'Notify me about',
    noteMac: 'Off: no system notification or chime for this type; the tab, the card, and the Dock still flag the agent.',
    noteOther: 'Off: no system notification or chime for this type; the tab, the card, and the taskbar still flag the agent.',
    questions: 'Questions and permissions',
    done: 'Finished tasks',
    errors: 'Errors',
    tickets: 'Tickets (ready to review, blocked)',
    channels: 'Channels',
    system: '{os} notifications when the app is not in the foreground',
    systemLabel: 'System notifications',
    sound: 'Sound',
    soundOn: 'Sound on',
    soundOnDesc: 'When Claude asks a question or a turn ends',
    soundTest: 'Test the sound',
    soundTestButton: '▶ Test',
  },

  terminals: {
    paths: 'Paths',
    detected: 'Detected: {list}',
    none: 'none',
    auto: 'blank = auto',
    wsl: 'WSL distribution',
    wslHint: 'blank = default distribution',
  },

  network: {
    proxy: 'Proxy',
    proxyNote:
      'Claude Code processes, quota reads, integrations, and updates all go through the proxy. It applies to agents the next time their process (re)starts.',
    proxyUrl: 'HTTP(S) proxy',
    proxyUrlHint: 'e.g. http://user:password@proxy:3128',
    proxyUrlNone: 'none',
    exclusions: 'Exclusions',
    exclusionsHint: 'NO_PROXY, separated by commas',
    proxyTerminals: 'Also apply the proxy to the built-in terminals',
    certificates: 'Certificates',
    certificatesNote:
      'Integrations, quotas, and updates trust recognized certificates and those installed on this system (usually a corporate proxy’s). Claude Code has its own list.',
    insecureTls: 'Skip TLS certificate verification',
    insecureTlsDesc:
      'For a proxy that decrypts traffic with an unrecognized certificate (the “UnknownIssuer” error). Applies to integrations, quotas, updates, and Claude Code processes (the next time their process starts), along with the commands agents run (npm, node…). Use it only on a network you trust: an intercepted connection, tokens included, would no longer be detected.',
  },

  about: {
    claudeFound: 'Claude Code detected',
    claudeMissing: 'Claude Code not found',
    checking: 'Checking…',
    check: 'Check for updates',
    noUpdate: 'No update available.',
    autoUpdate: 'Install updates automatically',
    autoUpdateDesc: 'Escouade restarts itself when no agent is working and everything is saved.',
    localData: 'Local data',
    telemetry: 'Usage statistics',
    telemetryDesc:
      'The features used, the version of Escouade and the system, under an id drawn at random: nothing that identifies you, nor your projects or your code.',
    telemetryMore: 'In detail',
  },

  project: {
    identity: 'Identity',
    nameLabel: 'Project name',
    colorN: 'Color {n}',
    remoteTitle: 'Remote control',
    remote: 'Remote control for this project’s agents',
    remoteDesc:
      'Every agent of this project, existing or new (ticket agents included), is reachable from claude.ai and the Claude app. Escouade starts each one’s claude process right away, and it stays running. The session appears on claude.ai as “project · agent” (for a ticket agent, the name comes from the ticket). In Claude Code view, an interface that is already open only picks it up at its next launch. To set an agent apart: right-click, “Turn off remote control”.',
    remoteGlobal: 'On for all projects in Settings › Claude Code',
    worktreePerAgent: 'One worktree per agent',
    worktreePerAgentDesc: 'Keeps each new agent’s changes in its own branch.',
    worktreeDir: 'Worktrees folder',
    worktreeDirDesc:
      'Relative to the project’s folder (../app-worktrees, .worktrees), to your home folder (~/worktrees/app), or full. Empty: .claude/worktrees, as claude --worktree does. Worktrees made already stay where they are; out of the project, the Claude Code view first asks you to trust each of them.',
    worktreeDirAt: 'The next one: {path}',
    worktreeDirItself: 'This is the project’s own folder.',
    worktreeDirContains: 'This folder holds the project’s: pick one beside it (../app-worktrees) or in it (.worktrees).',
    worktreeDirGit: 'This folder is in a .git folder.',
    worktreeDirPartial: 'Write a path relative to the project’s folder, or a full one (C:\\…).',
    agentPrefix: 'Agents’ branch prefix',
    agentPrefixDesc: 'A new agent’s branch: {prefix}<name>. Empty: its name alone.',
    ticketPrefix: 'Tickets’ branch prefix',
    ticketPrefixDesc: 'A ticket’s branch, the one its PR comes from: {prefix}<key>. Empty: its key alone.',
    prefixInvalid:
      'No branch name starts like this: no spaces, “..”, “~”, “^”, “:”, “?”, “*”, “[”, “\\” or “{at}”, no “-” or “/” at the start, no “//”, no part starting with “.” or ending with “.lock”.',
    nextName: '<name>',
    copy: 'Files copied into worktrees',
    copyDesc: 'Only files git ignores, never committed. One pattern per line: .env* at the root, **/.env* everywhere.',
    commit: 'Commit',
    commitDesc: 'Direct: Escouade suggests a message, you review it, and you commit yourself.',
    commitModes: {
      agent: 'Written by the agent',
      direct: 'Direct, with a suggested message',
    },
    worktrees: 'Worktrees',
    worktreesNote:
      'Available variables: ESCOUADE_PROJECT_DIR (the project), ESCOUADE_WORKTREE_DIR, ESCOUADE_BRANCH, and the ports reserved for a ticket (ESCOUADE_PORT_BASE, ESCOUADE_PORT_END). A failure is reported in the agent’s conversation.',
    fill: 'Fill in automatically',
    fillButton: '✦ Fill in automatically',
    filling: 'Claude is reading the project…',
    fillWorktreesDesc:
      'Claude reads the project (manifests, lockfiles, README…) without changing anything and suggests the commands. Review them before saving.',
    fillLaunchDesc:
      'Claude reads the project (manifests, scripts, docker-compose, README…) without changing anything and suggests the commands to run. Review them before saving.',
    proposedWorktrees: 'Suggested worktree commands',
    proposedWorktreesNote:
      'Claude’s suggestion: read each command in full. They replace both lists and, once saved, run on their own: the setup when each new worktree opens, the teardown before it is removed.',
    proposedLaunch: 'Suggested launch commands',
    proposedLaunchNote: 'Claude’s suggestion: read each command in full. They replace the ones in the list.',
    ignore: 'Ignore',
    replace: 'Replace the commands',
    noCommands: 'No commands.',
    worktreeRoot: 'the worktree root',
    projectFolder: 'the project folder',
    setupTitle: 'When a worktree opens',
    setupDesc: 'In order, before its agent’s first message: dependencies, generated code… Messages wait for them to finish.',
    teardownTitle: 'Before a worktree is removed',
    teardownDesc: 'What the setup created outside the worktree (database, containers…); often nothing.',
    launch: 'Launch',
    launchNote: 'Each command runs in its own terminal, read-only. Start them from the “Launch” section of the sidebar.',
    commandN: 'Command {n}',
    namePlaceholder: 'e.g. Front',
    commandPlaceholder: 'e.g. npm run dev',
    subfolderHint: '(blank = project folder)',
    subfolderPlaceholder: 'e.g. apps/web',
    noCommandsYet: 'No commands yet.',
    danger: 'Danger zone',
    close: 'Close the project',
    closeDesc:
      'The project leaves the app: its agents, terminals and launches stop. Its history (conversations, tickets, settings) is kept: adding this folder again brings it back. The files and worktrees on disk are not touched.',
    closeButton: 'Close the project…',
  },

  closed: {
    title: 'Closed projects',
    note: 'Their history is kept: adding a project in their folder brings it back.',
    detail: '{size} · last activity on {date}',
    erase: 'Erase history…',
    eraseTitle: 'Erase the history of “{name}”?',
    eraseBody: 'Its conversations, tickets, and settings are erased for good. The files and worktrees on disk are not touched.',
    eraseConfirm: 'Erase history',
    reopen: 'Reopen',
    unreadable: 'Unreadable history',
    eraseFile: 'Erase',
    eraseFileTitle: 'Erase the file “{file}”?',
    eraseFileBody:
      'This file, which the app cannot read, is erased for good. The other histories, and the files and worktrees on disk, are not touched.',
    eraseFileConfirm: 'Erase the file',
  },

  steps: {
    setup: {
      group: 'Setup command {n}',
      add: 'Add a setup command',
    },
    teardown: {
      group: 'Teardown command {n}',
      add: 'Add a teardown command',
    },
    commandPlaceholder: 'e.g. npm ci',
    subfolderTitle: 'Worktree subfolder (blank: its root)',
    subfolderPlaceholder: 'subfolder',
    up: 'Move up ({keys})',
    upN: 'Move command {n} up',
    down: 'Move down ({keys})',
    downN: 'Move command {n} down',
    deleteN: 'Delete command {n}',
  },
});
