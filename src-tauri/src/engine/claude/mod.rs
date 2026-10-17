//! Claude Code, the first engine: a `claude` process driven over the stream-json protocol
//! (docs/PROTOCOL.md), its frames translated by `AgentRt::claude_frame` (`agent/claude.rs`).

mod locate;
mod process;

pub(crate) use process::{ClaudeProcess, SpawnOpts};

use super::registry::{
    CostKind, EngineCaps, ForkPoint, Install, MidTurn, ModeCap, ModelDecl, QuotaKind, Tested,
};
#[cfg(test)]
use super::Program;
use super::{
    BoxFuture, Engine, EngineProcess, Escouade, Message, OneShot, PermissionAnswer, Process, Ready,
    Remote, Spawn, Start, StartLost, Weight,
};
use crate::agent::{AgentRt, Effects};
use crate::core::{size_label, Attachment, MAX_IMAGE, MAX_TOTAL, MB};
use crate::i18n::{self, Lang};
use crate::job::JobUsage;
#[cfg(test)]
use crate::model::AgentMeta;
use anyhow::{anyhow, bail, Result};
use serde_json::{json, Value};
use std::time::Duration;

/// Claude Code.
pub struct Claude;

pub static CLAUDE: Claude = Claude;

/// The versions of Claude Code Escouade was tested with: its stream-json protocol from 2.1.283
/// (docs/PROTOCOL.md), up to the one of the last real run (2.1.301, 2026-10-16).
pub const TESTED: Tested = Tested {
    oldest: "2.1.283",
    newest: "2.1.301",
};

/// Its installers (claude.ai), as the Welcome screen gave the one of Windows.
const INSTALL: Install = Install {
    windows: "irm https://claude.ai/install.ps1 | iex",
    unix: "curl -fsSL https://claude.ai/install.sh | bash",
};

/// The aliases the composer offers: Claude Code runs the latest model of the family it knows
/// (`MODELS` of `src/lib/models.ts`, which names them once it has told which version).
const MODELS: [(&str, &str); 4] = [
    ("fable", "Fable"),
    ("opus", "Opus"),
    ("sonnet", "Sonnet"),
    ("haiku", "Haiku"),
];

/// The efforts it takes (`--effort`).
const EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

/// What Claude Code does, as Escouade drives it today.
pub fn caps() -> EngineCaps {
    let mode = |id| ModeCap { id, meaning: None };
    EngineCaps {
        modes: [
            "auto",
            "default",
            "plan",
            "acceptEdits",
            "bypassPermissions",
        ]
        .into_iter()
        .map(mode)
        .collect(),
        effort: true,
        images: true,
        pdf: true,
        fork: ForkPoint::Entry,
        resume_other_account: true,
        mid_turn: MidTurn::Queued,
        slash_commands: true,
        quota: QuotaKind::Windows,
        cost: CostKind::Exact,
        terminal_view: true,
        remote_control: true,
        background_tasks: true,
        todo_tools: true,
        default_refusal: true,
    }
}

const KB: usize = 1024;
/// The only image formats the API reads.
const IMAGE_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/// Past this, a text file alone would fill Claude's context (~4 bytes a token).
const MAX_TEXT: usize = 256 * KB;

/// Content of a user message: its text alone, or the attached files as content blocks
/// followed by the text.
pub fn user_content(text: &str, attachments: &[Attachment]) -> Result<Value> {
    if attachments.is_empty() {
        return Ok(Value::String(text.to_string()));
    }
    let (mut blocks, sizes): (Vec<Value>, Vec<usize>) = attachments
        .iter()
        .map(attachment_block)
        .collect::<Result<Vec<_>>>()?
        .into_iter()
        .unzip();
    if sizes.iter().sum::<usize>() > MAX_TOTAL {
        let lang = i18n::ui();
        bail!(tr_in!(
            lang,
            "Les fichiers joints à un message sont limités à {max} en tout.",
            "The files attached to a message are limited to {max} in all.",
            max = size_label(lang, MAX_TOTAL)
        ));
    }
    if !text.is_empty() {
        blocks.push(json!({ "type": "text", "text": text }));
    }
    Ok(Value::Array(blocks))
}

