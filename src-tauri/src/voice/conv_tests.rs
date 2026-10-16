// The conversation (ESC-97): the microphone scripted in real time, a fake voice heard nowhere. Included in `tests.rs`,
// whose harness it uses.

use super::conversation::{ConvChoice, ConvStarted};
use super::speech::{self, SpeakOptions};

/// A voice of the catalog on the disk: its two files, of their sizes.
fn put_voice(v: &Voice, id: &str) {
    let info = speech::catalog::find(id).unwrap();
    std::fs::create_dir_all(&v.voices.dir).unwrap();
    std::fs::File::create(v.voices.model(id)).unwrap().set_len(info.onnx_size).unwrap();
    std::fs::File::create(v.voices.config(id)).unwrap().set_len(info.json_size).unwrap();
}

struct Conv {
    h: Harness,
    engine: Arc<speech::Fake>,
}

fn conv_harness(name: &str, text: &str) -> Conv {
    let mut h = harness(name, text, 16_000);
    let engine = Arc::new(speech::Fake::new(None));
    h.voice = h.voice.with_speech(engine.clone(), Arc::new(speech::output::Silent));
    Conv { h, engine }
}

fn conv_choice() -> ConvChoice {
    ConvChoice {
        device: String::new(),
        model: "base".into(),
        language: "fr".into(),
        voice: "fr_FR-siwis-medium".into(),
        speak: SpeakOptions::default(),
        volume: 1.0,
        silence_ms: 600,
    }
}

