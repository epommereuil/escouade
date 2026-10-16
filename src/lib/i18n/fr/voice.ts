import type { Tree } from '../types';

// The dictation: its button, its panel while it listens, its tab of the settings.
export default {
  keys: { space: 'Espace' },
  /** The button beside a field: what its tooltip says, its key named. */
  button: {
    label: 'Dicter',
    title: 'Dicter ({key}) : un clic commence et un second finit ; maintenu, il dicte tant qu’il est enfoncé',
    stop: 'Finir la dictée',
  },
  panel: {
    starting: 'Ouverture du micro…',
    listening: 'À l’écoute',
    hint: 'Clique ou {key} pour finir · Échap pour annuler',
    holdHint: 'Relâche pour finir · Échap pour annuler',
    level: 'Niveau du micro',
    transcribing: 'Transcription sur ta machine…',
    offerTitle: 'Télécharger le modèle de transcription ?',
    offerBody:
      'La dictée se fait sur ta machine avec Whisper, modèle « {model} » ({size}). Il est téléchargé une seule fois, puis rien de ce que tu dis ne quitte ta machine.',
    download: 'Télécharger',
    downloading: 'Modèle « {model} » : {done} sur {total}',
    cancel: 'Annuler',
  },
  nothingHeard: 'Rien entendu : parle un peu plus près du micro, puis réessaie.',
  modelReady: 'Modèle téléchargé : clique sur le micro pour dicter.',
  downloadFailed: 'Le téléchargement du modèle a échoué : {error}',
  deleteFailed: 'Le modèle n’a pas pu être effacé : {error}',
  /** Réglages › Voix. */
  settings: {
    microphone: 'Micro',
    device: 'Micro utilisé',
    deviceSystem: 'Celui du système',
    deviceSystemNamed: 'Celui du système ({name})',
    noDevice: 'Aucun micro trouvé : branche-en un, puis rouvre les réglages.',
    transcription: 'Transcription',
    transcriptionNote:
      'Whisper transcrit sur ta machine : rien de ce que tu dis n’est envoyé. Seul le modèle est téléchargé, par le proxy des réglages réseau, et sa somme de contrôle vérifiée.',
    model: 'Modèle',
    modelDesc: 'Plus gros, il comprend mieux et transcrit plus lentement. Celui choisi se télécharge à la première dictée.',
    modelSpeed: 'Vitesse {speed}/5 · qualité {quality}/5',
    downloaded: 'Téléchargé',
    download: 'Télécharger',
    delete: 'Effacer',
    deleteTitle: 'Effacer le modèle « {model} » ({size}) : il se télécharge à nouveau à la prochaine dictée',
    language: 'Langue parlée',
    languageDesc: 'Indiquer la langue rend la transcription plus juste ; la détection automatique convient à qui parle plusieurs langues.',
    languageUi: 'Celle de l’interface',
    languageAuto: 'Détection automatique',
    use: 'Utilisation',
    shortcut: 'Raccourci',
    shortcutDesc:
      'Un appui bref commence la dictée et un second la finit ; maintenu, il dicte tant qu’il est enfoncé. Il dicte dans le champ qui a le focus : le message, la description d’un ticket, le terminal de la vue Claude Code.',
    change: 'Changer',
    recording: 'Appuie sur le raccourci…',
    recordingHint: 'Avec Ctrl, Alt ou Cmd (ou une touche F1 à F24) ; Échap pour garder l’actuel',
    restore: 'Par défaut',
  },
  /** Each language named in itself. */
  languages: {
    fr: 'Français',
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
    nl: 'Nederlands',
  },
} as const satisfies Tree;