/// The content block of a file, and its size.
fn attachment_block(a: &Attachment) -> Result<(Value, usize)> {
    // Base64 carries 3 bytes in 4 characters, the padding none.
    let padding = a.data.bytes().rev().take_while(|&b| b == b'=').count();
    let decoded = (a.data.len() / 4 * 3).saturating_sub(padding);
    let (block, size, max) = match a.media_type.as_str() {
        t if IMAGE_TYPES.contains(&t) => (
            json!({ "type": "image", "source": { "type": "base64", "media_type": t, "data": a.data } }),
            decoded,
            MAX_IMAGE,
        ),
        "application/pdf" => (
            json!({
                "type": "document",
                "title": a.name,
                "source": { "type": "base64", "media_type": "application/pdf", "data": a.data },
            }),
            decoded,
            18 * MB,
        ),
        "text/plain" => (
            json!({
                "type": "document",
                "title": a.name,
                "source": { "type": "text", "media_type": "text/plain", "data": a.data },
            }),
            a.data.len(),
            MAX_TEXT,
        ),
        t => bail!(tr!(
            "« {name} » ({t}) ne peut pas être joint : les fichiers acceptés sont les images (PNG, JPEG, GIF, WebP), les PDF et les fichiers texte.",
            "“{name}” ({t}) can’t be attached: the files accepted are images (PNG, JPEG, GIF, WebP), PDFs and text files.",
            name = a.name
        )),
    };
    if size > max {
        let lang = i18n::ui();
        bail!(tr_in!(
            lang,
            "{name} dépasse {max}",
            "{name} is over {max}",
            name = a.name,
            max = size_label(lang, max)
        ));
    }
    Ok((block, size))
}

const CLAUDE_BASE_ARGS: &[&str] = &[
    "--output-format",
    "stream-json",
    "--verbose",
    "--input-format",
    "stream-json",
    "--permission-prompt-tool",
    "stdio",
    "--include-partial-messages",
    // Messages sent from claude.ai (Remote Control) come back on stdout, so the app shows them.
    "--replay-user-messages",
    "--thinking-display",
    "summarized",
    "--allow-dangerously-skip-permissions",
];

pub fn supports_effort(model: &str) -> bool {
    !model.to_lowercase().contains("haiku")
}

/// Whether a model takes the permission mode `auto`: every one but Haiku. The rule of
/// `supportsAuto` in `src/lib/models.ts`, which keeps the Composer from offering it.
pub fn supports_auto(model: &str) -> bool {
    !model.to_lowercase().contains("haiku")
}

/// The arguments of the conversation of `s`: its model, effort and mode, its added instructions,
/// and where it starts from.
fn conversation_args(s: &Spawn) -> Vec<String> {
    let mut a: Vec<String> = CLAUDE_BASE_ARGS.iter().map(|s| s.to_string()).collect();
    a.extend(["--model".into(), s.model.clone()]);
    if supports_effort(&s.model) {
        a.extend(["--effort".into(), s.effort.clone()]);
    }
    a.extend(["--permission-mode".into(), s.mode.clone()]);
    if let Some(p) = s.append_prompt.as_deref().filter(|p| !p.trim().is_empty()) {
        // On one line: a `.cmd` launcher (npm's claude.cmd) takes no argument with line breaks.
        let one_line = p.split_whitespace().collect::<Vec<_>>().join(" ");
        a.extend(["--append-system-prompt".into(), one_line]);
    }
    match &s.start {
        Start::New => {}
        Start::Resume { session } => a.push(format!("--resume={session}")),
        Start::Fork { of, at } => {
            // A copy's conversation so far is its original's, under a new session: the original's
            // is left as it is.
            a.extend([format!("--resume={of}"), "--fork-session".into()]);
            // As it was when copied: the turns the original ran since stay out.
            if let Some(at) = at {
                a.push(format!("--resume-session-at={at}"));
            }
        }
    }
    a
}

/// All the arguments of the process of `s`: its conversation's, then the folders it reads without
/// a question, then what it is given of Escouade's server. Never the token, only the path of the
/// file that holds it (a `.cmd` launcher takes 8,191 characters at most, and the app's log writes
/// the arguments). `--disallowedTools` and `--mcp-config` take several values: given last, nothing
/// after them is read as one.
fn args(s: &Spawn) -> Vec<String> {
    let mut a = conversation_args(s);
    a.extend(
        s.read_dirs
            .iter()
            .map(|d| format!("--add-dir={}", d.display())),
    );
    match &s.escouade {
        Escouade::Denied { settings } => {
            if let Some(file) = settings {
                a.extend(["--settings".into(), file.to_string_lossy().into_owned()]);
            }
            a.extend(["--disallowedTools".into(), crate::mcp::ALL_TOOLS.into()]);
        }
        Escouade::Granted { config } => {
            a.extend(["--mcp-config".into(), config.to_string_lossy().into_owned()]);
        }
    }
    a
}

