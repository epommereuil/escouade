//! Where the agent's voice is heard: the system's speakers through cpal, or nowhere (a clock that plays it in silence:
//! the tests, the end-to-end tests, a machine without speakers). The sentences are pushed as they are made; the end is
//! told once the last one was heard; and the level of what is played now is kept, for the barge-in to tell the agent's
//! echo from the user.

use crate::voice::audio;
use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;

/// Told once everything pushed was played, after `finish`.
pub type Done = Box<dyn FnOnce() + Send>;

/// A playback under way: dropped, it stops at once (the end is not told).
pub trait Playing: Send + Sync {
    /// More to play, at the rate it was opened with.
    fn push(&self, samples: &[f32]);
    /// Nothing more will be pushed: the end is told once all is played.
    fn finish(&self);
    /// How loud what was played last is (RMS, before the volume).
    fn level(&self) -> f32;
}

pub trait Output: Send + Sync {
    /// Opens a playback of mono samples at `rate`, at `volume` (0 to 1).
    fn open(&self, rate: u32, volume: f32, done: Done) -> Result<Arc<dyn Playing>, String>;
}

/// What is to be played, shared by the one who pushes and the one who plays.
struct Queue {
    inner: Mutex<Inner>,
    level: AtomicU32,
    volume: f32,
    /// Pushed samples are brought from the voice's rate to the device's.
    from: u32,
    to: u32,
}

struct Inner {
    buf: VecDeque<f32>,
    finished: bool,
    done: Option<Done>,
}

impl Queue {
    fn new(from: u32, to: u32, volume: f32, done: Done) -> Self {
        Self {
            inner: Mutex::new(Inner {
                buf: VecDeque::new(),
                finished: false,
                done: Some(done),
            }),
            level: AtomicU32::new(0),
            volume: volume.clamp(0.0, 1.0),
            from,
            to,
        }
    }

    /// Fills `out` (mono, the device's rate) with what comes next, silence once nothing is left.
    fn pull(&self, out: &mut [f32]) {
        let done = {
            let mut q = self.inner.lock();
            let mut sum = 0f32;
            let mut n = 0usize;
            for o in out.iter_mut() {
                match q.buf.pop_front() {
                    Some(s) => {
                        sum += s * s;
                        n += 1;
                        *o = s * self.volume;
                    }
                    None => *o = 0.0,
                }
            }
            let rms = if n == 0 {
                0.0
            } else {
                (sum / out.len() as f32).sqrt()
            };
            self.level.store(rms.to_bits(), Ordering::Relaxed);
            if q.buf.is_empty() && q.finished {
                q.done.take()
            } else {
                None
            }
        };
        if let Some(d) = done {
            d();
        }
    }
}

impl Playing for Queue {
    fn push(&self, samples: &[f32]) {
        let s = audio::resample(samples, self.from, self.to);
        self.inner.lock().buf.extend(s);
    }

    fn finish(&self) {
        self.inner.lock().finished = true;
    }

    fn level(&self) -> f32 {
        f32::from_bits(self.level.load(Ordering::Relaxed))
    }
}

/// A playback and what keeps it going: dropped, the thread that plays it stops.
struct Handle {
    queue: Arc<Queue>,
    stop: Mutex<Option<mpsc::Sender<()>>>,
    stopped: Arc<AtomicBool>,
}

impl Playing for Handle {
    fn push(&self, samples: &[f32]) {
        self.queue.push(samples)
    }
    fn finish(&self) {
        self.queue.finish()
    }
    fn level(&self) -> f32 {
        self.queue.level()
    }
}

impl Drop for Handle {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Release);
        self.stop.lock().take();
    }
}

/// Plays in silence, in real time: 20 ms at a time, as a sound card would ask for them.
pub struct Silent;

impl Output for Silent {
    fn open(&self, rate: u32, volume: f32, done: Done) -> Result<Arc<dyn Playing>, String> {
        let queue = Arc::new(Queue::new(rate, rate, volume, done));
        let stopped = Arc::new(AtomicBool::new(false));
        let (tx, rx) = mpsc::channel::<()>();
        {
            let queue = queue.clone();
            let stopped = stopped.clone();
            std::thread::Builder::new()
                .name("speech-silent".into())
                .spawn(move || {
                    let mut frame = vec![0f32; (rate as usize / 50).max(1)];
                    loop {
                        match rx.recv_timeout(Duration::from_millis(20)) {
                            Err(mpsc::RecvTimeoutError::Timeout) => {}
                            _ => return,
                        }
                        if stopped.load(Ordering::Acquire) {
                            return;
                        }
                        queue.pull(&mut frame);
                    }
                })
                .map_err(|e| e.to_string())?;
        }
        Ok(Arc::new(Handle {
            queue,
            stop: Mutex::new(Some(tx)),
            stopped,
        }))
    }
}

