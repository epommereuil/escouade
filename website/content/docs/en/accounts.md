# Several Claude accounts

Escouade can run your agents on several Claude accounts (personal, work, a client’s) and picks each new agent’s account by itself. This page explains how to add them, order them, reserve them to projects and resume an agent stopped by the usage limit on another account.

## Why several accounts

A Claude account is a sign-in to claude.ai with its own quotas (a 5-hour window and a weekly window) and its own conversations. With several accounts you keep personal and work apart, or you set aside an account for a client’s projects. When an account reaches the pause threshold, new agents start on another one.

Each account is Claude Code run with a configuration folder of its own (the `CLAUDE_CONFIG_DIR` variable), so it has its own sign-in, sessions and quota. Escouade never shares one account’s sign-in with another.

This page covers how to use accounts; the full list of the tab’s options is in [the accounts settings](settings-accounts).

## Main

“Main” is your usual Claude account, the one Claude Code used before you added another. It exists from the first launch.

- Escouade runs it as it always did: it doesn’t give it a configuration folder. It keeps your sign-in and your conversations. Its folder is the one the `CLAUDE_CONFIG_DIR` variable names when it is set for the app, otherwise `~/.claude`. On macOS, giving it a folder would sign you out: Claude Code then changes the name of the keychain entry where it keeps the sign-in.
- It is called “Main” until you rename it, in the language of the interface.
- It can’t be removed. Like any other account, it can be renamed, switched off (as long as another account is active), reserved to projects and given its own executable.
- If it isn’t signed in with a claude.ai account (it runs on an API key, say), the tab says so: “Not signed in with a claude.ai account (API key?)”.

## Add an account

1. Open the settings (`Ctrl+,`, or ⚙ in the status bar) and the “Claude accounts” tab.
2. Click “Add an account…”.
3. Type the account’s name in “Name” (the field suggests “Pro, Team…”). Two accounts can’t have the same name, whatever the capitals.
4. Choose what the account takes from Main, under “Share with Main” (see below).
5. Click “Create and sign in”. The account is created, active and placed last in the list, then the window opens its sign-in.

Escouade creates a folder for the account under `~/.escouade/claude/`, named after the account. It never reuses the folder of a removed account: a new account always gets a fresh folder.

> [!NOTE]
> On macOS, `Ctrl` becomes `⌘` in shortcuts (except `Ctrl+Tab`).

### What an account takes from Main

A new account can take part of what you set up in Claude Code for Main. Only the items Main’s folder contains are offered, and they are all ticked at first. If Main has nothing to share, the window says so.

| Item | Type |
|---|---|
| `settings.json` | File: Claude Code’s settings |
| `CLAUDE.md` | File: your instructions |
| `skills`, `agents`, `commands` | Folders: skills, agents and commands |
| `plugins`, `hooks` | Folders: plugins and hooks |
| `output-styles` | Folder: output styles |

The “Sharing” choice says how these items are taken:

- “Link (a change applies to both accounts)” (the default): the account points to Main’s item. A change made on one side shows on the other. On Windows, folders are linked with a junction, which needs no administrator rights, but files are copied, because a link to a file needs them; the window reminds you: “copied (linking a file needs administrator rights)”.
- “Copy”: the account gets a copy, and each one then changes its own.

Two cases are exceptions. When Main’s folder is in a WSL distribution, everything is copied, whatever you choose. On Windows, a path that contains `%` or a straight quote can’t be linked: the message then asks you to choose “Copy”.

> [!NOTE]
> The sign-in (`.credentials.json`) and the `.claude.json` file (the email address, the MCP servers and the projects of the account) are never shared: each account has its own.

### Sign in to the account

After “Create and sign in”, the window changes its title (“Sign in to the account” followed by the account’s name) and shows a terminal running the account’s own `claude`, with its configuration folder.

1. Sign in from that terminal, as you would in Claude Code: follow the instructions, the browser opens. If Claude Code doesn’t offer the sign-in, type `/login`.
2. Escouade looks for the sign-in every 2 seconds. As soon as it finds it, the window says “Signed in as ada@example.dev” (or “Signed in” when the address isn’t known yet), closes the terminal a second and a half later and reads the account’s quota.
3. Click “Done”.

If Claude Code stops before the sign-in, the window says “Claude Code stopped before signing in.” and offers “Restart”. If you close the window along the way, the account stays in the list, “Not signed in”: pick it up again with “Sign in…”.