/// The arguments of the conversation of the agent of `m` (the tests').
#[cfg(test)]
pub(crate) fn claude_args(m: &AgentMeta) -> Vec<String> {
    conversation_args(&Spawn::of(
        m,
        Program::Native(std::path::PathBuf::new()),
        Vec::new(),
    ))
}

/// The arguments as the log shows them: the protocol appended to the system prompt (up to several
/// KB of ticket text) is only counted, not copied.
fn args_for_log(args: &[String]) -> String {
    let mut shown: Vec<String> = Vec::with_capacity(args.len());
    let mut elide = false;
    for a in args {
        if std::mem::take(&mut elide) {
            shown.push(format!("<{} chars>", a.chars().count()));
            continue;
        }
        elide = a == "--append-system-prompt";
        shown.push(a.clone());
    }
    shown.join(" ")
}

/// The JSON answer of `claude -p --output-format json`: the whole output, or its last line that
/// is JSON when something came before (a warning of `wsl.exe` for a `claude` of WSL).
fn json_answer(stdout: &[u8]) -> Result<Value> {
    serde_json::from_slice(stdout).or_else(|e| {
        String::from_utf8_lossy(stdout)
            .lines()
            .rev()
            .find_map(|l| {
                // Also without the NULs of a warning written in UTF-16.
                let l = l.trim_matches(|c: char| c.is_whitespace() || c == '\0');
                serde_json::from_str::<Value>(l)
                    .ok()
                    .filter(Value::is_object)
            })
            .ok_or_else(|| e.into())
    })
}

impl Engine for Claude {
    fn id(&self) -> crate::model::EngineId {
        crate::model::EngineId::Claude
    }

    fn name(&self) -> &'static str {
        "Claude Code"
    }

    fn locate(&self, configured: &str, wsl_distro: &str) -> Option<super::Program> {
        locate::resolve_binary(configured, wsl_distro)
    }

    fn tested(&self) -> Tested {
        TESTED
    }

    fn oldest_reason(&self, lang: Lang) -> String {
        tr_in!(
            lang,
            "son flux JSON n’a été vérifié qu’à partir de celle-ci (docs/PROTOCOL.md)",
            "its JSON stream was only checked from that one on (docs/PROTOCOL.md)"
        )
    }

    fn update_command(&self) -> &'static str {
        "claude update"
    }

    fn version_args(&self) -> &'static [&'static str] {
        &["--version"]
    }

    fn caps(&self) -> EngineCaps {
        caps()
    }

    fn install(&self) -> Install {
        INSTALL
    }

    fn models(&self) -> Vec<ModelDecl> {
        MODELS
            .iter()
            .map(|&(id, label)| ModelDecl {
                id,
                label,
                effort: supports_effort(id),
                auto: supports_auto(id),
            })
            .collect()
    }

    fn efforts(&self) -> &'static [&'static str] {
        &EFFORTS
    }

    fn supports_effort(&self, model: &str) -> bool {
        supports_effort(model)
    }

    fn supports_auto(&self, model: &str) -> bool {
        supports_auto(model)
    }

    fn spawn(
        &self,
        spawn: Spawn,
        on_frame: super::OnFrame,
        on_exit: super::OnExit,
    ) -> Result<Process> {
        let opts = SpawnOpts {
            args: args(&spawn),
            program: spawn.program,
            cwd: spawn.cwd,
            env: spawn.env,
        };
        log::info!(
            "{}: starting {} {} in {} (account {})",
            spawn.label,
            opts.program.describe(),
            args_for_log(&opts.args),
            opts.cwd,
            spawn.account
        );
        let p: Process = ClaudeProcess::spawn(opts, on_frame, on_exit)?;
        Ok(p)
    }

    fn message(&self, text: &str, attachments: &[Attachment]) -> Result<Message> {
        user_content(text, attachments).map(Message)
    }

    fn translate(&self, rt: &mut AgentRt, frame: &Value, fx: &mut Effects) {
        rt.claude_frame(frame, fx);
    }

    fn start_lost(&self, stderr: &str) -> Option<StartLost> {
        if stderr.contains("No conversation found") {
            Some(StartLost::Session)
        } else if stderr.contains("No message found with message.uuid") {
            Some(StartLost::ForkPoint)
        } else {
            None
        }
    }

    fn one_shot<'a>(&'a self, ask: OneShot<'a>) -> BoxFuture<'a, Result<String>> {
        Box::pin(one_shot(ask))
    }
}

