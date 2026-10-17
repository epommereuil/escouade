//! The harnesses that run Escouade's agents, behind one interface (see docs/ENGINES.md).
//!
//! An engine (« un harness » in the interface: Claude Code first) starts the process of an agent
//! (a new conversation, a resumed one or a copy), and that process takes its messages, its
//! interruptions, its changes of model, effort and mode, and the answers to its permissions and
//! questions. What the process says comes back as frames, which the engine translates into the
//! agent's conversation (`Engine::translate`). The rest of the backend speaks to an engine through
//! these two traits only.

mod claude;
mod program;
pub mod registry;

pub use claude::CLAUDE;
pub use program::{Located, Program};

#[cfg(test)]
pub(crate) use claude::{claude_args, ClaudeProcess, SpawnOpts};

use crate::agent::{AgentRt, Effects};
use crate::core::Attachment;
use crate::job::JobUsage;
use crate::model::{AgentMeta, EngineId};
use anyhow::Result;
use serde_json::Value;
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

/// What an asynchronous method of the traits gives (they are used as trait objects).
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// The live process of an agent, whatever its engine.
pub type Process = Arc<dyn EngineProcess>;

/// Receives every frame of the process but the answers to the requests it was asked.
pub type OnFrame = Box<dyn Fn(Value) + Send + Sync>;

/// Runs once the process is gone, with its exit code and the end of what it said besides its
/// frames (its stderr).
pub type OnExit = Box<dyn FnOnce(Option<i32>, String) + Send>;

/// The engine of an agent, as its `AgentMeta.engine` says.
pub fn of(meta: &AgentMeta) -> &'static dyn Engine {
    by_id(meta.engine)
}

/// The engine `id` names. Claude Code is the only one written yet: the others get theirs with
/// their adapter (docs/TODO-1.8.md, chapter 1), and until then nothing makes an agent of theirs
/// (the interface offers none).
pub fn by_id(id: EngineId) -> &'static dyn Engine {
    match id {
        EngineId::Claude
        | EngineId::Codex
        | EngineId::Copilot
        | EngineId::Cursor
        | EngineId::Opencode => &CLAUDE,
    }
}

/// The engine of what has no agent yet (a question about a project, the settings).
pub fn default() -> &'static dyn Engine {
    &CLAUDE
}

/// Where a conversation starts from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Start {
    /// A new conversation.
    New,
    /// The session `session`, where it was left.
    Resume { session: String },
    /// A copy of the session `of`, under a session of its own (the original's is left as it is):
    /// as it was at `at` (the original's last message when it was copied), or all of it.
    Fork { of: String, at: Option<String> },
}

impl Start {
    /// What the agent of `meta` starts from: its session, else its original's for a copy that has
    /// none yet.
    pub fn of(meta: &AgentMeta) -> Self {
        if let Some(session) = &meta.session_id {
            Start::Resume {
                session: session.clone(),
            }
        } else if let Some(of) = &meta.fork_of {
            Start::Fork {
                of: of.clone(),
                at: meta.fork_at.clone(),
            }
        } else {
            Start::New
        }
    }
}

/// What the agent is given of Escouade's MCP server (`mcp::AgentAccess`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Escouade {
    /// Its tools, as the agent itself: the file that names the server with the agent's token.
    Granted { config: PathBuf },
    /// None of them, whatever the user's own config declares; `settings`, when it could be
    /// written, also keeps the server itself out of the process.
    Denied { settings: Option<PathBuf> },
}

/// How to start the process of an agent.
pub struct Spawn {
    /// Its harness's program, of its account.
    pub program: Program,
    /// Its folder.
    pub cwd: String,
    /// The variables it gets on top of the app's.
    pub env: Vec<(String, String)>,
    /// Its model, effort, mode and added instructions (`AgentMeta`), and where it starts from.
    pub model: String,
    pub effort: String,
    pub mode: String,
    pub append_prompt: Option<String>,
    pub start: Start,
    /// Folders it reads without a question: those of the files joined to its messages and of its
    /// ticket's files.
    pub read_dirs: Vec<PathBuf>,
    pub escouade: Escouade,
    /// Who it is and the account it runs on, for the log.
    pub label: String,
    pub account: String,
}