“Sign in…” also reconnects an account whose sign-in has expired. When the account is signed in and up to date, the button reads “Sign in again…”: handy to switch to another claude.ai account.

## Manage the accounts

The “Claude accounts” tab of the settings lists the accounts. Each change is saved right away, without going through the saving of the other settings (“Cancel” doesn’t undo it). One row per account:

| Item | Role |
|---|---|
| Name | An editable field. The change is taken when you leave the field or press `Enter`. |
| State | “Checking…”, “Signed in · ada@example.dev”, “Signed in”, “Not signed in” or “Inactive”. An expired sign-in is flagged in amber under the row: “Sign-in expired: run Claude Code again for this account.” |
| Active | A switch. An inactive account no longer receives new agents. The last active account can’t be switched off (“At least one account must be active.”). |
| ↑ and ↓ | The order of the accounts. New agents try them in this order (“Move Pro up”, “Move Pro down”). |
| Folder | The account’s configuration folder, read-only. |
| Executable | The `claude` this account runs. Empty (“The one in the settings”), it takes the executable of the “Claude Code” tab. |
| Sign in… / Sign in again… | Opens the account’s sign-in (see above). |
| Remove | Removes the account (see below). Missing for Main. |
| Reserved to projects | The projects the account is reserved to (see below). |

Under the list, an amber line appears when a project has no active account left to serve it.

## Which account an agent starts on

### The automatic choice

A new agent, or a ticket the autopilot takes, starts on:

1. the project’s “Preferred account”, if it has one, that account is active and it serves the project;
2. otherwise the first active account of the list, in order, that serves the project and whose quotas aren’t at the “Pause above quota” threshold (an account that just hit its usage limit is also left out);
3. if no account is under the threshold, the first active account. The [autopilot](autopilot) then pauses.

The order of the list therefore decides: put at the top the account you want to use up first.

The threshold is set in Settings › Kanban, “Autopilot” group: 80, 90, 95 or 100% (100% by default), for all projects. It is detailed in [the Kanban settings](settings-board).

When the account that received new agents passes the threshold and another one is available, a notification says so: “The Main account has reached 91%: new agents now go to Pro.”

### A project’s preferred account

With several accounts, a project’s settings (“Projects” tab, “Identity” group) have a “Preferred account” choice: the account this project’s new agents and tickets go to.

- “Automatic” (the default): the automatic choice above.
- A specific account: it is taken even if its quota is at the threshold. The project’s tickets then wait for that account alone.

A preferred account that has become inactive, that is reserved to other projects or that no longer exists is ignored: the project goes back to automatic. Removing an account also clears the preference of the projects that had chosen it.

### Choose the account by hand

With several accounts, an agent’s input field (see [the chat](chat)) has an “Account” menu next to the model. As long as you haven’t written to the agent, it offers:

- “Automatic (Pro)”: the account the automatic choice would take now (“The project’s, else the first account under the pause threshold.”);
- every active account that serves the project.

Choosing an account changes the agent’s account before it starts.

### Each agent stays on its account

From the first message on, an agent’s account can’t change: the menu becomes read-only (“An agent’s account can’t change after its first message (its conversation is filed in that account).”). Claude Code files each conversation in the folder of the account that runs it.

Only one thing moves an agent: “Resume on…” (below), which takes its session along. The statistics count each turn on the account the agent had at that moment.

## Reserved to projects

Every account, Main included, can be kept for certain projects. Under an account, the “Reserved to projects” row lists your projects with a checkbox each. While no box is ticked, the row ends with “· Every project”: the account serves every project. Hovering the label recalls the principle: “Tick projects to keep this account to them alone (a client’s projects, say): the others never start on it.”

A project you don’t tick can never use the account:

- not through the automatic choice, for an agent or for a ticket;
- not through the agent’s “Account” menu;
- not as “Preferred account”, which the project doesn’t offer;
- not through “Resume on…”, nor through the automatic resume.

Agents that already started on the account stay there.

It is meant to isolate a client: tick their projects on their account, and their projects only start on it.

If no active account serves a project (because every account is reserved to other projects, say), nothing starts for it:

- the project’s Kanban says “No Claude account for this project — no tickets will start”;
- a new agent is refused, with a message that says where to tick the project;
- the “Claude accounts” tab says it under the list, in amber, for example: No active account serves “Client”: its agents and tickets won’t start.

To fix it, tick the project on an active account, or untick all the boxes of one account so that it serves every project again.