/// One question to Claude (`claude -p`, no session, no settings, no MCP), as `ask` says: its
/// answer, within its limit (the question's writing included: a `claude` that never reads it
/// would hold it forever).
async fn one_shot(ask: OneShot<'_>) -> Result<String> {
    use tokio::io::AsyncWriteExt;
    let OneShot {
        program,
        env,
        weight,
        cwd,
        system,
        prompt,
        limit,
    } = ask;
    let (who, model, tools) = match weight {
        Weight::Light => ("Haiku", "haiku", ""),
        Weight::Reading => ("Claude", "sonnet", "Read,Glob,Grep"),
    };
    let args = [
        "-p",
        "--model",
        model,
        "--output-format",
        "json",
        "--no-session-persistence",
        "--tools",
        tools,
        "--setting-sources",
        "",
        // No MCP servers (account connectors included): nothing that invites the model to act.
        "--strict-mcp-config",
        "--system-prompt",
        system,
    ]
    .map(String::from);
    let launch = program.launch(&cwd.to_string_lossy(), &args, &env)?;
    let mut cmd = tokio::process::Command::new(&launch.program);
    // Reading needs no permission in its folder, and is refused outside of it: nothing more is
    // allowed.
    cmd.args(&launch.args)
        .current_dir(cwd)
        .envs(launch.env)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(crate::proc::CREATE_NO_WINDOW);
    crate::job::isolate(&mut cmd);
    let mut child = cmd.spawn()?;
    // Dropped when this returns: whatever the process left running ends with it.
    let _job = crate::job::Job::for_child(&child);
    let asked = async move {
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(prompt.as_bytes()).await?;
            // Dropped here: the input ends, and the CLI answers.
        }
        anyhow::Ok(child.wait_with_output().await?)
    };
    let out = tokio::time::timeout(limit, asked).await.map_err(|_| {
        anyhow!(tr!(
            "pas de réponse de {who} en {s} s",
            "no answer from {who} in {s} s",
            s = limit.as_secs()
        ))
    })??;
    let v = json_answer(&out.stdout)?;
    Ok(v["result"].as_str().unwrap_or("").to_string())
}

/// The answer to a control request of the CLI that lets a tool run.
fn allowed(call: &str, input: Value) -> Value {
    json!({ "behavior": "allow", "updatedInput": input, "toolUseID": call })
}

/// How long a change of model, effort or mode may take.
const SETTING: Duration = Duration::from_secs(15);

impl EngineProcess for ClaudeProcess {
    fn is_alive(&self) -> bool {
        ClaudeProcess::is_alive(self)
    }

    fn usage(&self) -> Option<JobUsage> {
        ClaudeProcess::usage(self)
    }

    fn still_running(&self) -> u32 {
        ClaudeProcess::still_running(self)
    }

    fn pids(&self) -> Vec<u32> {
        ClaudeProcess::pids(self)
    }

    fn close_input(&self) {
        ClaudeProcess::close_input(self)
    }

    fn kill(&self) {
        ClaudeProcess::kill(self)
    }