impl Spawn {
    /// The start of the agent of `meta` with `program`, in its folder, from where it was left.
    pub fn of(meta: &AgentMeta, program: Program, env: Vec<(String, String)>) -> Self {
        Spawn {
            program,
            cwd: meta.cwd.clone(),
            env,
            model: meta.model.clone(),
            effort: meta.effort.clone(),
            mode: meta.mode.clone(),
            append_prompt: meta.append_prompt.clone(),
            start: Start::of(meta),
            read_dirs: Vec::new(),
            escouade: Escouade::Denied { settings: None },
            label: format!("agent {}", meta.id),
            account: meta.account.clone(),
        }
    }
}

/// What a process says once it is ready.
#[derive(Debug, Clone, Default)]
pub struct Ready {
    /// Its slash commands, as the composer lists them.
    pub commands: Vec<Value>,
    /// The models it offers, as it tells them (`ModelInfo::list` reads them).
    pub models: Value,
}

/// A message to an agent, in its engine's own form (`Engine::message`).
#[derive(Debug, Clone, PartialEq)]
pub struct Message(pub(crate) Value);

/// The answer to a permission the agent asks (`call` is the tool call it is about).
#[derive(Debug, Clone, PartialEq)]
pub enum PermissionAnswer {
    /// Allowed once, with `input` (the tool's, maybe changed).
    Allow { call: String, input: Value },
    /// Allowed, and the `rules` the engine suggested kept for the rest of the session.
    Always {
        call: String,
        input: Value,
        rules: Value,
    },
    /// Refused, the agent told `message`.
    Deny { call: String, message: String },
}

/// The weight of a one-shot question (`Engine::one_shot`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Weight {
    /// A short text (a name, a title, a message): the engine's fastest model, and no tool.
    Light,
    /// A text written after reading its folder: a stronger model, with tools that only read.
    Reading,
}

/// One question asked of a harness with no session, no settings of the user's and no MCP server.
pub struct OneShot<'a> {
    pub program: Program,
    pub env: Vec<(String, String)>,
    pub weight: Weight,
    pub cwd: &'a std::path::Path,
    pub system: &'a str,
    pub prompt: &'a str,
    /// Past it, the process is killed with all it started.
    pub limit: Duration,
}

/// Why a process that never got going stopped, as the engine read it from what it said.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartLost {
    /// The session it was to resume (or a copy's original's) is gone.
    Session,
    /// The point of the original's session a copy was to start from is not there.
    ForkPoint,
}

/// A harness: Claude Code, then Codex, Copilot CLI, Cursor CLI, OpenCode.
pub trait Engine: Send + Sync {
    /// Its id, as the data keeps it (`claude`).
    fn id(&self) -> EngineId;
    /// Its name, as the interface says it (`Claude Code`).
    fn name(&self) -> &'static str;

    /// Its program, from the path of a setting (empty: where it usually is) and the distribution
    /// of WSL of the settings.
    fn locate(&self, configured: &str, wsl_distro: &str) -> Option<Program>;

    /// The versions Escouade was tested with: an older one is refused (`oldest_reason` says why),
    /// a newer one taken with a warning (`registry`).
    fn tested(&self) -> registry::Tested;
    /// Why a version older than `tested().oldest` is refused, in `lang`.
    fn oldest_reason(&self, lang: crate::i18n::Lang) -> String;
    /// The command that updates it, as the refusal tells it.
    fn update_command(&self) -> &'static str;
    /// The arguments that make its program print its version.
    fn version_args(&self) -> &'static [&'static str];
    /// What it can do, as the interface reads it (`registry::EngineCaps`).
    fn caps(&self) -> registry::EngineCaps;
    /// The command that installs it (« Aucun harness trouvé »).
    fn install(&self) -> registry::Install;
    /// The models the composer offers, in its menu's order.
    fn models(&self) -> Vec<registry::ModelDecl>;
    /// The efforts the composer offers, in its menu's order (none without `caps().effort`).
    fn efforts(&self) -> &'static [&'static str];

    /// Whether `model` takes an effort.
    fn supports_effort(&self, model: &str) -> bool;
    /// Whether `model` takes the mode `auto`.
    fn supports_auto(&self, model: &str) -> bool;

    /// Starts the process of an agent: a new conversation, a resumed one or a copy, as
    /// `spawn.start` says. `on_frame` and `on_exit` are called from the tasks that read it.
    fn spawn(&self, spawn: Spawn, on_frame: OnFrame, on_exit: OnExit) -> Result<Process>;

    /// `text` with the files `attachments`, as its process takes a message; refused when a file
    /// is of a kind it does not read, or too big.
    fn message(&self, text: &str, attachments: &[Attachment]) -> Result<Message>;

    /// One frame of the agent's process, translated into its conversation: the normalized items
    /// (`user`, `text`, `thinking`, `tool`, `question`, `permission`, `turn`, `notice`, `event`),
    /// the changes of its plan, its status and usage.
    fn translate(&self, rt: &mut AgentRt, frame: &Value, fx: &mut Effects);

    /// Why a process that stopped before it was ready could not start, from its stderr; None for
    /// any other reason.
    fn start_lost(&self, stderr: &str) -> Option<StartLost>;

    /// One question, its answer (`OneShot`).
    fn one_shot<'a>(&'a self, ask: OneShot<'a>) -> BoxFuture<'a, Result<String>>;
}