“Close the project” (the danger zone of the project’s settings) keeps the project’s history, and the project stays in the “Reserved to projects” list of the accounts it was reserved to: it only leaves when its history is erased (the “Also erase its history” box when closing, or “Erase history…” under “Closed projects”).

An account that was reserved to that project alone therefore serves no open project while the project is closed. If it was your only active account, nothing starts for the other projects, and the “Claude accounts” tab says so under the list, as above.

That tab shows the closed project in the account’s “Reserved to projects” row, ticked and marked “(closed)”, for example “Client (closed)”. Untick it to free the account: with nothing ticked, it serves every project again. When you reopen the project (see [Closed projects](settings-projects#closed-projects)), its reservations are still there: there is nothing to redo. If you erase the history, when closing or later under “Closed projects”, the project leaves every account’s list. The project’s “Preferred account”, for its part, goes back to “Automatic” on reopening if its account no longer exists.

## Resume an agent stopped by the usage limit

### What happens at the limit

When Claude refuses a turn because the account’s quota is used up, the agent stops. The turn’s error card, the agent’s card in the sidebar (“Resumes at 3:00 PM”) and the Kanban give the time of the automatic resume.

By default, Escouade sends “continue” to the agent about thirty seconds after the quota resets, when it knows when that is. This is the “Auto-resume after the usage limit” setting (Settings › Harness, “Processes” group). The card’s “Cancel auto-resume” button cancels it for that agent.

### Resume on another account

With several accounts, the card offers “Resume on Pro”: the first eligible account in the order of the list. When several accounts qualify, the ▾ button (“Resume on another account”) opens the menu of the others.

An account is eligible if it is active, different from the agent’s, serves its project, is signed in and is under the pause threshold: an account already at the threshold is left out, the agent would meet the limit there again.

Clicking does this:

1. Escouade stops the agent’s Claude process.
2. It copies its session (the conversation and what its subagents and tools kept in it) into the other account’s folder.
3. The agent moves to that account, and its automatic resume is canceled.
4. Escouade sends it “continue”, as for an automatic resume.

The conversation keeps a trace: “The agent resumes on the Pro account (it was on Main).”

The move has a few conditions: the agent must have finished its turn (“The agent is still working: resume once its turn is over.”) and have a session. A session also can’t go from an account that runs Claude Code on Windows to one that runs it in WSL, or the other way round.

If the turn that follows fails on the new account, the card says “Resuming on Pro failed: …” and offers “Go back to Main”. That button brings the session back to the original account, with what the failed turn added to it, and the agent waits again for the reset it was waiting for.

### By itself, for ticket agents

The “Resume a ticket’s agent stopped by the usage limit on another account” setting (Settings › Harness, “Processes” group, visible with several accounts) does the same without you. It is off by default; its description reads: “Otherwise it waits for its account to reset”.

When on, the agent of a ticket stopped by the limit moves by itself to another account when one fits: the project’s preferred account, otherwise the first one in the list. That account must be signed in, under the threshold, held back by no pause after a usage limit, with no agent waiting for its own reset, and on the same side of WSL as the agent. If there is none, or if the move fails (the conversation then says “Couldn’t resume on another account: …”), the agent waits for its account to reset, as before.

The account left receives no new ticket until it resets (30 minutes when the reset isn’t known). A project whose “Preferred account” is the agent’s own account keeps its agent there: it waits.

## Disable or remove an account

**Disable.** The “Active” switch keeps the account in the list, with its sign-in, its folder and its conversations, but no new agent, ticket or resume starts on it any more. Its state becomes “Inactive”. Agents already on it stay there; their “Account” menu shows it as “Pro (inactive)”.

**Remove.** The “Remove” button (never on Main) asks for confirmation. The window starts with “Remove the account” followed by the account’s name, then says: “New agents will no longer start on it. Its folder stays on the disk, with its sign-in and its conversations:” and the folder’s path.

- While agents that aren’t archived run on the account, removal is refused: “The account is still used by 2 agents.” Archive or delete them first.
- The account’s folder stays on the disk: Escouade doesn’t erase it, and doesn’t reuse it if you add an account with the same name. To get the account back, add a new one and sign in again.
- Projects that had this account as “Preferred account” go back to “Automatic”.
- Its turns stay in the statistics, under “Deleted account (pro)”.
- An archived agent of this account that you restore later runs on Main.

## Quotas and statistics by account

- The status bar shows the quota of the account a new agent would start on; a click opens each account’s details. See [quotas and cost](usage).
- The [statistics](stats) can be filtered by account, and their “By account” table puts the accounts side by side.
