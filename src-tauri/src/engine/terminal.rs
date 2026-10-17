//! « Vue <harness> »: an agent run in its harness's own interface, in a terminal, in place of the
//! process that Escouade's conversation drives (`tui`). What that takes of a harness, behind one
//! interface (`TerminalView`, `Engine::terminal`):
//! - the launch: its interface's arguments, in the agent's folder, with its account's environment
//!   and Escouade's MCP server, and its hooks pointed at Escouade's hooks' server;
//! - the state: what each of its hooks tells (a turn starts or ends, a permission or a question
//!   waits for the user);
//! - the conversation: its session's log, read as it is written, each entry translated;
//! - the resume: the session found where the interface will look for it, and what the interface
//!   says when it does not find it;
//! - the paste of a message, and the keys that interrupt a turn and end the interface.
//!
//! A harness that calls its hooks as commands (not over HTTP) is given `escouade-hook`
//! (`src/bin/escouade-hook.rs`), which posts what it reads on its input to the same server.

use crate::agent::{AgentRt, Effects, HookOutcome};
use crate::model::AgentMeta;
use anyhow::Result;
use serde_json::Value;
use std::path::{Path, PathBuf};

use super::Escouade;

/// Escouade's hooks' server, as an interface's hooks reach it. `url_var` and `command` are for
/// the harnesses that run their hooks as commands (`escouade-hook`): Claude Code calls them over
/// HTTP.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct HookServer<'a> {
    /// Where they post what they tell (`http://127.0.0.1:<port>/hook`).
    pub url: &'a str,
    /// The variable of the interface's environment that holds its token: what the hooks send as
    /// `Authorization: Bearer <token>`.
    pub token_var: &'static str,
    /// The variable that gives `escouade-hook` the server's address (`url`).
    pub url_var: &'static str,
    /// `escouade-hook`, for a harness that runs its hooks as commands; None when it was not found
    /// beside the app.
    pub command: Option<&'a Path>,
}

/// What an interface is started from (`TerminalView::launch`).
pub struct TerminalLaunch<'a> {
    /// The agent: its model, effort, mode, added instructions, and the session it resumes or
    /// copies.
    pub meta: &'a AgentMeta,
    /// The session it starts (or copies into), named by Escouade, when it resumes none and its
    /// harness takes a name for it (`TerminalView::names_its_session`).
    pub session: Option<&'a str>,
    /// The name of its session on claude.ai, when it starts with Remote Control.
    pub remote: Option<&'a str>,
    /// The private file of the interface, which the core writes `TerminalArgs::file` to before it
    /// starts (and that stays its, the agent's own, from one start to the next).
    pub private_file: &'a Path,
    pub hooks: HookServer<'a>,
    /// Escouade's MCP server given to it, or refused.
    pub access: &'a Escouade,
}

/// How an interface is started.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct TerminalArgs {
    pub args: Vec<String>,
    /// What its private file (`TerminalLaunch::private_file`) holds; None: no file.
    pub file: Option<Vec<u8>>,
    /// The variables it gets besides its account's, the token's and the MCP server's.
    pub env: Vec<(String, String)>,
}

/// The interface of a harness in a terminal (« Vue <harness> »).
pub trait TerminalView: Send + Sync {
    // ----- the launch -----

    /// The name of its terminal, as the window lists it (`claude`).
    fn shell(&self) -> &'static str;
    /// The arguments, private file and variables of its interface.
    fn launch(&self, l: &TerminalLaunch) -> TerminalArgs;
    /// The arguments that let it read the folder `dir` without a question.
    fn read_dir_args(&self, dir: &Path) -> Vec<String>;
    /// Escouade names a new session before the interface starts (its log is then known before any
    /// hook); false: the interface names its own, which its first hook tells.
    fn names_its_session(&self) -> bool;

    // ----- the state -----

    /// One of its hooks, the agent's state changed by what it tells.
    fn on_hook(&self, rt: &mut AgentRt, hook: &Value, fx: &mut Effects) -> HookOutcome;
    /// The folder where it lists its running interfaces (`find_running`), in the account's
    /// config folder `config_dir`; None: it lists none.
    fn running_dir(&self, config_dir: &Path) -> Option<PathBuf>;
    /// Its interface of `session` among those `dir` lists, the file that lists it (`known`, once
    /// found) read alone: it is up, past what it asks before it reads a message. Never blocks for
    /// long nor fails.
    fn find_running(
        &self,
        dir: &Path,
        session: &str,
        known: Option<&Path>,
    ) -> Option<crate::tui::Registered>;

    // ----- the conversation -----

    /// The log of `session` in the account's config folder `config_dir`.
    fn find_log(&self, config_dir: &Path, session: &str) -> Option<PathBuf>;
    /// One entry of its log, translated into the agent's conversation.
    fn on_log_entry(&self, rt: &mut AgentRt, entry: &Value, fx: &mut Effects);

    // ----- the resume -----

    /// Whether what the interface wrote before it quit says it did not find the session it was to
    /// resume.
    fn says_session_lost(&self, output: &[u8]) -> bool;
    /// Copies the session `session` from the account's config folder `from` into `to`'s.
    fn copy_session(&self, from: &Path, to: &Path, session: &str) -> Result<()>;

    // ----- the paste and the interruption -----

    /// What is typed in it for a message `text`, before `submit` sends it: pasted, so that its
    /// line breaks stay in it.
    fn paste(&self, text: &str) -> Vec<u8>;
    /// The key that sends what was pasted.
    fn submit(&self) -> &'static [u8];
    /// The types of the images it takes as a path pasted in it (none: it takes no image so).
    fn image_types(&self) -> &'static [&'static str];
    /// The key that interrupts its turn.
    fn interrupt_key(&self) -> &'static [u8];
    /// The key that ends it for good when sent twice, `quit_gap` apart.
    fn quit_key(&self) -> &'static [u8];
}

/// A text pasted in a terminal (bracketed paste), the sequence's own escape taken out of it.
pub fn bracketed(text: &str) -> Vec<u8> {
    format!("\x1b[200~{}\x1b[201~", text.replace('\x1b', "")).into_bytes()
}

/// The name of the `escouade-hook` command on this platform.
pub const HOOK_COMMAND: &str = if cfg!(windows) {
    "escouade-hook.exe"
} else {
    "escouade-hook"
};

/// `escouade-hook`, beside the app's program (where the installers put it, and `cargo build`
/// too). In the tests, the app's program is the test binary, in `deps`: it is one folder up.
pub fn hook_command() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let found = [Some(dir), dir.parent()]
        .into_iter()
        .flatten()
        .map(|d| d.join(HOOK_COMMAND))
        .find(|p| p.is_file());
    found
}
