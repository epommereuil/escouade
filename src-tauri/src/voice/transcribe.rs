//! What turns the sound into text: whisper.cpp on the machine, or what a test puts in its place.

use anyhow::{anyhow, Result};
use parking_lot::Mutex;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Takes the sound (mono, 16 kHz) to its text. Called off the main thread, it may take seconds.
pub trait Transcriber: Send + Sync {
    /// `model`: the file of the model; `language`: whisper's code ("fr", "en"…), or "auto" for it
    /// to find out. Gives up early once `cancel` is set.
    fn transcribe(
        &self,
        model: &Path,
        samples: &[f32],
        language: &str,
        cancel: &Arc<AtomicBool>,
    ) -> Result<String>;

    /// Loads `model` ahead (while the user speaks), if it is not already.
    fn preload(&self, _model: &Path) {}

    /// Forgets the model loaded, if it is `model` (deleted).
    fn unload(&self, _model: &Path) {}
}

/// whisper.cpp, its model kept loaded from one dictation to the next.
#[derive(Default)]
pub struct Whisper {
    loaded: Mutex<Option<(PathBuf, Arc<whisper_rs::WhisperContext>)>>,
}

impl Whisper {
    fn context(&self, model: &Path) -> Result<Arc<whisper_rs::WhisperContext>> {
        let mut loaded = self.loaded.lock();
        if let Some((p, ctx)) = &*loaded {
            if p == model {
                return Ok(ctx.clone());
            }
        }
        // The other one first: two models at once could take 3 GB.
        *loaded = None;
        let started = std::time::Instant::now();
        let path = model
            .to_str()
            .ok_or_else(|| anyhow!("model path not UTF-8"))?;
        let ctx = whisper_rs::WhisperContext::new_with_params(
            path,
            whisper_rs::WhisperContextParameters::default(),
        )
        .map_err(|e| anyhow!("model not loaded: {e}"))?;
        log::info!(
            "voice: {} loaded in {} ms",
            model.display(),
            started.elapsed().as_millis()
        );
        let ctx = Arc::new(ctx);
        *loaded = Some((model.to_path_buf(), ctx.clone()));
        Ok(ctx)
    }
}

/// What whisper writes for what is no speech ("[BLANK_AUDIO]", "(musique)", "[Applause]"), taken
/// out, and the segments joined into one line.
pub fn clean(segments: &[String]) -> String {
    let mut out = String::new();
    for s in segments {
        let mut kept = String::new();
        let mut depth = 0usize;
        for c in s.chars() {
            match c {
                '[' | '(' => depth += 1,
                ']' | ')' if depth > 0 => depth -= 1,
                _ if depth == 0 => kept.push(c),
                _ => {}
            }
        }
        // Keeps what was in brackets when the whole segment is not one (words said "(like this)"
        // are rare in a dictation, the markers are not): only a segment that is nothing but
        // markers goes.
        let text = if kept.trim().is_empty() {
            String::new()
        } else if s.trim_start().starts_with(['[', '(']) && s.trim_end().ends_with([']', ')']) {
            kept
        } else {
            s.clone()
        };
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if text.is_empty() {
            continue;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(&text);
    }
    out
}

impl Transcriber for Whisper {
    fn transcribe(
        &self,
        model: &Path,
        samples: &[f32],
        language: &str,
        cancel: &Arc<AtomicBool>,
    ) -> Result<String> {
        use whisper_rs::{FullParams, SamplingStrategy};
        let ctx = self.context(model)?;
        let mut state = ctx
            .create_state()
            .map_err(|e| anyhow!("whisper state: {e}"))?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some(language));
        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .clamp(1, 8);
        params.set_n_threads(threads as i32);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_no_context(true);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);
        // Whisper wants a second at least: a shorter one is padded with silence.
        let padded;
        let samples = if samples.len() < 16_000 {
            padded = [samples, &vec![0f32; 16_000 - samples.len()][..]].concat();
            &padded[..]
        } else {
            samples
        };
        // The raw callback: whisper-rs 0.16's `set_abort_callback_safe` hands its closure a
        // pointer of another type, which reads garbage and stops every encoding at once.
        unsafe extern "C" fn aborted(data: *mut std::ffi::c_void) -> bool {
            // SAFETY: `data` is the `AtomicBool` of `cancel`, alive until `full` returns.
            unsafe { (*(data as *const AtomicBool)).load(Ordering::Acquire) }
        }
        // SAFETY: the pointer is to `cancel`, borrowed for the whole call of `full` below.
        unsafe {
            params.set_abort_callback(Some(aborted));
            params.set_abort_callback_user_data(Arc::as_ptr(cancel) as *mut std::ffi::c_void);
        }
        let started = std::time::Instant::now();
        state
            .full(params, samples)
            .map_err(|e| anyhow!("transcription failed: {e}"))?;
        if cancel.load(Ordering::Acquire) {
            return Err(anyhow!("cancelled"));
        }
        let segments: Vec<String> = state
            .as_iter()
            .map(|s| s.to_str_lossy().map(|t| t.into_owned()).unwrap_or_default())
            .collect();
        log::info!(
            "voice: {:.1} s of sound transcribed in {} ms ({} threads)",
            samples.len() as f32 / 16_000.0,
            started.elapsed().as_millis(),
            threads
        );
        Ok(clean(&segments))
    }

    fn preload(&self, model: &Path) {
        if let Err(e) = self.context(model) {
            log::warn!("voice: {e:#}");
        }
    }

    fn unload(&self, model: &Path) {
        let mut loaded = self.loaded.lock();
        if loaded.as_ref().is_some_and(|(p, _)| p == model) {
            *loaded = None;
        }
    }
}

/// A transcriber that says what it was given: the end-to-end tests (`ESCOUADE_VOICE_TRANSCRIPT`,
/// debug builds only), and the unit tests, which have no model.
pub struct Fake {
    pub text: String,
    /// What it was asked, for the tests: the number of samples and the language of each call.
    pub calls: Mutex<Vec<(usize, String)>>,
    /// How long it takes.
    pub delay: std::time::Duration,
}

impl Fake {
    pub fn new(text: &str) -> Self {
        Self {
            text: text.into(),
            calls: Mutex::new(Vec::new()),
            delay: std::time::Duration::ZERO,
        }
    }
}

impl Transcriber for Fake {
    fn transcribe(
        &self,
        model: &Path,
        samples: &[f32],
        language: &str,
        cancel: &Arc<AtomicBool>,
    ) -> Result<String> {
        if !model.exists() {
            return Err(anyhow!("no model at {}", model.display()));
        }
        self.calls
            .lock()
            .push((samples.len(), language.to_string()));
        let end = std::time::Instant::now() + self.delay;
        while std::time::Instant::now() < end {
            if cancel.load(Ordering::Acquire) {
                return Err(anyhow!("cancelled"));
            }
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        Ok(self.text.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(s: &[&str]) -> Vec<String> {
        s.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn the_segments_join_into_one_line_without_the_markers_of_no_speech() {
        assert_eq!(
            clean(&v(&[" Bonjour,", "  ajoute un test ", "[BLANK_AUDIO]"])),
            "Bonjour, ajoute un test"
        );
        assert_eq!(clean(&v(&["(musique)", " [Applause] "])), "");
        assert_eq!(clean(&v(&[])), "");
        // Words in brackets within a sentence are the user's.
        assert_eq!(
            clean(&v(&[" Lance les tests (tous) puis commite."])),
            "Lance les tests (tous) puis commite."
        );
    }
}
