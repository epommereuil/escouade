//! The conversation (ESC-97): the microphone stays open from « Conversation » to « Arrêter ». While it listens, a
//! sentence is found by its silence (`vad::Endpointer`), transcribed by Whisper, and its text told to the window, which
//! sends it to the agent. While the agent's passage is read aloud (`speak`), what the microphone hears is never
//! transcribed: it only tells whether the user speaks over the agent (`vad::BargeIn`, which knows the echo of its
//! voice), which stops the reading and listens. Once the reading is over, it listens again, after the echo's tail.
//!
//! The window leads (`conversation.svelte.ts`): it says when to listen, to hold (the agent works), and what to read.

use super::speech::output::Playing;
use super::speech::SpeakOptions;
use super::vad::{self, BargeIn, Endpointer, Heard};
use super::{audio, Voice, VoiceError, VoiceEvent};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// What a conversation is asked to use, from the settings.
#[derive(Debug, Clone)]
pub struct ConvChoice {
    pub device: String,
    /// Whisper's model and the language it is told.
    pub model: String,
    pub language: String,
    /// The voice that reads (`speech::catalog`), its speaker, pace and volume.
    pub voice: String,
    pub speak: SpeakOptions,
    pub volume: f32,
    /// The silence that ends a sentence, in milliseconds.
    pub silence_ms: u32,
}

/// What `conversation_start` answers.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ConvStarted {
    Listening {
        session: u64,
    },
    /// Whisper's model must be downloaded first.
    NeedsModel {
        model: String,
        size: u64,
    },
    /// The voice must be downloaded first.
    NeedsVoice {
        voice: String,
        size: u64,
    },
    /// No speech on this machine (Intel Macs).
    Unavailable,
}

/// What the conversation does with what the microphone hears.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mode {
    /// Waits for a sentence, and takes it.
    Listening,
    /// Hears nothing: the agent works, a sentence is being transcribed.
    Holding,
    /// Reads aloud: only listens for the user speaking over it.
    Speaking,
    /// The reading is over: listens again once the echo's tail has passed.
    After(Instant),
}

/// The echo of the reading's last words, which the microphone still hears.
const TAIL: Duration = Duration::from_millis(300);
/// What is kept from before a sentence's start: its first syllables.
const PREROLL_FRAMES: usize = 50;

/// What the threads of a conversation share.
struct Shared {
    id: u64,
    mode: Mutex<Mode>,
    endpointer: Mutex<Endpointer>,
    barge: Mutex<Option<BargeIn>>,
    /// The reading under way, and the one it is (`speak`'s count).
    playing: Mutex<Option<Arc<dyn Playing>>>,
    reading: AtomicU64,
    /// Set, the reading under way stops making sentences.
    hush: Mutex<Arc<AtomicBool>>,
    /// Samples heard, not yet cut into frames.
    pending: Mutex<Vec<f32>>,
    done: AtomicBool,
    choice: ConvChoice,
    model: PathBuf,
    voice: PathBuf,
}

pub(super) struct Conversation {
    shared: Arc<Shared>,
    capture: Mutex<Option<Box<dyn super::source::Capture>>>,
}

impl Voice {
    #[cfg(test)]
    pub fn conversing(&self) -> Option<u64> {
        self.conv.lock().as_ref().map(|c| c.shared.id)
    }

    /// Starts a conversation: the microphone opens and listens for a sentence; or says what is missing first.
    pub fn conversation_start(&self, choice: ConvChoice) -> Result<ConvStarted, VoiceError> {
        if !self.engine.available() {
            return Ok(ConvStarted::Unavailable);
        }
        let model = super::models::find(&choice.model)
            .or_else(|| super::models::find(super::models::DEFAULT_MODEL))
            .expect("the default model is in the catalog");
        if !self.store.has(model) {
            return Ok(ConvStarted::NeedsModel {
                model: model.id.into(),
                size: model.size,
            });
        }
        let Some(voice) = super::speech::catalog::find(&choice.voice) else {
            return Err(VoiceError::Other(format!("unknown voice {}", choice.voice)));
        };
        if !self.voices.has(voice) {
            return Ok(ConvStarted::NeedsVoice {
                voice: voice.id.clone(),
                size: voice.onnx_size + voice.json_size,
            });
        }
        if self.session.lock().is_some() || self.conv.lock().is_some() {
            return Err(VoiceError::AlreadyListening);
        }
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let shared = Arc::new(Shared {
            id,
            mode: Mutex::new(Mode::Listening),
            endpointer: Mutex::new(Endpointer::new(choice.silence_ms.clamp(400, 5000))),
            barge: Mutex::new(None),
            playing: Mutex::new(None),
            reading: AtomicU64::new(0),
            hush: Mutex::new(Arc::new(AtomicBool::new(false))),
            pending: Mutex::new(Vec::new()),
            done: AtomicBool::new(false),
            model: self.store.path(model.id),
            voice: self.voices.model(&voice.id),
            choice,
        });
        let failure = Arc::new(Mutex::new(None::<VoiceError>));
        let sink = {
            let shared = shared.clone();
            let failure = failure.clone();
            super::source::Sink {
                samples: Box::new(move |chunk: &[f32]| {
                    shared.pending.lock().extend_from_slice(chunk)
                }),
                error: Box::new(move |e| {
                    failure.lock().get_or_insert(e);
                }),
            }
        };
        let capture = self.source.open(&shared.choice.device, sink)?;
        let rate = capture.rate();
        log::info!("voice: conversation listening at {rate} Hz");
        {
            let t = self.transcriber.clone();
            let p = shared.model.clone();
            std::thread::spawn(move || t.preload(&p));
        }
        *self.conv.lock() = Some(Conversation {
            shared: shared.clone(),
            capture: Mutex::new(Some(capture)),
        });
        let emit = self.emit.clone();
        let transcriber = self.transcriber.clone();
        std::thread::Builder::new()
            .name("voice-conversation".into())
            .spawn(move || listen(shared, rate, failure, emit, transcriber))
            .map_err(|e| VoiceError::Other(e.to_string()))?;
        Ok(ConvStarted::Listening { session: id })
    }