    fn wait_exit(&self, within: Duration) -> BoxFuture<'_, bool> {
        Box::pin(ClaudeProcess::wait_exit(self, within))
    }

    fn wait_gone(&self, within: Duration) -> BoxFuture<'_, bool> {
        Box::pin(ClaudeProcess::wait_gone(self, within))
    }

    fn initialize(&self) -> BoxFuture<'_, Result<Ready>> {
        Box::pin(async move {
            let resp = ClaudeProcess::control(
                self,
                json!({ "subtype": "initialize" }),
                Duration::from_secs(90),
            )
            .await?;
            Ok(Ready {
                commands: resp["commands"].as_array().cloned().unwrap_or_default(),
                models: resp["models"].clone(),
            })
        })
    }

    fn send_message(&self, uuid: &str, message: &Message) -> Result<()> {
        self.send(&json!({
            "type": "user",
            "message": { "role": "user", "content": message.0 },
            "parent_tool_use_id": null,
            "uuid": uuid,
        }))
    }

    fn interrupt(&self, cancel_queued: bool, timeout: Duration) -> BoxFuture<'_, Result<()>> {
        let request = if cancel_queued {
            json!({ "subtype": "interrupt", "cancel_queued": true })
        } else {
            json!({ "subtype": "interrupt" })
        };
        Box::pin(async move {
            ClaudeProcess::control(self, request, timeout)
                .await
                .map(drop)
        })
    }

    fn set_model<'a>(&'a self, model: &'a str) -> BoxFuture<'a, Result<()>> {
        let request = json!({ "subtype": "set_model", "model": model });
        Box::pin(async move {
            ClaudeProcess::control(self, request, SETTING)
                .await
                .map(drop)
        })
    }

    fn set_effort<'a>(&'a self, effort: &'a str) -> BoxFuture<'a, Result<()>> {
        let request =
            json!({ "subtype": "apply_flag_settings", "settings": { "effortLevel": effort } });
        Box::pin(async move {
            ClaudeProcess::control(self, request, SETTING)
                .await
                .map(drop)
        })
    }

    fn set_mode<'a>(&'a self, mode: &'a str) -> BoxFuture<'a, Result<()>> {
        let request = json!({ "subtype": "set_permission_mode", "mode": mode });
        Box::pin(async move {
            ClaudeProcess::control(self, request, SETTING)
                .await
                .map(drop)
        })
    }

    fn answer_permission(&self, request_id: &str, answer: PermissionAnswer) -> Result<()> {
        let response = match answer {
            PermissionAnswer::Allow { call, input } => allowed(&call, input),
            PermissionAnswer::Always { call, input, rules } => {
                let mut r = allowed(&call, input);
                r["updatedPermissions"] = rules;
                r
            }
            PermissionAnswer::Deny { call, message } => {
                json!({ "behavior": "deny", "toolUseID": call, "message": message })
            }
        };
        self.respond(request_id, response)
    }

    fn answer_question(&self, request_id: &str, call: &str, input: Value) -> Result<()> {
        self.respond(request_id, allowed(call, input))
    }

    fn read_usage(&self) -> BoxFuture<'_, Result<Option<Value>>> {
        Box::pin(async move {
            let v = ClaudeProcess::control(
                self,
                json!({ "subtype": "get_usage", "skip_behaviors": true }),
                Duration::from_secs(20),
            )
            .await?;
            let windows = &v["rate_limits"];
            Ok(windows.is_object().then(|| windows.clone()))
        })
    }

    fn rename<'a>(&'a self, title: &'a str) -> BoxFuture<'a, Result<()>> {
        let request = json!({ "subtype": "rename_session", "title": title, "source": "host" });
        Box::pin(async move {
            ClaudeProcess::control(self, request, Duration::from_secs(10))
                .await
                .map(drop)
        })
    }

    fn stop_task<'a>(&'a self, task: &'a str) -> BoxFuture<'a, Result<()>> {
        let request = json!({ "subtype": "stop_task", "task_id": task });
        Box::pin(async move {
            ClaudeProcess::control(self, request, Duration::from_secs(15))
                .await
                .map(drop)
        })
    }

    fn task_output<'a>(&'a self, task: &'a str) -> BoxFuture<'a, Result<Value>> {
        let request = json!({ "subtype": "get_task_output", "task_id": task });
        Box::pin(ClaudeProcess::control(
            self,
            request,
            Duration::from_secs(10),
        ))
    }

    fn remote_control(&self, request: Remote, timeout: Duration) -> BoxFuture<'_, Result<Value>> {
        let request = match request {
            Remote::Off => json!({ "subtype": "remote_control", "enabled": false }),
            Remote::On {
                name,
                keep,
                reattach,
            } => {
                let mut r = json!({
                    "subtype": "remote_control", "enabled": true, "name": name,
                    "keep_session_on_exit": keep,
                });
                if let Some(s) = reattach {
                    r["reattach_session_id"] = json!(s);
                }
                r
            }
        };
        Box::pin(ClaudeProcess::control(self, request, timeout))
    }

    fn control(&self, request: Value, timeout: Duration) -> BoxFuture<'_, Result<Value>> {
        Box::pin(ClaudeProcess::control(self, request, timeout))
    }

    fn reply(&self, request_id: &str, answer: std::result::Result<Value, String>) -> Result<()> {
        match answer {
            Ok(response) => self.respond(request_id, response),
            Err(error) => self.respond_error(request_id, &error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Criterion, Ticket};

    #[test]
    fn auto_mode_is_taken_by_every_model_but_haiku_as_the_composer_offers_it() {
        // The rule of `supportsAuto` (src/lib/models.ts), the effort's as well.
        for model in [
            "haiku",
            "Haiku",
            "claude-haiku-4-5",
            "CLAUDE-HAIKU-4-5-20251001",
        ] {
            assert!(!supports_auto(model), "{model}");
            assert!(!supports_effort(model), "{model}");
        }
        for model in ["sonnet", "opus", "claude-sonnet-4-5", "claude-opus-4-1", ""] {
            assert!(supports_auto(model), "{model}");
        }
    }

    #[test]
    fn the_answer_of_claude_p_is_found_after_a_warning() {
        let answer = br#"{"type":"result","result":"feat: x"}"#;
        assert_eq!(json_answer(answer).unwrap()["result"], "feat: x");
        let warned =
            "wsl: Une configuration de proxy localhost a été détectée\r\n{\"result\":\"ok\"}\r\n";
        assert_eq!(json_answer(warned.as_bytes()).unwrap()["result"], "ok");
        // The warning in UTF-16, as wsl.exe writes it without WSL_UTF8.
        let utf16: Vec<u8> = "wsl: x\n"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .chain(*b"{\"result\":\"ok\"}")
            .collect();
        assert_eq!(json_answer(&utf16).unwrap()["result"], "ok");
        assert!(json_answer(b"pas du JSON").is_err());
        assert!(json_answer(b"").is_err());
    }

    #[test]
    fn args_for_haiku_skip_effort() {
        let m = AgentMeta {
            model: "haiku".into(),
            effort: "high".into(),
            mode: "auto".into(),
            session_id: Some("s1".into()),
            ..Default::default()
        };
        let a = claude_args(&m);
        assert!(!a.contains(&"--effort".to_string()));
        assert!(a.contains(&"--resume=s1".to_string()));
        let m = AgentMeta {
            model: "opus".into(),
            effort: "max".into(),
            mode: "plan".into(),
            ..Default::default()
        };
        let a = claude_args(&m);
        assert!(a.windows(2).any(|w| w == ["--effort", "max"]));
    }

    #[test]
    fn a_copy_forks_the_session_of_its_original_until_it_has_its_own() {
        let copy = AgentMeta {
            model: "opus".into(),
            effort: "high".into(),
            mode: "auto".into(),
            fork_of: Some("s1".into()),
            ..Default::default()
        };
        let a = claude_args(&copy);
        assert!(
            a.windows(2).any(|w| w == ["--resume=s1", "--fork-session"]),
            "{a:?}"
        );
        // An original that ran no turn since it was recorded: its session as it is.
        assert!(!a.iter().any(|x| x.starts_with("--resume-session-at")));
        // Where it was copied: the turns the original ran since are left out.
        let pinned = AgentMeta {
            fork_at: Some("e1".into()),
            ..copy
        };
        let a = claude_args(&pinned);
        assert!(
            a.windows(3)
                .any(|w| w == ["--resume=s1", "--fork-session", "--resume-session-at=e1"]),
            "{a:?}"
        );
        // Its own session once a turn gave it one: the original's is read no more.
        let own = AgentMeta {
            session_id: Some("s2".into()),
            ..pinned
        };
        let a = claude_args(&own);
        assert!(a.contains(&"--resume=s2".to_string()), "{a:?}");
        assert!(
            !a.iter().any(|x| x == "--fork-session"
                || x == "--resume=s1"
                || x.starts_with("--resume-session-at")),
            "{a:?}"
        );
    }

    #[test]
    fn the_protocol_is_appended_to_the_system_prompt_on_one_line() {
        let m = AgentMeta {
            model: "sonnet".into(),
            effort: "high".into(),
            mode: "auto".into(),
            append_prompt: Some("Ligne 1\nLigne 2 « % & \" »".into()),
            ..Default::default()
        };
        let a = claude_args(&m);
        let i = a
            .iter()
            .position(|x| x == "--append-system-prompt")
            .unwrap();
        assert_eq!(a[i + 1], "Ligne 1 Ligne 2 « % & \" »");
        assert!(!claude_args(&AgentMeta::default()).contains(&"--append-system-prompt".to_string()));
        // Blank: nothing to append.
        let blank = AgentMeta {
            append_prompt: Some(" \n ".into()),
            ..Default::default()
        };
        assert!(!claude_args(&blank).contains(&"--append-system-prompt".to_string()));
    }

    #[test]
    fn the_log_line_of_a_start_does_not_copy_the_protocol() {
        let m = AgentMeta {
            model: "opus".into(),
            effort: "max".into(),
            mode: "plan".into(),
            session_id: Some("s1".into()),
            append_prompt: Some("Protocole « secret » du ticket ATL-42".into()),
            ..Default::default()
        };
        let line = args_for_log(&claude_args(&m));
        assert!(
            !line.contains("secret") && !line.contains("ATL-42"),
            "{line}"
        );
        // The flag stays, its value is only counted; the arguments around it are untouched.
        assert!(
            line.contains("--append-system-prompt <37 chars> --resume=s1"),
            "{line}"
        );
        assert!(line.contains("--model opus --effort max --permission-mode plan"));
        // Without a protocol, the line is the arguments as they are.
        let plain = claude_args(&AgentMeta::default());
        assert_eq!(args_for_log(&plain), plain.join(" "));
        // A flag ending the list has no value to elide.
        assert_eq!(
            args_for_log(&["--append-system-prompt".to_string()]),
            "--append-system-prompt"
        );
    }

    /// The command line of a `.cmd` launcher (npm's claude.cmd) is cmd.exe's, which takes 8191
    /// characters in all: every argument counts as Rust escapes it (`board::escaped_len`) between
    /// its quotes, with a space before it, behind the launcher's path and cmd.exe's own prefix.
    fn command_line_weight(program: &str, args: &[String]) -> usize {
        const CMD_PREFIX: &str = "C:\\Windows\\System32\\cmd.exe /e:ON /v:OFF /d /c \"";
        CMD_PREFIX.len()
            + program.len()
            + 2
            + args
                .iter()
                .map(|a| 1 + 2 + crate::board::escaped_len(a))
                .sum::<usize>()
    }

    #[test]
    fn a_ticket_agents_whole_command_line_fits_cmds_limit_in_the_worst_case() {
        // Criteria and a title made of what a `.cmd` argument escapes the most (`%`, `"`, `\`),
        // accents, and every kind of line break; far more of them than fit.
        let nasty = "%\"\\é\r\n%\"\\\\\"à\n".repeat(40);
        let t = Ticket {
            id: "t1".into(),
            project_id: "p1".into(),
            key: "ATL-42".into(),
            title: nasty.clone(),
            criteria: (0..60)
                .map(|_| Criterion {
                    text: nasty.clone(),
                    ..Default::default()
                })
                .collect(),
            max_loops: 5,
            ..Default::default()
        };
        // A long launcher path, as npm puts it under a user profile with a long name.
        let program = "C:\\Users\\guillaume.gagnaire-lefebvre\\AppData\\Roaming\\npm\\claude.cmd";
        for ports in [None, Some(4100)] {
            let m = AgentMeta {
                model: "claude-opus-4-5-20251101[1m]".into(),
                effort: "max".into(),
                mode: "bypassPermissions".into(),
                session_id: Some("0f8fad5b-d9cb-469f-a165-70867728950e".into()),
                append_prompt: Some(crate::board::protocol_prompt(&t, ports)),
                ..Default::default()
            };
            let args = claude_args(&m);
            assert!(
                args.contains(&"--append-system-prompt".to_string()),
                "{ports:?}"
            );
            assert!(
                args.iter().all(|a| !a.contains('\n') && !a.contains('\r')),
                "{ports:?}: a line break in an argument"
            );
            let weight = command_line_weight(program, &args);
            assert!(weight < 8191, "{ports:?}: {weight} of 8191");
            // The criteria are cut where they stop fitting, which leaves some of the protocol's
            // budget unused: with all of it used, the line must still fit.
            let protocol = m.append_prompt.as_deref().unwrap();
            let unused = crate::board::PROTOCOL_BUDGET - crate::board::escaped_len(protocol);
            println!(
                "worst-case command line, ports {ports:?}: {weight} of 8191, {} with the whole protocol budget used",
                weight + unused
            );
            assert!(
                weight + unused < 8191,
                "{ports:?}: {} of 8191 with the whole protocol budget used",
                weight + unused
            );
        }
    }

    fn att(name: &str, media_type: &str, data: &str) -> Attachment {
        Attachment {
            name: name.into(),
            media_type: media_type.into(),
            data: data.into(),
        }
    }

    #[test]
    fn a_message_without_attachments_is_plain_text() {
        assert_eq!(user_content("Bonjour", &[]).unwrap(), json!("Bonjour"));
    }

    #[test]
    fn attachments_come_before_the_text_as_content_blocks() {
        let c = user_content(
            "Résume",
            &[
                att("capture.png", "image/png", "iVBO"),
                att("rapport.pdf", "application/pdf", "JVBE"),
                att("notes.md", "text/plain", "# Notes\nà faire"),
            ],
        )
        .unwrap();
        assert_eq!(
            c,
            json!([
                { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBO" } },
                { "type": "document", "title": "rapport.pdf",
                  "source": { "type": "base64", "media_type": "application/pdf", "data": "JVBE" } },
                { "type": "document", "title": "notes.md",
                  "source": { "type": "text", "media_type": "text/plain", "data": "# Notes\nà faire" } },
                { "type": "text", "text": "Résume" },
            ])
        );
    }

    #[test]
    fn a_file_alone_is_sent_without_an_empty_text_block() {
        let c = user_content("", &[att("a.pdf", "application/pdf", "JVBE")]).unwrap();
        assert_eq!(c.as_array().unwrap().len(), 1);
    }

    #[test]
    fn unsupported_or_oversized_attachments_are_refused() {
        let e = user_content("x", &[att("plan.docx", "application/msword", "UEsD")]).unwrap_err();
        assert!(e.to_string().contains("plan.docx"), "{e}");
        // The API reads only these image formats.
        assert!(user_content("x", &[att("a.bmp", "image/bmp", "Qk0=")]).is_err());
        let big = "A".repeat(7 * 1024 * 1024);
        let e = user_content("x", &[att("photo.png", "image/png", &big)]).unwrap_err();
        assert!(e.to_string().contains("5 Mo"), "{e}");
    }

    #[test]
    fn text_pdf_and_whole_message_sizes_fit_what_claude_takes() {
        // Past ~256 KB, a text file alone would fill Claude's context.
        let ok = "a".repeat(256 * 1024);
        assert!(user_content("x", &[att("log.txt", "text/plain", &ok)]).is_ok());
        let e = user_content("x", &[att("log.txt", "text/plain", &(ok + "a"))]).unwrap_err();
        assert!(e.to_string().contains("256 Ko"), "{e}");
        // A PDF of 18 MB fits in the whole message's limit.
        let pdf = "A".repeat(19 * MB / 3 * 4);
        let e = user_content("x", &[att("a.pdf", "application/pdf", &pdf)]).unwrap_err();
        assert!(e.to_string().contains("18 Mo"), "{e}");
        let pdf = "A".repeat(18 * MB / 3 * 4);
        assert!(user_content("x", &[att("a.pdf", "application/pdf", &pdf)]).is_ok());
        // Together, the files stay under the API's request size.
        let part = "A".repeat(10 * MB);
        let three = ["a.pdf", "b.pdf", "c.pdf"].map(|n| att(n, "application/pdf", &part));
        let e = user_content("x", &three).unwrap_err();
        assert!(e.to_string().contains("18 Mo en tout"), "{e}");
        assert!(user_content("x", &three[..2]).is_ok());
    }

    #[test]
    fn base64_padding_is_not_counted_as_data() {
        // Exactly 5 MB: 5 MB ≡ 2 (mod 3), so its base64 ends with one '='.
        let n = 5 * MB;
        let b64 = format!("{}=", "A".repeat((n / 3 + 1) * 4 - 1));
        assert!(user_content("x", &[att("p.png", "image/png", &b64)]).is_ok());
    }
}
