//! Dictation: the microphone listened to on the backend's side (cpal), the sound brought to what
//! Whisper takes (mono, 16 kHz), its level told to the window while it listens, then transcribed
//! on the machine (whisper.cpp, on a thread of its own) once the user stops. Nothing leaves the
//! machine but the download of a model, through the proxy of the settings.
//!
//! One listening at a time, for the whole app: it stops when the user says so, when the window is
//! closed or reloaded, when the app quits, and after `MAX_LISTEN`. The text goes back to the window,
//! which puts it where the user dictated (the composer at its cursor, a ticket's description, the
//! terminal of the Claude Code view); it is never sent by itself.

pub mod audio;
pub mod models;
pub mod source;
pub mod speech;
#[cfg(test)]
mod tests;
pub mod transcribe;
pub mod vad;

use crate::i18n::Lang;
use models::{ModelView, Store};
use parking_lot::Mutex;
use serde::Serialize;
use source::{Capture, Device, Sink, Source};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use transcribe::Transcriber;

/// A listening stops by itself after this long: the sound kept would grow without end otherwise.
pub const MAX_LISTEN: Duration = Duration::from_secs(10 * 60);

/// How often the level is told to the window.
const TICK: Duration = Duration::from_millis(50);

/// What went wrong, as the window tells it: each with what to do about it.
#[derive(Debug, Clone, PartialEq)]
pub enum VoiceError {
    /// No microphone at all (or the one chosen and the system's both gone).
    NoDevice,
    /// The system keeps the microphone from the app.
    Denied,
    /// Another app holds it.
    Busy,
    /// No sound system answers (Linux: neither PulseAudio, PipeWire nor ALSA).
    NoAudioSystem,
    /// It listened, but not one sample was not zero: what macOS gives an app it keeps the
    /// microphone from (it refuses nothing), and a muted one.
    Silent,
    /// Already listening.
    AlreadyListening,
    Other(String),
}

impl VoiceError {
    /// What the window says, in `lang`, on `os` ("windows", "macos", "linux").
    pub fn message(&self, lang: Lang, os: &str) -> String {
        match self {
            VoiceError::NoDevice => tr_in!(
                lang,
                "Aucun micro trouvé. Branche un micro, ou choisis-en un dans Réglages › Voix.",
                "No microphone found. Plug one in, or pick one in Settings › Voice."
            ),
            VoiceError::Denied | VoiceError::Silent => {
                let steps = match (os, lang) {
                    ("macos", Lang::Fr) => "ouvre Réglages Système › Confidentialité et sécurité › Microphone, coche Escouade, puis relance l’app.",
                    ("macos", Lang::En) => "open System Settings › Privacy & Security › Microphone, tick Escouade, then restart the app.",
                    ("windows", Lang::Fr) => "ouvre Paramètres › Confidentialité et sécurité › Microphone, et allume « Accès au microphone » puis « Autoriser les applications de bureau à accéder à votre microphone ».",
                    ("windows", Lang::En) => "open Settings › Privacy & security › Microphone, and turn on “Microphone access”, then “Let desktop apps access your microphone”.",
                    (_, Lang::Fr) => "vérifie que PulseAudio ou PipeWire tourne, que le micro n’est pas coupé (pavucontrol, ou les réglages du son), et que ton compte peut s’en servir (groupe audio).",
                    (_, Lang::En) => "check that PulseAudio or PipeWire is running, that the microphone is not muted (pavucontrol, or the sound settings), and that your account may use it (audio group).",
                };
                if *self == VoiceError::Silent {
                    tr_in!(lang, "Aucun son n’est arrivé du micro : il est coupé, ou le système le refuse à Escouade. Pour l’autoriser, {steps}", "No sound came from the microphone: it is muted, or the system keeps it from Escouade. To allow it, {steps}")
                } else {
                    tr_in!(lang, "Le système refuse le micro à Escouade. Pour l’autoriser, {steps}", "The system keeps the microphone from Escouade. To allow it, {steps}")
                }
            }
            VoiceError::Busy => tr_in!(
                lang,
                "Le micro est pris par une autre application. Ferme-la, ou choisis un autre micro dans Réglages › Voix.",
                "The microphone is taken by another app. Close it, or pick another microphone in Settings › Voice."
            ),
            VoiceError::NoAudioSystem => tr_in!(
                lang,
                "Aucun système de son ne répond. Démarre PulseAudio ou PipeWire (ou vérifie ALSA), puis réessaie.",
                "No sound system answers. Start PulseAudio or PipeWire (or check ALSA), then try again."
            ),
            VoiceError::AlreadyListening => tr_in!(lang, "Une dictée est déjà en cours.", "A dictation is already under way."),
            VoiceError::Other(e) => tr_in!(lang, "La dictée a échoué : {e}", "Dictation failed: {e}"),
        }
    }
}

