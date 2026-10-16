# Settings: Application

This page describes the settings window (its tabs, how to open it, how it saves) and its “Application” tab, which sets the display (the interface zoom, the text size of the terminals and of the editor) and the language of the interface and of the texts Claude writes.

## The settings window

Escouade’s settings live in a single window, with one tab per topic. Open it with `Ctrl+,` (`⌘,` on macOS) or with the ⚙ button in the [status bar](interface). It opens on the “Claude Code” tab, unless a button opens it straight on the tab that concerns it: the ⚙ button in the header of the [Kanban](board) opens “Kanban”, and a project’s menu opens “Projects”. The shortcut does nothing while another dialog is open.

### The tabs

The left column lists the tabs, with Escouade’s version at the bottom. The name and description of the tab you are on sit at the top of the right-hand side. When the focus is on the list, the up and down arrows move from tab to tab, and `Home` and `End` jump to the first and the last.

| Tab | What it sets |
|---|---|
| “Application” | Zoom, text size, and languages |
| [“Claude Code”](settings-claude-code) | Executable, model, and default permissions |
| [“Claude accounts”](settings-accounts) | The accounts agents start on, saved as you change them |
| [“Notifications”](settings-notifications) | Visual and sound alerts |
| [“Projects”](settings-projects) | Settings specific to each project |
| [“Kanban”](settings-board) | Autopilot and approved tickets |
| [“Integrations”](settings-integrations) | Jira, Trello, GitHub Issues, and Linear |
| [“Terminals”](settings-terminals) | Shells available in the built-in terminals |
| [“Network”](settings-network) | HTTP(S) proxy and TLS certificates for Claude Code, integrations, and updates |
| [“About”](settings-about) | Version and local data |

“Projects”, “Kanban”, and “Integrations” set one project at a time. Under the header, a “Project” row offers one button per open project, with its color swatch and its name. The window starts on the project you are viewing, or on the one belonging to the button that opened it. Switching projects does not lose what you changed on the others. With no project open, these tabs say “No project open.”.

### Save or cancel

Changes go into a draft: nothing applies until you click “Save”. A dot on a tab (tooltip “Modified, not saved yet”) means it holds changes that are not saved.

- “Save” saves everything that changed in one go, across all tabs and all projects. The window closes and shows “Settings saved”. If one part fails, an error message appears, the window stays open, and whatever was saved no longer counts as a change.
- “Cancel”, the cross, `Esc`, or a click on the backdrop closes the window and throws the draft away, without asking for confirmation. When you reopen it, everything starts again from what is saved.
- When a problem prevents saving, a red message appears at the bottom left, names the project concerned (even if it is not the one on screen), and “Save” is grayed out. There are three cases: a project has lost its name; a launch command has no name or no command line; the worktrees folder or a branch prefix of a project is not valid.

### What saves right away

Three places do not wait for the button. The “Claude accounts” tab, where each change goes through the moment you make it, and the “Claude and the agents can drive Escouade” switch on the “Claude Code” tab, because a “Cancel” could not undo what they write to disk. And the “Display” group of the “Application” tab, which also changes from the keyboard, settings window open or not: what you pick there shows and saves right away.

## The “Application” tab

The tab has two groups, “Display” and “Language”.

### Display

These three settings apply right away, with no “Save” and no restart, and stay from one launch to the next.

| Setting | Effect | Default |
|---|---|---|
| “Interface zoom” | Makes the whole window bigger or smaller, like a browser’s zoom: text, spacing, and icons together, terminals and editor included. Steps: 80%, 90%, 100%, 110%, 125%, 150%, 175%, and 200%. | 100% |
| “Terminal text size” | The font size of the terminals and of the [Claude Code view](claude-code-view), in pixels, from 9 to 24 in half-pixel steps. The zoom adds to it. | 12.5 |
| “Editor text size” | The font size of the [editor](editor), in pixels, from 9 to 24; the lines grow with it. The zoom adds to it. | 12.5 |

From the keyboard, anywhere, even in a terminal or with a dialog open: `Ctrl+=` (or `Ctrl++`) zooms in one step, `Ctrl+-` zooms out one step, `Ctrl+0` goes back to 100% (`⌘=`, `⌘-`, `⌘0` on macOS). The `+` and `-` keys of the numeric keypad work too.

A terminal whose font changes resizes at once to fit its area, and its program is told its new size in columns and rows: nothing spills over or gets cut.

> [!NOTE]
> The interface is laid out for at least 1000 × 600 pixels, the window’s minimum size. A step that would not leave that much room is grayed out, with the tooltip “Too big for the size of the window”, and `Ctrl+=` stops before it. If the window shrinks below the chosen step, the interface switches to the biggest step it can hold, and the tab says so; the chosen step comes back as soon as the window is big enough.

### Language

Both choices take effect as soon as you save, with no restart: the window, the app’s menus, and the texts Escouade writes switch to the new language.

| Setting | Effect | Default |
|---|---|---|
| “Interface language” | The language of the window, the app’s menus, and the messages Escouade shows. | “System” |
| “Language of texts written by Claude” | The language of what Claude writes for you: commits, pull requests, comments, instructions to agents. | “Same as the interface (default)” |

### Interface language

Three choices, each written in its own language so you can find yours whatever language the interface is in:

- “System (French)” follows the computer’s language. Escouade comes in French and English: it picks French when the first preferred language of the system is French, English otherwise. The system’s language is named in the interface’s language, so a French system with an English interface gives “System (French)”.
- “English”.
- “Français”.

The change also reaches the app’s native menus and the tooltip of the taskbar icon.

### Language of texts written by Claude

This choice decides which language Escouade asks Claude to use for what leaves the app:

- the proposed commit messages and pull request descriptions, see [Git](git);
- the comments posted to Jira, Trello, GitHub, and Linear, see [the integrations](integrations);
- the instructions Escouade gives to agents.

The three choices are “Same as the interface (default)”, “English”, and “Français”. With “Same as the interface”, the proposed commit message follows the language of the repository’s latest commits, to blend in. With “English” or “Français”, that language is the one asked for.

> [!TIP]
> Many teams commit in English with an interface in French: pick “Français” for the interface and “English” for the texts Claude writes.
