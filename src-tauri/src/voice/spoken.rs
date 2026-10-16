//! What the agent writes to be read aloud in a conversation (ESC-97). A message said in a conversation ends with an
//! instruction (`with_instruction`) asking the agent to end its answer with a short passage for the ear, less wordy and
//! less technical than its answer, between `<spoken>` and `</spoken>`. Escouade takes that passage out of the answer
//! (`extract`): it is shown apart and read aloud; the whole answer stays in the conversation.

use crate::i18n::Lang;

pub const OPEN: &str = "<spoken>";
pub const CLOSE: &str = "</spoken>";
/// What wraps the instruction at the end of a message said in a conversation: the window shows the message without it.
pub const INSTRUCTION_OPEN: &str = "<escouade-voice>";
pub const INSTRUCTION_CLOSE: &str = "</escouade-voice>";

/// The instruction, in the language the agent is spoken to in.
pub fn instruction(lang: Lang) -> String {
    let body = match lang {
        Lang::Fr => "Conversation vocale : l’utilisateur t’a parlé à voix haute et écoute ta réponse. Réponds comme d’habitude, puis termine par un court passage à lire à voix haute, entre <spoken> et </spoken> : deux ou trois phrases au plus, en français, qui disent l’essentiel (ce que tu as fait ou trouvé, ce que tu attends de lui), sans code, sans chemin de fichier, sans liste ni détail technique.",
        Lang::En => "Voice conversation: the user spoke to you aloud and listens to your answer. Answer as usual, then end with a short passage to be read aloud, between <spoken> and </spoken>: two or three sentences at most, in English, that say what matters (what you did or found, what you need from them), with no code, no file path, no list and no technical detail.",
    };
    format!("{INSTRUCTION_OPEN}{body}{INSTRUCTION_CLOSE}")
}

/// `text` as sent to the agent in a conversation: with the instruction at its end.
pub fn with_instruction(lang: Lang, text: &str) -> String {
    format!("{}\n\n{}", text.trim_end(), instruction(lang))
}

/// The answer `text` without its passage to be read, and the passage, made fit for the ear (its Markdown taken out).
/// None when the answer has no passage. The last one counts; one whose end was cut off runs to the end of the text.
pub fn extract(text: &str) -> Option<(String, String)> {
    let start = text.rfind(OPEN)?;
    let inner_start = start + OPEN.len();
    let (inner, after) = match text[inner_start..].find(CLOSE) {
        Some(i) => (
            &text[inner_start..inner_start + i],
            &text[inner_start + i + CLOSE.len()..],
        ),
        None => (&text[inner_start..], ""),
    };
    let passage = for_the_ear(inner);
    let rest = format!("{}{}", text[..start].trim_end(), after.trim_end());
    let rest = rest.trim_end().to_string();
    (!passage.is_empty()).then_some((rest, passage))
}

/// Markdown read as words: no emphasis marks, no backticks, links by their text, no headings' hashes nor bullets, one
/// line.
pub fn for_the_ear(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    // [text](url) → text
    while let Some(open) = rest.find('[') {
        let Some(close) = rest[open..].find("](").map(|i| open + i) else {
            break;
        };
        let Some(end) = rest[close..].find(')').map(|i| close + i) else {
            break;
        };
        out.push_str(&rest[..open]);
        out.push_str(&rest[open + 1..close]);
        rest = &rest[end + 1..];
    }
    out.push_str(rest);
    let lines: Vec<String> = out
        .lines()
        .map(|l| {
            let l = l.trim().trim_start_matches('#').trim_start();
            let l = l
                .strip_prefix("- ")
                .or_else(|| l.strip_prefix("* "))
                .unwrap_or(l);
            l.replace(['*', '`', '_'], "")
        })
        .filter(|l| !l.trim().is_empty())
        .collect();
    lines
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_passage_is_taken_out_of_the_answer() {
        let answer = "J’ai corrigé `src/app.rs` :\n\n- le test passe\n- la CI aussi\n\n<spoken>\nJ’ai corrigé le bug. Les tests passent.\n</spoken>";
        let (rest, passage) = extract(answer).unwrap();
        assert_eq!(
            rest,
            "J’ai corrigé `src/app.rs` :\n\n- le test passe\n- la CI aussi"
        );
        assert_eq!(passage, "J’ai corrigé le bug. Les tests passent.");
    }

    #[test]
    fn an_answer_without_a_passage_has_none() {
        assert_eq!(extract("Rien à lire."), None);
        assert_eq!(extract("Vide <spoken>  </spoken>"), None);
    }

    #[test]
    fn the_last_passage_counts_and_one_cut_off_runs_to_the_end() {
        let (rest, passage) =
            extract("Un <spoken>premier</spoken> puis la suite.\n<spoken>Le vrai résumé").unwrap();
        assert_eq!(passage, "Le vrai résumé");
        assert_eq!(rest, "Un <spoken>premier</spoken> puis la suite.");
        // Text after it stays in the answer.
        let (rest, _) = extract("Avant.\n<spoken>À lire.</spoken>\nAprès.").unwrap();
        assert_eq!(rest, "Avant.\nAprès.");
    }

    #[test]
    fn markdown_is_read_as_words() {
        assert_eq!(
            for_the_ear(
                "## Fait\n- **Tout** passe, voir [la PR](https://x.y/1) et `npm test`.\n* _ok_"
            ),
            "Fait Tout passe, voir la PR et npm test. ok"
        );
    }

    #[test]
    fn the_instruction_ends_the_message_in_the_user_s_language() {
        let fr = with_instruction(Lang::Fr, "Ajoute un test ");
        assert!(fr.starts_with("Ajoute un test\n\n<escouade-voice>Conversation vocale"));
        assert!(fr.ends_with("</escouade-voice>") && fr.contains("<spoken>"));
        assert!(with_instruction(Lang::En, "Add a test").contains("Voice conversation: "));
    }
}