impl std::fmt::Display for VoiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message(Lang::En, std::env::consts::OS))
    }
}

/// What the window is told while it listens and downloads.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VoiceEvent {
    /// How loud it is now (0 to 1), and for how long it has listened.
    #[serde(rename_all = "camelCase")]
    Level { session: u64, level: f32, ms: u64 },
    /// It stopped listening by itself (`MAX_LISTEN`, the microphone gone): `error` says why when it
    /// failed. The window then asks for the text (`stop`), or drops it.
    #[serde(rename_all = "camelCase")]
    Ended { session: u64, error: Option<String> },
    /// A model's download: bytes so far, of `total`.
    #[serde(rename_all = "camelCase")]
    Download {
        model: String,
        done: u64,
        total: u64,
    },
}

/// What `start` answers.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Started {
    /// It listens.
    Listening { session: u64 },
    /// The model must be downloaded first: its size, for the window to ask.
    NeedsModel { model: String, size: u64 },
}

/// What a listening is asked to use, from the settings.
#[derive(Debug, Clone)]
pub struct Choice {
    pub device: String,
    pub model: String,
    /// Whisper's code, or "auto".
    pub language: String,
}

/// The language Whisper is told: the setting's ("ui": the interface's, "auto": found by Whisper).
pub fn whisper_language(setting: &str, ui: Lang) -> String {
    match setting.trim() {
        "" | "ui" => match ui {
            Lang::Fr => "fr".into(),
            Lang::En => "en".into(),
        },
        other => other.to_string(),
    }
}

struct Session {
    id: u64,
    /// Shared with the ticker, which lets the microphone go when the listening ends by itself.
    capture: Arc<Mutex<Option<Box<dyn Capture>>>>,
    samples: Arc<Mutex<Vec<f32>>>,
    rate: u32,
    /// Set, the ticker stops.
    done: Arc<AtomicBool>,
    model: PathBuf,
    language: String,
}

/// How the window is told, and in what language.
pub type Emit = Arc<dyn Fn(VoiceEvent) + Send + Sync>;

pub struct Voice {
    source: Box<dyn Source>,
    transcriber: Arc<dyn Transcriber>,
    pub store: Store,
    /// Where the models are downloaded from (`models::MODELS_URL`; a fake server in tests).
    pub models_url: String,
    emit: Emit,
    session: Mutex<Option<Session>>,
    next: AtomicU64,
    /// The transcription under way, its cancel flag.
    transcribing: Mutex<Option<Arc<AtomicBool>>>,
    /// The downloads under way, by model, their cancel flags.
    downloads: Mutex<HashMap<String, Arc<AtomicBool>>>,
    /// A start is opening the microphone.
    opening: AtomicBool,
    /// Called off while the microphone opened: it is let go as soon as it is open.
    called_off: AtomicBool,
    max_listen: Duration,
}

impl Voice {
    pub fn new(
        source: Box<dyn Source>,
        transcriber: Arc<dyn Transcriber>,
        store: Store,
        models_url: String,
        emit: Emit,
    ) -> Self {
        Self {
            source,
            transcriber,
            store,
            models_url,
            emit,
            session: Mutex::new(None),
            next: AtomicU64::new(1),
            transcribing: Mutex::new(None),
            downloads: Mutex::new(HashMap::new()),
            max_listen: MAX_LISTEN,
            opening: AtomicBool::new(false),
            called_off: AtomicBool::new(false),
        }
    }

    #[cfg(test)]
    pub fn with_max_listen(mut self, d: Duration) -> Self {
        self.max_listen = d;
        self
    }

    /// The app's: the microphone and whisper.cpp; in a debug build, `ESCOUADE_VOICE_WAV` plays a
    /// WAV file in place of the microphone, `ESCOUADE_VOICE_TRANSCRIPT` gives its text in place of
    /// Whisper, and `ESCOUADE_VOICE_MODELS_URL` is where the models come from (end-to-end tests).
    pub fn for_app(data: PathBuf, emit: Emit) -> Self {
        whisper_rs::install_logging_hooks();
        let var = |k: &str| {
            if cfg!(debug_assertions) {
                std::env::var(k).ok().filter(|v| !v.trim().is_empty())
            } else {
                None
            }
        };
        let source: Box<dyn Source> = match var("ESCOUADE_VOICE_WAV") {
            Some(wav) => Box::new(source::WavFile(wav.into())),
            None => Box::new(source::Microphone),
        };
        let transcriber: Arc<dyn Transcriber> = match var("ESCOUADE_VOICE_TRANSCRIPT") {
            Some(text) => Arc::new(transcribe::Fake::new(&text)),
            None => Arc::new(transcribe::Whisper::default()),
        };
        let url = var("ESCOUADE_VOICE_MODELS_URL").unwrap_or_else(|| models::MODELS_URL.into());
        Self::new(
            source,
            transcriber,
            Store {
                dir: data.join("voice").join("models"),
            },
            url,
            emit,
        )
    }