    fn conv_shared(&self, session: u64) -> Option<Arc<Shared>> {
        self.conv
            .lock()
            .as_ref()
            .filter(|c| c.shared.id == session)
            .map(|c| c.shared.clone())
    }

    /// Listens for the next sentence (the agent's turn is over, or nothing was read).
    pub fn conversation_listen(&self, session: u64) {
        if let Some(s) = self.conv_shared(session) {
            hush(&s);
            *s.mode.lock() = Mode::Listening;
        }
    }

    /// Hears nothing until told to listen or to speak: the agent works.
    pub fn conversation_hold(&self, session: u64) {
        if let Some(s) = self.conv_shared(session) {
            *s.mode.lock() = Mode::Holding;
        }
    }

    /// Reads `text` aloud in the conversation's voice; once read, listens again (`Spoken`), or listens at once when
    /// the user speaks over it (`BargeIn`). Returns the reading's number, which those events carry.
    pub fn conversation_say(&self, session: u64, text: &str) -> Result<u64, VoiceError> {
        let s = self
            .conv_shared(session)
            .ok_or_else(|| VoiceError::Other("no conversation under way".into()))?;
        hush(&s);
        let reading = s.reading.fetch_add(1, Ordering::AcqRel) + 1;
        let stop = Arc::new(AtomicBool::new(false));
        *s.hush.lock() = stop.clone();
        *s.barge.lock() = Some(BargeIn::new(s.endpointer.lock().noise()));
        *s.mode.lock() = Mode::Speaking;
        let engine = self.engine.clone();
        let output = self.output.clone();
        let emit = self.emit.clone();
        let sentences = engine.sentences(text);
        std::thread::Builder::new()
            .name("voice-speak".into())
            .spawn(move || {
                let mut error = None;
                for sentence in sentences {
                    if stop.load(Ordering::Acquire) {
                        return;
                    }
                    let audio = match engine.synthesize(&s.voice, &sentence, &s.choice.speak) {
                        Ok(a) => a,
                        Err(e) => {
                            error = Some(format!("{e:#}"));
                            break;
                        }
                    };
                    if stop.load(Ordering::Acquire) {
                        return;
                    }
                    let mut slot = s.playing.lock();
                    // Stopped while the lock was awaited: the next reading may hold the output by now.
                    if stop.load(Ordering::Acquire) {
                        return;
                    }
                    if slot.is_none() {
                        let done = {
                            let s = s.clone();
                            let emit = emit.clone();
                            Box::new(move || {
                                if s.reading.load(Ordering::Acquire) != reading {
                                    return;
                                }
                                let mut mode = s.mode.lock();
                                if *mode == Mode::Speaking {
                                    *mode = Mode::After(Instant::now());
                                    drop(mode);
                                    emit(VoiceEvent::ConvSpoken {
                                        session: s.id,
                                        reading,
                                        error: None,
                                    });
                                }
                            })
                        };
                        match output.open(audio.rate, s.choice.volume, done) {
                            Ok(p) => *slot = Some(p),
                            Err(e) => {
                                error = Some(e);
                                break;
                            }
                        }
                    }
                    slot.as_ref().unwrap().push(&audio.samples);
                }
                log::info!("speech: reading {reading} made");
                let playing = s.playing.lock().clone();
                match (playing, error) {
                    (Some(p), None) => p.finish(),
                    (_, error) => {
                        // Nothing to hear (an empty text), or it failed: it listens again at once.
                        if s.reading.load(Ordering::Acquire) == reading
                            && !stop.load(Ordering::Acquire)
                        {
                            if let Some(e) = &error {
                                log::warn!("speech: {e}");
                            }
                            s.playing.lock().take();
                            *s.mode.lock() = Mode::Listening;
                            emit(VoiceEvent::ConvSpoken {
                                session: s.id,
                                reading,
                                error,
                            });
                        }
                    }
                }
            })
            .map_err(|e| VoiceError::Other(e.to_string()))?;
        Ok(reading)
    }