/// The system's speakers (its default output), through cpal: the stream lives on a thread of its own.
pub struct Speakers;

impl Output for Speakers {
    fn open(&self, rate: u32, volume: f32, done: Done) -> Result<Arc<dyn Playing>, String> {
        use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
        let (ready_tx, ready_rx) = mpsc::channel::<Result<Arc<Queue>, String>>();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let done = Mutex::new(Some(done));
        std::thread::Builder::new()
            .name("speech-out".into())
            .spawn(move || {
                let open = || -> Result<(cpal::Stream, Arc<Queue>), String> {
                    let host = cpal::default_host();
                    let device = host
                        .default_output_device()
                        .ok_or_else(|| "no sound output".to_string())?;
                    let config = device.default_output_config().map_err(|e| e.to_string())?;
                    let channels = config.channels() as usize;
                    let device_rate = config.sample_rate();
                    let queue = Arc::new(Queue::new(
                        rate,
                        device_rate,
                        volume,
                        done.lock().take().unwrap(),
                    ));
                    let q = queue.clone();
                    let mut mono = Vec::new();
                    let err = |e: cpal::Error| log::warn!("speech: {e}");
                    let stream = match config.sample_format() {
                        cpal::SampleFormat::F32 => device.build_output_stream::<f32, _, _>(
                            config.into(),
                            move |data: &mut [f32], _| {
                                mono.resize(data.len() / channels, 0.0);
                                q.pull(&mut mono);
                                for (frame, s) in data.chunks_mut(channels).zip(&mono) {
                                    frame.fill(*s);
                                }
                            },
                            err,
                            None,
                        ),
                        cpal::SampleFormat::I16 => device.build_output_stream::<i16, _, _>(
                            config.into(),
                            move |data: &mut [i16], _| {
                                mono.resize(data.len() / channels, 0.0);
                                q.pull(&mut mono);
                                for (frame, s) in data.chunks_mut(channels).zip(&mono) {
                                    frame.fill((s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16);
                                }
                            },
                            err,
                            None,
                        ),
                        other => return Err(format!("sample format {other} not supported")),
                    }
                    .map_err(|e| e.to_string())?;
                    stream.play().map_err(|e| e.to_string())?;
                    Ok((stream, queue))
                };
                match open() {
                    Ok((stream, queue)) => {
                        let _ = ready_tx.send(Ok(queue));
                        let _ = stop_rx.recv();
                        drop(stream);
                    }
                    Err(e) => {
                        let _ = ready_tx.send(Err(e));
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        let queue = ready_rx
            .recv()
            .map_err(|_| "sound output thread ended".to_string())??;
        Ok(Arc::new(Handle {
            queue,
            stop: Mutex::new(Some(stop_tx)),
            stopped: Arc::new(AtomicBool::new(false)),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn a_silent_playback_takes_the_time_of_its_sound_and_tells_its_end() {
        let (tx, rx) = mpsc::channel();
        let p = Silent
            .open(16_000, 1.0, Box::new(move || tx.send(()).unwrap()))
            .unwrap();
        let started = Instant::now();
        p.push(&vec![0.5; 8_000]);
        std::thread::sleep(Duration::from_millis(100));
        assert!(p.level() > 0.4, "{}", p.level());
        p.push(&vec![0.5; 8_000]);
        p.finish();
        rx.recv_timeout(Duration::from_secs(5)).unwrap();
        let took = started.elapsed();
        assert!(
            took >= Duration::from_millis(950) && took < Duration::from_millis(2500),
            "{took:?}"
        );
    }

    #[test]
    fn a_playback_dropped_stops_and_never_tells_its_end() {
        let (tx, rx) = mpsc::channel();
        let p = Silent
            .open(16_000, 1.0, Box::new(move || tx.send(()).unwrap()))
            .unwrap();
        p.push(&vec![0.5; 16_000]);
        p.finish();
        std::thread::sleep(Duration::from_millis(60));
        drop(p);
        assert!(rx.recv_timeout(Duration::from_millis(1500)).is_err());
    }

    #[test]
    fn the_volume_scales_what_is_played_and_samples_come_at_the_device_s_rate() {
        let q = Queue::new(16_000, 48_000, 0.5, Box::new(|| {}));
        q.push(&vec![0.8; 160]);
        let mut out = vec![0f32; 600];
        q.pull(&mut out);
        assert!(out[..470].iter().all(|s| (*s - 0.4).abs() < 1e-4));
        assert!(out[490..].iter().all(|s| *s == 0.0));
    }
}
