# The Claude Code view

The Claude Code view runs an agent in Claude Code’s own interface, in a terminal, and brings it back to Escouade’s conversation without losing the session. This page explains how to switch views, what Escouade keeps tracking, and what changes.

## What it’s for

Escouade’s conversation shows the essentials of an agent’s work, but not everything Claude Code offers. In its own interface, you get all of it: `/` commands, shortcuts, dialogs, `/model`, `Shift+Tab` to change mode… It’s useful when you want to work the way you would in a terminal, while keeping the agent in Escouade’s list with its statuses, notifications, and cost.

## Switching views

In an agent’s conversation header, the “Claude Code view” button (`>_`) launches Claude Code’s interface in a terminal that takes the place of the conversation. The button becomes “Escouade view” (`◧`): a click takes you back to the conversation. The menu of the agent’s card in the sidebar (right click) offers the same: “Claude Code view” or “Escouade view”. The session is the same in both directions: Escouade stops the process of one view and resumes the session in the other (`--resume`), so the agent forgets nothing. The choice is kept for each agent. The interface starts when you show the agent (the terminal then says “Starting Claude Code…”), including after Escouade restarts, and picks up its session. An agent in remote control is the exception: when Escouade starts, its interface is started in the background so that the agent is reachable (see [below](#remote-control-in-this-view)).

Switching to the Claude Code view is refused in two cases, with a message; switching back to the Escouade view is refused in none of them:

- **The agent is still working**: switch views once its turn is over.
- **The agent works on a ticket**: a ticket agent stays in Escouade’s view, which its board drives (see [the Kanban](board)). Neither the button nor the entry of its card’s menu exists for it, nor for an archived agent.

If the interface stops (you typed `/exit`, or the process was killed), the terminal shows “Claude Code stopped.” and a “Restart” button; if it doesn’t start, “Claude Code didn’t start:” followed by the error, with the same button. Archiving or deleting the agent also closes its terminal.

## What Escouade keeps tracking

Claude Code’s interface is a terminal, but Escouade still knows what the agent does. It reads it in two ways: Claude Code’s hooks, which the interface calls on your machine (`127.0.0.1`, with a token of its own for each interface), and the session’s transcript, which the app rereads continuously. Your own hooks stay active.

Thanks to this, an agent in the Claude Code view keeps:

- **its dot and its statuses**: “Running”, “Question” when it’s waiting for a permission or an answer, “Done” at the end of a turn;
- **its notifications**: the blinking, the chime, and the system notification when it’s waiting for a permission or an answer, then when it finishes (see [notifications](notifications));
- **its conversation**: what happens in the interface is also written to Escouade’s conversation, which you find again when you return to the “Escouade view”;
- **search** (`Ctrl+K`, see [keeping track of your agents](overview#searching-conversations));
- **the “Plan” banner** (see [plan progress](plan));
- **its subagents**: their list in the sidebar and, read-only, their conversation (see [below](#subagents));
- **its background tasks**: their list in the sidebar and their view, without “Stop” (see [below](#background-tasks));
- **its statistics and its cost** (see [statistics](stats)). The interface doesn’t give the cost of each turn: Escouade estimates it from public prices.

When the agent is waiting for an answer, you give it in the terminal: the [overview](overview) reminds you (“Waiting for your answer in Claude Code’s interface”) and its “Reply” button opens the agent.

## Subagents

The subagents of an agent in the Claude Code view are listed as elsewhere, under its card in the sidebar and in the “Plan” banner (see [subagents in the sidebar](plan#subagents-in-the-sidebar)). A click on one opens its conversation in place of the terminal; the breadcrumb, or `Esc`, takes you back to the agent.

This conversation is **read-only**. Escouade reads it in the transcript Claude Code keeps for this subagent, next to the agent’s: it’s read when the view opens, read again every 2 seconds while the subagent runs, then one last time when it finishes. The view says so at the top (“Read-only: its transcript, as Claude Code writes it. This subagent is acted on in Claude Code’s own interface.”). There’s no “Stop” and no “Write to it”: to stop a subagent or write to it, use Claude Code’s interface, in the terminal. If Escouade can’t find that transcript (Claude Code hasn’t written it yet, or keeps it elsewhere), the view says “No message from this subagent yet.”

In this view, no signal tells Escouade that a background subagent has finished. It works it out from what Claude Code replays to the agent in its transcript: the report the subagent hands back to it, or the notification of its end. Until that message has arrived, the subagent’s line stays “Running”. Its report is the one it handed back to the agent.

## Background tasks

The tasks that Claude Code starts in the background for an agent in the Claude Code view (commands, monitors…) are listed as elsewhere, under its card in the sidebar, with the “N in background” chip on the card (see [background tasks](plan#background-tasks)). A click on one opens its view in place of the terminal; the breadcrumb, or `Esc`, takes you back to the agent.

In this view, no signal announces them to Escouade. It reads a task’s start in the result of the tool that Claude Code writes in the agent’s transcript, with the call’s command, and its end in the notification Claude Code replays there. Until that notification has arrived, the task’s line stays “Running”, and the start time isn’t exact to the second. There’s no “Stop”: the view says “This task is stopped from Claude Code’s own interface.”, and you stop the task in the terminal. The output is read from the output file Claude Code writes for the task (the view says “read from the output file”), since no request can ask Claude Code for it. Through the [MCP server](mcp#an-agent-s-subagents-and-background-tasks), Claude can list them and read their output, but `stop_background_work` and `message_subagent` are refused for an agent in the Claude Code view: there, a task is stopped and a subagent is written to from Claude Code’s own interface.

## Writing to an agent in this view

Escouade’s message field isn’t shown: you write in the terminal, as in Claude Code. To attach an image, such as a copied screenshot, paste it into the terminal (`Ctrl+V`, `Cmd+V` on macOS) or drop it onto it: Escouade saves it to a file and types its path, which Claude Code takes for the image (“[Image #1]”). Pasted text is typed as it is.

Any other file (an archive, a spreadsheet, a document…) is attached the same way: paste it into the terminal, or drop it onto it (a dashed frame shows the drop zone). Escouade always copies it, and never reads the file at its original location: Claude Code’s interface is launched once, and only the agent’s folder can be read there without asking. It then types the path of the copy (`/mnt/c/…` for a Claude Code in WSL), which Claude reads with its tools. The copy sits in the agent’s folder, with the chat’s copies (see [attachments](chat#attachments)). The maximum size from the [settings](settings-claude-code#attachments) applies; the size warning doesn’t exist here, for lack of a chip.

To dictate rather than type, click the microphone at the top right of the terminal (or press `Ctrl+Shift+Space`, `⇧⌘Space` on macOS): one click starts and another ends, a long press dictates while it is held. The text is typed into Claude Code’s prompt as a paste, at its cursor, and is not submitted: you read it, then press `Enter`. The transcription runs on your machine (see [dictating a message](chat#dictating-a-message)).

A message sent to the agent from elsewhere, for example through the [MCP server](mcp), is typed into its interface. It’s refused while the agent is waiting for an answer in its terminal (“The agent is waiting for an answer in its terminal: answer there first.”). It is also refused for an interface started in the background that nobody has shown yet, as long as it isn’t ready (see [below](#remote-control-in-this-view)). An interruption requested from Escouade becomes the `Esc` key in the interface.

## Remote control in this view

[Remote control](remote-control) follows the same rules as in the Escouade view: you turn it on with a right-click on the agent’s card or with a setting (a project’s or the global one), and the agent is reachable from claude.ai and the Claude app as `project · agent`. Switching to the Claude Code view isn’t refused when it is on. Claude Code’s interface then holds the remote session.

- **Starting.** The interface of an agent in remote control is started with `--remote-control=<project · agent>`: Claude Code shows the session’s link. When the interface resumes its session (Escouade restarting, a relaunch), Claude Code reattaches the same remote session, with the same link. A closed interface archives its remote session.
- **When Escouade starts.** The interface of such an agent is started in the background, without you opening it. Opening the agent shows the interface already running; if its remote control goes off before then, it stops, unless it is in the middle of a turn. These starts are made at most 3 at a time: a start keeps its place until the interface is ready, 15 seconds at most.
- **A change.** Escouade can’t turn remote control on or off in an interface that is already open: a change takes effect the next time the interface starts. After a right-click, a message says so; for a setting, its description does. Until then, Claude Code’s `/remote-control` command does it.
- **The card’s menu.** It offers “Turn on remote control” or “Turn off remote control”. “Open on claude.ai” and “Copy the claude.ai link” are offered too, once the interface is connected: the link comes from the interface, which shows it in its own.
- **The card’s icon.** Its tooltip says how the interface is doing: no interface running (not reachable for now), connecting…, connected, from the next launch of the interface (open before remote control was turned on), or not opened by Claude Code (no claude.ai subscription, network, proxy or organization policy). Off for Escouade but still on in the open interface, remote control keeps a crossed-out icon, in the warning color, until the next launch, if the interface really had its link. The detail is in [remote control](remote-control#the-icon-of-an-interface).
- **A refused message.** As long as an interface started in the background has never been shown and isn’t ready (first-launch screen, a folder to approve), a message from the window or from the MCP server is refused: open the agent to see the interface.

## Opening new agents in this view

In Settings › Harness, group “New agents”, the “Open new agents in Claude Code’s interface” switch (off by default) makes each new agent start in this view. Each agent can then switch views from its header. Ticket agents always stay in Escouade’s view. See [the Claude Code settings](settings-claude-code).

## Folder trust

The first time Claude Code’s interface launches in a folder, it asks whether you trust it. Escouade never answers for you. Worktrees created in the project’s default worktrees folder (`.claude/worktrees`) inherit the answer given for the project. A “Worktrees folder” outside the project doesn’t inherit it: the interface asks the question the first time each worktree is launched (see [worktrees](worktrees)).

## On Windows with WSL

When Claude Code is installed in WSL, Escouade launches it through `wsl.exe` (see [the Claude Code settings](settings-claude-code)). Live tracking of the Claude Code view then requires WSL’s mirrored networking: without it, the interface’s hooks don’t reach the app. The settings point it out under the `claude` path (“WSL’s network is NAT…”). To switch to mirrored mode, add this to `%UserProfile%\.wslconfig`, then run `wsl --shutdown`:

```ini
[wsl2]
networkingMode=mirrored
```