    pub fn devices(&self) -> Vec<Device> {
        self.source.devices()
    }

    pub fn models(&self) -> Vec<ModelView> {
        self.store.list()
    }

    #[cfg(test)]
    pub fn listening(&self) -> Option<u64> {
        self.session.lock().as_ref().map(|s| s.id)
    }

    /// Starts listening with `choice`, unless the model is missing (the window asks to download it
    /// first) or a listening is already under way.
    pub fn start(&self, choice: &Choice) -> Result<Started, VoiceError> {
        let model = models::find(&choice.model)
            .or_else(|| models::find(models::DEFAULT_MODEL))
            .expect("the default model is in the catalog");
        if !self.store.has(model) {
            return Ok(Started::NeedsModel {
                model: model.id.into(),
                size: model.size,
            });
        }
        // Not held while the microphone opens (macOS asks the user first): a window closed
        // meanwhile is not kept waiting. `opening` keeps a second start out until then.
        if self.session.lock().is_some() || self.opening.swap(true, Ordering::AcqRel) {
            return Err(VoiceError::AlreadyListening);
        }
        self.called_off.store(false, Ordering::Release);
        let opened = self.open(choice, model);
        self.opening.store(false, Ordering::Release);
        opened
    }

    fn open(&self, choice: &Choice, model: &models::ModelInfo) -> Result<Started, VoiceError> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let samples = Arc::new(Mutex::new(Vec::<f32>::new()));
        let peak = Arc::new(AtomicU32::new(0));
        let failure = Arc::new(Mutex::new(None::<VoiceError>));
        let sink = {
            let samples = samples.clone();
            let peak = peak.clone();
            let failure = failure.clone();
            Sink {
                samples: Box::new(move |chunk: &[f32]| {
                    let l = audio::level(chunk);
                    peak.fetch_max(l.to_bits(), Ordering::Relaxed);
                    samples.lock().extend_from_slice(chunk);
                }),
                error: Box::new(move |e| {
                    failure.lock().get_or_insert(e);
                }),
            }
        };
        let capture = self.source.open(&choice.device, sink)?;
        let rate = capture.rate();
        log::info!("voice: listening at {rate} Hz");
        let done = Arc::new(AtomicBool::new(false));
        let capture = Arc::new(Mutex::new(Some(capture)));
        let model_path = self.store.path(model.id);
        let mut slot = self.session.lock();
        if slot.is_some() {
            return Err(VoiceError::AlreadyListening);
        }
        if self.called_off.load(Ordering::Acquire) {
            log::info!("voice: listening called off");
            return Err(VoiceError::Other("called off".into()));
        }
        // Loaded while the user speaks: the text comes sooner once they stop.
        {
            let t = self.transcriber.clone();
            let p = model_path.clone();
            std::thread::spawn(move || t.preload(&p));
        }
        *slot = Some(Session {
            id,
            capture: capture.clone(),
            samples,
            rate,
            done: done.clone(),
            model: model_path,
            language: choice.language.clone(),
        });
        drop(slot);
        let emit = self.emit.clone();
        let max = self.max_listen;
        let started = Instant::now();
        std::thread::Builder::new()
            .name("voice-level".into())
            .spawn(move || {
                while !done.load(Ordering::Acquire) {
                    std::thread::sleep(TICK);
                    if done.load(Ordering::Acquire) {
                        return;
                    }
                    // Positive floats order as their bits do.
                    let level = f32::from_bits(peak.swap(0, Ordering::Relaxed));
                    let ms = started.elapsed().as_millis() as u64;
                    emit(VoiceEvent::Level {
                        session: id,
                        level,
                        ms,
                    });
                    let failed = failure.lock().take();
                    if failed.is_some() || started.elapsed() >= max {
                        drop(capture.lock().take());
                        emit(VoiceEvent::Ended {
                            session: id,
                            error: failed
                                .map(|e| e.message(crate::i18n::ui(), std::env::consts::OS)),
                        });
                        return;
                    }
                }
            })
            .map_err(|e| VoiceError::Other(e.to_string()))?;
        Ok(Started::Listening { session: id })
    }

    /// Stops listening (the session `id`, if it is the one under way) and transcribes what was
    /// heard: blocks until the text is there (call it off the async runtime). Empty when nothing
    /// was said.
    pub fn stop(&self, id: u64) -> Result<String, VoiceError> {
        let session = {
            let mut slot = self.session.lock();
            match slot.as_ref() {
                Some(s) if s.id == id => slot.take().unwrap(),
                _ => return Err(VoiceError::Other("no dictation under way".into())),
            }
        };
        session.done.store(true, Ordering::Release);
        // The microphone is let go before the transcription, which may take seconds.
        drop(session.capture.lock().take());
        let heard = std::mem::take(&mut *session.samples.lock());
        let secs = heard.len() as f32 / session.rate.max(1) as f32;
        log::info!("voice: {secs:.1} s heard");
        if heard.is_empty() {
            return Ok(String::new());
        }
        // Half a second of nothing but zeros: kept from the app, not quiet (a quiet room is
        // never digital silence).
        if secs >= 0.5 && audio::all_zero(&heard) {
            return Err(VoiceError::Silent);
        }
        let pcm = audio::resample(&heard, session.rate, audio::WHISPER_RATE);
        drop(heard);
        // Under a tenth of a second: a click, nothing said.
        if pcm.len() < audio::WHISPER_RATE as usize / 10 {
            return Ok(String::new());
        }
        let cancel = Arc::new(AtomicBool::new(false));
        *self.transcribing.lock() = Some(cancel.clone());
        let result = self
            .transcriber
            .transcribe(&session.model, &pcm, &session.language, &cancel);
        self.transcribing.lock().take();
        if cancel.load(Ordering::Acquire) {
            return Ok(String::new());
        }
        result.map_err(|e| VoiceError::Other(format!("{e:#}")))
    }

    /// Stops everything: the listening (its sound dropped) and the transcription under way. The
    /// window closed or reloaded, the app quitting, the user's Escape.
    pub fn cancel(&self) {
        if self.opening.load(Ordering::Acquire) {
            self.called_off.store(true, Ordering::Release);
        }
        if let Some(s) = self.session.lock().take() {
            s.done.store(true, Ordering::Release);
            drop(s.capture.lock().take());
            log::info!("voice: listening called off");
        }
        if let Some(c) = self.transcribing.lock().as_ref() {
            c.store(true, Ordering::Release);
        }
    }

    /// Everything stops for good: what the app does as it quits, the downloads too.
    pub fn shutdown(&self) {
        self.cancel();
        for flag in self.downloads.lock().values() {
            flag.store(true, Ordering::Release);
        }
    }

    /// Downloads the model `id` through `client`, its progress told to the window.
    pub async fn download(&self, client: &reqwest::Client, id: &str) -> anyhow::Result<()> {
        let Some(m) = models::find(id) else {
            anyhow::bail!("unknown model {id}");
        };
        if self.store.has(m) {
            return Ok(());
        }
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut downloads = self.downloads.lock();
            if downloads.contains_key(id) {
                anyhow::bail!(tr!(
                    "Ce modèle est déjà en cours de téléchargement.",
                    "This model is already being downloaded."
                ));
            }
            downloads.insert(id.to_string(), cancel.clone());
        }
        let emit = self.emit.clone();
        let total = m.size;
        let model = m.id.to_string();
        let r = self
            .store
            .download(client, &self.models_url, m, &cancel, |done| {
                emit(VoiceEvent::Download {
                    model: model.clone(),
                    done,
                    total,
                })
            })
            .await;
        self.downloads.lock().remove(id);
        match r {
            Ok(_) => Ok(()),
            Err(e) if e.is::<models::ChecksumMismatch>() => Err(anyhow::anyhow!(tr!(
                "Le fichier téléchargé n’est pas le bon modèle (somme de contrôle différente) : il n’est pas gardé. Réessaie ; derrière un proxy qui modifie les fichiers, télécharge-le ailleurs.",
                "The file downloaded is not the right model (checksum mismatch): it was not kept. Try again; behind a proxy that alters files, download it elsewhere."
            ))),
            Err(e) => Err(e),
        }
    }

    /// Calls off the download of `id`, if one is under way.
    pub fn cancel_download(&self, id: &str) {
        if let Some(flag) = self.downloads.lock().get(id) {
            flag.store(true, Ordering::Release);
        }
    }

    pub fn delete_model(&self, id: &str) -> anyhow::Result<()> {
        if models::find(id).is_none() {
            anyhow::bail!("unknown model {id}");
        }
        self.cancel_download(id);
        let path = self.store.path(id);
        self.transcriber.unload(&path);
        self.store.delete(id)
    }
}