    /// « Arrêter »: the reading and the listening stop, the microphone is let go.
    pub fn conversation_stop(&self) {
        if let Some(c) = self.conv.lock().take() {
            hush(&c.shared);
            c.shared.done.store(true, Ordering::Release);
            drop(c.capture.lock().take());
            log::info!("voice: conversation stopped");
        }
    }
}

/// The reading under way stops: no more sentences made, nothing more heard.
fn hush(s: &Shared) {
    s.hush.lock().store(true, Ordering::Release);
    s.playing.lock().take();
}

/// The conversation's ear: frames of 20 ms, taken as its mode says.
fn listen(
    s: Arc<Shared>,
    rate: u32,
    failure: Arc<Mutex<Option<VoiceError>>>,
    emit: super::Emit,
    transcriber: Arc<dyn super::transcribe::Transcriber>,
) {
    let per = (rate * vad::FRAME_MS / 1000).max(1) as usize;
    let mut buf: Vec<f32> = Vec::new();
    let mut recent: VecDeque<Vec<f32>> = VecDeque::new();
    let mut sentence: Option<Vec<f32>> = None;
    let mut peak = 0f32;
    let mut told = Instant::now();
    while !s.done.load(Ordering::Acquire) {
        std::thread::sleep(Duration::from_millis(vad::FRAME_MS as u64));
        if let Some(e) = failure.lock().take() {
            emit(VoiceEvent::ConvEnded {
                session: s.id,
                error: Some(e.message(crate::i18n::ui(), std::env::consts::OS)),
            });
            s.done.store(true, Ordering::Release);
            hush(&s);
            return;
        }
        buf.extend(std::mem::take(&mut *s.pending.lock()));
        let whole = buf.len() / per * per;
        let frames: Vec<Vec<f32>> = buf
            .drain(..whole)
            .collect::<Vec<_>>()
            .chunks(per)
            .map(<[f32]>::to_vec)
            .collect();
        for frame in frames {
            let level = vad::rms(&frame);
            peak = peak.max(level);
            recent.push_back(frame.clone());
            if recent.len() > PREROLL_FRAMES {
                recent.pop_front();
            }
            let mode = *s.mode.lock();
            match mode {
                Mode::Holding => {}
                Mode::After(at) => {
                    if at.elapsed() >= TAIL {
                        let mut m = s.mode.lock();
                        if *m == mode {
                            *m = Mode::Listening;
                        }
                    }
                }
                Mode::Speaking => {
                    let played = s.playing.lock().as_ref().map(|p| p.level()).unwrap_or(0.0);
                    let over = s
                        .barge
                        .lock()
                        .as_mut()
                        .is_some_and(|b| b.push(level, played));
                    if over {
                        hush(&s);
                        *s.mode.lock() = Mode::Listening;
                        s.endpointer.lock().start_in_sentence();
                        // What the barge-in heard of the user is the sentence's start (with the echo's last bits).
                        let keep = recent.len().min(20);
                        sentence = Some(
                            recent
                                .iter()
                                .skip(recent.len() - keep)
                                .flatten()
                                .copied()
                                .collect(),
                        );
                        emit(VoiceEvent::ConvBargeIn {
                            session: s.id,
                            reading: s.reading.load(Ordering::Acquire),
                        });
                    }
                }
                Mode::Listening => {
                    let heard = s.endpointer.lock().push(level);
                    if let Some(sent) = sentence.as_mut() {
                        sent.extend_from_slice(&frame);
                    }
                    match heard {
                        Some(Heard::Started { frames_ago }) => {
                            let keep = (frames_ago + 5).min(recent.len());
                            sentence = Some(
                                recent
                                    .iter()
                                    .skip(recent.len() - keep)
                                    .flatten()
                                    .copied()
                                    .collect(),
                            );
                            emit(VoiceEvent::ConvSpeech { session: s.id });
                        }
                        Some(Heard::Ended) => {
                            let said = sentence.take().unwrap_or_default();
                            *s.mode.lock() = Mode::Holding;
                            emit(VoiceEvent::ConvTranscribing { session: s.id });
                            let s2 = s.clone();
                            let emit = emit.clone();
                            let t = transcriber.clone();
                            std::thread::spawn(move || {
                                let pcm = audio::resample(&said, rate, audio::WHISPER_RATE);
                                let never = Arc::new(AtomicBool::new(false));
                                let text = t
                                    .transcribe(&s2.model, &pcm, &s2.choice.language, &never)
                                    .map_err(|e| format!("{e:#}"));
                                if s2.done.load(Ordering::Acquire) {
                                    return;
                                }
                                let (text, error) = match text {
                                    Ok(t) => (t.trim().to_string(), None),
                                    Err(e) => (String::new(), Some(e)),
                                };
                                emit(VoiceEvent::ConvHeard {
                                    session: s2.id,
                                    text,
                                    error,
                                });
                            });
                        }
                        None => {}
                    }
                }
            }
        }
        if told.elapsed() >= Duration::from_millis(50) {
            told = Instant::now();
            emit(VoiceEvent::ConvLevel {
                session: s.id,
                level: audio::level(&[peak]),
            });
            peak = 0.0;
        }
    }
}
