//! « Vue Claude Code »: Claude Code's own interface (its TUI) in a terminal (`TerminalView`).
//!
//! Its hooks are HTTP hooks to Escouade's server, given with `--settings`; its log is the
//! session's transcript (`projects/<folder>/<session>.jsonl`), whose entries have the shape of the
//! stream's frames (`agent::transcript`); it lists its running interfaces in the registry of its
//! sessions (`<config folder>/sessions`). See docs/PROTOCOL.md, « Vue Claude Code ».

use super::super::terminal::{bracketed, TerminalArgs, TerminalLaunch, TerminalView};
use super::super::Escouade;
use super::{mcp, CLAUDE};
use crate::agent::{AgentRt, Effects, HookOutcome};
use crate::engine::Engine;
use crate::model::AgentMeta;
use crate::tui::{find_registered, Registered};
use anyhow::Result;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// The hooks Escouade listens to.
pub(crate) const EVENTS: &[&str] = &[
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "Notification",
    "Stop",
    "StopFailure",
];

/// What Claude Code says, before it quits, of a session to resume that its folder does not have.
const NO_CONVERSATION: &str = "No conversation found";

/// The types of the images Claude Code reads.
const IMAGE_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/// Claude Code's interface.
pub struct ClaudeTerminal;

pub static CLAUDE_TERMINAL: ClaudeTerminal = ClaudeTerminal;

/// The settings an interface is started with (`--settings <file>`): its hooks, each an HTTP call
/// to `url` with the token of its variable `token_var`, and, Escouade's tools refused to it
/// (`access`), the server itself kept out (`Engine::refusal`: Claude Code reads the last
/// `--settings` only, so both are in this one).
pub(crate) fn settings(url: &str, token_var: &str, access: &Escouade) -> Value {
    let hook = json!([{ "hooks": [{
        "type": "http",
        "url": url,
        "headers": { "Authorization": format!("Bearer ${token_var}") },
        "allowedEnvVars": [token_var],
        "timeout": 5,
    }] }]);
    let hooks: serde_json::Map<String, Value> = EVENTS
        .iter()
        .map(|e| (e.to_string(), hook.clone()))
        .collect();
    let mut settings = json!({ "hooks": hooks });
    if let Escouade::Denied { .. } = access {
        if let Value::Object(refusal) = mcp::refusal() {
            settings.as_object_mut().unwrap().extend(refusal);
        }
    }
    settings
}

/// The arguments of an agent's interface, as its stream's are (`claude_args`) less the stream's
/// own; `session` is the session it starts or forks into, when it resumes none, and `remote` the
/// name of its session in claude.ai when it starts with Remote Control.
pub fn tui_args(
    m: &AgentMeta,
    session: Option<&str>,
    remote: Option<&str>,
    settings_file: &Path,
) -> Vec<String> {
    let mut a: Vec<String> = vec!["--model".into(), m.model.clone()];
    if CLAUDE.supports_effort(&m.model) {
        a.extend(["--effort".into(), m.effort.clone()]);
    }
    a.extend([
        "--permission-mode".into(),
        m.mode.clone(),
        "--allow-dangerously-skip-permissions".into(),
    ]);
    if let Some(p) = m.append_prompt.as_deref().filter(|p| !p.trim().is_empty()) {
        let one_line = p.split_whitespace().collect::<Vec<_>>().join(" ");
        a.extend(["--append-system-prompt".into(), one_line]);
    }
    match (&m.session_id, &m.fork_of) {
        (Some(s), _) => a.push(format!("--resume={s}")),
        (None, Some(f)) => {
            a.extend([format!("--resume={f}"), "--fork-session".into()]);
            if let Some(at) = &m.fork_at {
                a.push(format!("--resume-session-at={at}"));
            }
            a.extend(session.map(|s| format!("--session-id={s}")));
        }
        (None, None) => a.extend(session.map(|s| format!("--session-id={s}"))),
    }
    // One argument, the name glued to the flag: Claude Code takes it so, even one that starts with
    // « - » (as a separate argument, it might be read as an option).
    if let Some(name) = remote {
        a.push(format!("--remote-control={name}"));
    }
    a.extend([
        "--settings".into(),
        settings_file.to_string_lossy().into_owned(),
    ]);
    a
}

/// The transcript of `session` in an account's folder: `projects/<folder>/<session>.jsonl`, the
/// one written last if several folders have it.
pub fn find_transcript(config_dir: &Path, session: &str) -> Option<PathBuf> {
    let file = format!("{session}.jsonl");
    std::fs::read_dir(config_dir.join("projects"))
        .ok()?
        .flatten()
        .filter_map(|folder| {
            let path = folder.path().join(&file);
            let at = std::fs::metadata(&path).ok()?.modified().ok()?;
            Some((at, path))
        })
        .max_by_key(|(at, _)| *at)
        .map(|(_, path)| path)
}

/// Whether the output says Claude Code could not find the session it was told to resume.
pub(crate) fn says_no_conversation(output: &[u8]) -> bool {
    String::from_utf8_lossy(output).contains(NO_CONVERSATION)
}

impl TerminalView for ClaudeTerminal {
    fn shell(&self) -> &'static str {
        "claude"
    }

    fn launch(&self, l: &TerminalLaunch) -> TerminalArgs {
        let settings = settings(l.hooks.url, l.hooks.token_var, l.access);
        TerminalArgs {
            args: tui_args(l.meta, l.session, l.remote, l.private_file),
            file: Some(serde_json::to_vec_pretty(&settings).unwrap_or_default()),
            env: Vec::new(),
        }
    }

    fn read_dir_args(&self, dir: &Path) -> Vec<String> {
        vec![format!("--add-dir={}", dir.display())]
    }

    fn names_its_session(&self) -> bool {
        true
    }

    fn on_hook(&self, rt: &mut AgentRt, hook: &Value, fx: &mut Effects) -> HookOutcome {
        rt.on_hook(hook, fx)
    }

    fn running_dir(&self, config_dir: &Path) -> Option<PathBuf> {
        Some(config_dir.join("sessions"))
    }

    fn find_running(&self, dir: &Path, session: &str, known: Option<&Path>) -> Option<Registered> {
        find_registered(dir, session, known)
    }

    fn find_log(&self, config_dir: &Path, session: &str) -> Option<PathBuf> {
        find_transcript(config_dir, session)
    }

    fn on_log_entry(&self, rt: &mut AgentRt, entry: &Value, fx: &mut Effects) {
        rt.on_transcript(entry, fx);
    }

    fn says_session_lost(&self, output: &[u8]) -> bool {
        says_no_conversation(output)
    }

    fn copy_session(&self, from: &Path, to: &Path, session: &str) -> Result<()> {
        crate::accounts::copy_session(from, to, session)
    }

    fn paste(&self, text: &str) -> Vec<u8> {
        bracketed(text)
    }

    fn submit(&self) -> &'static [u8] {
        b"\r"
    }

    fn image_types(&self) -> &'static [&'static str] {
        &IMAGE_TYPES
    }

    fn interrupt_key(&self) -> &'static [u8] {
        b"\x1b"
    }

    fn quit_key(&self) -> &'static [u8] {
        b"\x03"
    }
}