/// `secs` of what the microphone hears, in real time: a tone of `amp` (0: a quiet room).
fn hear(h: &Harness, secs: f32, amp: f32) {
    let mut t = 0usize;
    for _ in 0..(secs * 50.0) as usize {
        let chunk: Vec<f32> = (0..320)
            .map(|i| {
                t += 1;
                let noise = ((t * 7919 + i) % 13) as f32 / 13.0 * 0.004 - 0.002;
                (t as f32 * 0.09).sin() * amp + noise
            })
            .collect();
        h.script.push(&chunk);
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn conv_events(h: &Harness) -> Vec<VoiceEvent> {
    h.events
        .lock()
        .iter()
        .filter(|e| !matches!(e, VoiceEvent::ConvLevel { .. } | VoiceEvent::Level { .. }))
        .cloned()
        .collect()
}

/// Waits (5 s at most) for an event `f` accepts.
fn wait_for(h: &Harness, f: impl Fn(&VoiceEvent) -> bool) -> VoiceEvent {
    let end = Instant::now() + Duration::from_secs(5);
    loop {
        if let Some(e) = h.events.lock().iter().find(|e| f(e)) {
            return e.clone();
        }
        assert!(Instant::now() < end, "never came: {:?}", conv_events(h));
        std::thread::sleep(Duration::from_millis(10));
    }
}

fn listening(s: ConvStarted) -> u64 {
    match s {
        ConvStarted::Listening { session } => session,
        other => panic!("not listening: {other:?}"),
    }
}

#[test]
fn a_conversation_asks_for_whisper_s_model_then_for_its_voice() {
    let c = conv_harness("conv-needs", "");
    let v = &c.h.voice;
    assert!(matches!(v.conversation_start(conv_choice()).unwrap(), ConvStarted::NeedsModel { .. }));
    put_model(&v.store, "base");
    let info = speech::catalog::find("fr_FR-siwis-medium").unwrap();
    assert_eq!(
        v.conversation_start(conv_choice()).unwrap(),
        ConvStarted::NeedsVoice { voice: info.id.clone(), size: info.onnx_size + info.json_size }
    );
    assert!(c.h.script.opened.lock().is_empty(), "the microphone stayed closed");
}

#[test]
fn a_sentence_is_sent_once_its_silence_comes_then_the_passage_is_read_and_it_listens_again() {
    let c = conv_harness("conv-turn", "ajoute un test");
    let h = &c.h;
    put_model(&h.voice.store, "base");
    put_voice(&h.voice, "fr_FR-siwis-medium");
    let session = listening(h.voice.conversation_start(conv_choice()).unwrap());
    // Dictation waits for the conversation to be over.
    assert_eq!(h.voice.start(&choice("base", "fr")).unwrap_err(), VoiceError::AlreadyListening);
    hear(h, 0.4, 0.0);
    hear(h, 1.0, 0.3);
    wait_for(h, |e| matches!(e, VoiceEvent::ConvSpeech { .. }));
    hear(h, 1.0, 0.0);
    let heard = wait_for(h, |e| matches!(e, VoiceEvent::ConvHeard { .. }));
    assert_eq!(heard, VoiceEvent::ConvHeard { session, text: "ajoute un test".into(), error: None });
    // The whole sentence went to Whisper (its first syllables too), at 16 kHz, in French.
    let calls = c.h.fake.calls.lock().clone();
    assert_eq!(calls.len(), 1);
    assert!(calls[0].0 >= 16_000 && calls[0].0 <= 16_000 * 2, "{calls:?}");
    assert_eq!(calls[0].1, "fr");
    // Holding while the agent works: a sentence now is not taken.
    h.voice.conversation_hold(session);
    hear(h, 0.8, 0.3);
    hear(h, 0.8, 0.0);
    assert_eq!(c.h.fake.calls.lock().len(), 1);
    // The passage is read, sentence by sentence; once heard, it listens again.
    let reading = h.voice.conversation_say(session, "C'est fait. Les tests passent.").unwrap();
    let spoken = wait_for(h, |e| matches!(e, VoiceEvent::ConvSpoken { .. }));
    assert_eq!(spoken, VoiceEvent::ConvSpoken { session, reading, error: None });
    assert_eq!(*c.engine.said.lock(), vec!["C'est fait.".to_string(), "Les tests passent.".to_string()]);
    hear(h, 0.5, 0.0);
    hear(h, 0.8, 0.3);
    hear(h, 1.0, 0.0);
    let n = conv_events(h).iter().filter(|e| matches!(e, VoiceEvent::ConvHeard { .. })).count();
    assert_eq!(n, 2, "{:?}", conv_events(h));
    h.voice.conversation_stop();
    assert!(h.script.dropped.load(Ordering::Acquire), "the microphone was let go");
    assert_eq!(h.voice.conversing(), None);
}

#[test]
fn the_agent_s_voice_heard_by_the_microphone_is_neither_a_barge_in_nor_a_sentence() {
    let c = conv_harness("conv-echo", "jamais");
    let h = &c.h;
    put_model(&h.voice.store, "base");
    put_voice(&h.voice, "fr_FR-siwis-medium");
    let session = listening(h.voice.conversation_start(conv_choice()).unwrap());
    hear(h, 0.3, 0.0);
    h.voice.conversation_say(session, "Voici un résumé assez long à lire pour durer.").unwrap();
    // The speakers heard by the microphone, a third as loud as what is played (the fake voice plays at 0.3).
    hear(h, 2.6, 0.1);
    wait_for(h, |e| matches!(e, VoiceEvent::ConvSpoken { .. }));
    let events = conv_events(h);
    assert!(!events.iter().any(|e| matches!(e, VoiceEvent::ConvBargeIn { .. })), "{events:?}");
    hear(h, 0.8, 0.0);
    assert!(c.h.fake.calls.lock().is_empty(), "the echo was transcribed");
    h.voice.conversation_stop();
}

#[test]
fn speaking_over_the_agent_stops_its_reading_and_the_sentence_is_heard() {
    let c = conv_harness("conv-barge", "attends, plutôt la page d'accueil");
    let h = &c.h;
    put_model(&h.voice.store, "base");
    put_voice(&h.voice, "fr_FR-siwis-medium");
    let session = listening(h.voice.conversation_start(conv_choice()).unwrap());
    hear(h, 0.3, 0.0);
    let reading = h
        .voice
        .conversation_say(session, "Une première phrase assez longue. Une deuxième phrase. Une troisième phrase.")
        .unwrap();
    hear(h, 0.8, 0.05);
    // The user, close to the microphone.
    hear(h, 0.6, 0.4);
    let barge = wait_for(h, |e| matches!(e, VoiceEvent::ConvBargeIn { .. }));
    assert_eq!(barge, VoiceEvent::ConvBargeIn { session, reading });
    hear(h, 0.6, 0.4);
    hear(h, 1.0, 0.0);
    let heard = wait_for(h, |e| matches!(e, VoiceEvent::ConvHeard { .. }));
    assert!(matches!(heard, VoiceEvent::ConvHeard { ref text, .. } if text == "attends, plutôt la page d'accueil"));
    // The reading stopped: never heard to its end (its sentences were all made by then, the fake voice is quick).
    std::thread::sleep(Duration::from_millis(300));
    assert!(!conv_events(h).iter().any(|e| matches!(e, VoiceEvent::ConvSpoken { .. })));
    assert_eq!(c.engine.said.lock().len(), 3);
    h.voice.conversation_stop();
}

#[test]
fn a_voice_is_downloaded_with_its_size_and_checksum_checked() {
    let dir = crate::paths::test_dir("speech-download");
    let store = speech::VoiceStore { dir: dir.join("voices") };
    let body = b"onnx bytes".to_vec();
    let json = b"{}".to_vec();
    let sha = |b: &[u8]| {
        use sha2::Digest;
        format!("{:x}", sha2::Sha256::digest(b))
    };
    let mut info = speech::catalog::find("fr_FR-siwis-medium").unwrap().clone();
    info.onnx_size = body.len() as u64;
    info.onnx_sha256 = sha(&body);
    info.json_size = json.len() as u64;
    info.json_sha256 = sha(&json);
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let asked = Arc::new(Mutex::new(Vec::<String>::new()));
        let a = asked.clone();
        let (b2, j2) = (body.clone(), json.clone());
        tokio::spawn(async move {
            loop {
                let (mut sock, _) = listener.accept().await.unwrap();
                let mut req = vec![0u8; 4096];
                let n = sock.read(&mut req).await.unwrap();
                let line = String::from_utf8_lossy(&req[..n]).lines().next().unwrap_or_default().to_string();
                a.lock().push(line.clone());
                let bytes = if line.contains(".onnx.json") { j2.clone() } else { b2.clone() };
                let head = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", bytes.len());
                sock.write_all(head.as_bytes()).await.unwrap();
                sock.write_all(&bytes).await.unwrap();
            }
        });
        let client = reqwest::Client::new();
        let base = format!("http://127.0.0.1:{port}");
        let mut seen = Vec::new();
        store.download(&client, &base, &info, &AtomicBool::new(false), |d| seen.push(d)).await.unwrap();
        assert!(store.has(&info));
        assert_eq!(*seen.last().unwrap(), info.onnx_size + info.json_size);
        let asked = asked.lock().clone();
        assert!(
            asked.iter().any(|l| l.contains("/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx ")),
            "{asked:?}"
        );
        // Bytes that are not the voice: not kept.
        store.delete(&info.id).unwrap();
        let mut wrong = info.clone();
        wrong.onnx_sha256 = sha(b"something else");
        let e = store.download(&client, &base, &wrong, &AtomicBool::new(false), |_| {}).await.unwrap_err();
        assert!(e.is::<models::ChecksumMismatch>(), "{e:#}");
        assert!(!store.model(&info.id).exists());
        assert!(!dir.join("voices").join(format!("{}.onnx.part", info.id)).exists());
    });
}