/// The live process of an agent.
pub trait EngineProcess: Send + Sync {
    // ----- the process -----

    fn is_alive(&self) -> bool;
    /// What the process and everything it started use.
    fn usage(&self) -> Option<JobUsage>;
    /// How many processes of its tree run (at least one while it has not been reaped).
    fn still_running(&self) -> u32;
    /// The ids of the processes of its tree.
    fn pids(&self) -> Vec<u32>;
    /// Closes its input: it finishes what it does and exits, its session resumable (the gentle
    /// stop).
    fn close_input(&self);
    /// Kills it and its whole tree.
    fn kill(&self);
    /// Waits until it is gone, at most `within`; false when it still runs.
    fn wait_exit(&self, within: Duration) -> BoxFuture<'_, bool>;
    /// Waits until it and everything it started are gone, at most `within`.
    fn wait_gone(&self, within: Duration) -> BoxFuture<'_, bool>;

    // ----- the conversation -----

    /// Asks it to get ready, once started: its commands and models.
    fn initialize(&self) -> BoxFuture<'_, Result<Ready>>;
    /// Sends a message (`Engine::message`) under the id `uuid`.
    fn send_message(&self, uuid: &str, message: &Message) -> Result<()>;
    /// Stops the running turn, and the messages queued after it with `cancel_queued`.
    fn interrupt(&self, cancel_queued: bool, timeout: Duration) -> BoxFuture<'_, Result<()>>;
    fn set_model<'a>(&'a self, model: &'a str) -> BoxFuture<'a, Result<()>>;
    fn set_effort<'a>(&'a self, effort: &'a str) -> BoxFuture<'a, Result<()>>;
    fn set_mode<'a>(&'a self, mode: &'a str) -> BoxFuture<'a, Result<()>>;
    /// Answers the permission `request_id`.
    fn answer_permission(&self, request_id: &str, answer: PermissionAnswer) -> Result<()>;
    /// Answers the question `request_id` (about the call `call`): `input` is the question's, with
    /// its `answers`.
    fn answer_question(&self, request_id: &str, call: &str, input: Value) -> Result<()>;
    /// The quota of its account, as the process reads it: its windows (`usage::parse_windows`),
    /// None when it tells none.
    fn read_usage(&self) -> BoxFuture<'_, Result<Option<Value>>>;
    /// Gives its session the title `title`.
    fn rename<'a>(&'a self, title: &'a str) -> BoxFuture<'a, Result<()>>;

    // ----- what Claude Code alone does for now -----

    /// Stops its background task (or subagent) `task`.
    fn stop_task<'a>(&'a self, task: &'a str) -> BoxFuture<'a, Result<()>>;
    /// What its background task `task` printed, as it answers.
    fn task_output<'a>(&'a self, task: &'a str) -> BoxFuture<'a, Result<Value>>;
    /// Links it to claude.ai or unlinks it (Remote Control): `request` says how, its answer the
    /// session it holds there.
    fn remote_control(&self, request: Remote, timeout: Duration) -> BoxFuture<'_, Result<Value>>;

    // ----- its own protocol -----

    /// A request in its own protocol, its answer: for the tests, and what has no method yet.
    #[cfg_attr(not(test), allow(dead_code))]
    fn control(&self, request: Value, timeout: Duration) -> BoxFuture<'_, Result<Value>>;
    /// Answers the request `request_id` it made, in its own protocol: `Err` refuses it.
    fn reply(&self, request_id: &str, answer: std::result::Result<Value, String>) -> Result<()>;
}

/// A request of Remote Control (`EngineProcess::remote_control`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Remote {
    /// Linked under `name`, the session `reattach` taken up again when there is one; `keep`, the
    /// session stays on claude.ai once the process exits.
    On {
        name: String,
        keep: bool,
        reattach: Option<String>,
    },
    Off,
}
