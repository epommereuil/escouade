import type { Tree } from '../types';

// The settings window and the settings of a project.
export default {
  // The tabs of the window: their name and what they set (under the title, in the header).
  tabs: {
    app: { label: 'Application', desc: 'Zoom, taille du texte et langues' },
    claude: { label: 'Claude Code', desc: 'Exécutable, modèle et permissions par défaut' },
    accounts: { label: 'Comptes Claude', desc: 'Les comptes sur lesquels partent les agents, enregistrés à chaque changement' },
    notifications: { label: 'Notifications', desc: 'Alertes visuelles et sonores' },
    projects: { label: 'Projets', desc: 'Réglages propres à chaque projet' },
    board: { label: 'Kanban', desc: 'Pilote auto et tickets validés' },
    integrations: { label: 'Intégrations', desc: 'Jira, Trello, GitHub Issues et Linear' },
    terminals: { label: 'Terminaux', desc: 'Shells disponibles dans les terminaux intégrés' },
    network: {
      label: 'Réseau',
      desc: 'Proxy HTTP(S) et certificats TLS pour Claude Code, les intégrations et les mises à jour',
    },
    voice: { label: 'Voix', desc: 'Dictée des messages : micro, modèle de transcription, langue et raccourci' },
    about: { label: 'À propos', desc: 'Version et données locales' },
  },

  // The window itself.
  modal: {
    changed: 'Modifié, pas encore enregistré',
    saved: 'Réglages enregistrés',
    noProject: 'Aucun projet ouvert.',
  },

  // What keeps the draft from being saved.
  problem: {
    projectName: 'Le projet « {name} » doit garder un nom.',
    command: 'Chaque commande de lancement de « {name} » demande un nom et une ligne de commande.',
    worktrees: 'Le dossier des worktrees ou un préfixe de branche de « {name} » n’est pas valide.',
  },

  // « Remplir automatiquement »: what is said when Claude has read the project.
  suggest: {
    nothing: "Claude n'a trouvé aucune commande à lancer pour ce projet.",
    proposed: {
      one: "1 commande proposée : relis-la avant d'enregistrer.",
      other: "{count} commandes proposées : relis-les avant d'enregistrer.",
    },
    /** One command was left out, for what it would hide. */
    proposedLeftOne: {
      one: "1 commande proposée, 1 écartée (caractères invisibles ou trop longue) : relis-la avant d'enregistrer.",
      other: "{count} commandes proposées, 1 écartée (caractères invisibles ou trop longue) : relis-les avant d'enregistrer.",
    },
    /** Several were left out: `refused` of them. */
    proposedLeftMany: {
      one: "1 commande proposée, {refused} écartées (caractères invisibles ou trop longues) : relis-la avant d'enregistrer.",
      other: "{count} commandes proposées, {refused} écartées (caractères invisibles ou trop longues) : relis-les avant d'enregistrer.",
    },
  },

  // A shell, and what is asked of a folder, in a project's commands.
  fields: {
    shell: 'Shell',
    /** A shell the draft names that this machine does not have: « bash (introuvable) ». */
    shellNotFound: '{name} (introuvable)',
    subfolder: 'Sous-dossier',
    addCommand: '+ Ajouter une commande',
  },

  // The « Application » tab.
  app: {
    display: 'Affichage',
    zoom: 'Zoom de l’interface',
    zoomDesc:
      'Le texte, les espacements et les icônes de toute l’application grandissent ensemble, terminaux et éditeur compris. Appliqué et enregistré tout de suite.',
    /** The shortcuts of the zoom, as written on this system. */
    zoomKeys: 'Aussi au clavier : {in} pour agrandir, {out} pour réduire, {reset} pour revenir à 100 %.',
    zoomTooBig: 'Trop grand pour la taille de la fenêtre',
    /** The zoom chosen is too big for the window as it is now. */
    zoomHeld: 'La fenêtre est trop petite pour {zoom} : l’interface est à {shown} tant qu’elle ne grandit pas.',
    /** A step of the zoom: « 125 % ». */
    percent: '{n} %',
    terminalFontSize: 'Taille du texte des terminaux',
    editorFontSize: 'Taille du texte de l’éditeur',
    fontSizeHint: 'en pixels, {n} par défaut',
    fontSizeDesc: 'De 9 à 24, avant le zoom de l’interface, qui s’y ajoute.',
    language: 'Langue',
    uiLanguage: 'Langue de l’interface',
    /** The system's language, named in the interface's: « Système (Français) ». */
    system: 'Système ({lang})',
    claudeLanguage: 'Langue des textes rédigés par Claude',
    sameAsUi: 'Comme l’interface (par défaut)',
    claudeLanguageHelp:
      'Messages de commit et descriptions de pull request proposés, commentaires publiés dans Jira, Trello, GitHub et Linear, consignes données aux agents (par défaut, le message de commit proposé reprend la langue des derniers commits du dépôt).',
    /** A language named in the interface's (the choices name each in itself: `LANG_NAMES`). */
    langName: { fr: 'Français', en: 'Anglais' },
  },

  // The « Claude Code » tab.
  claude: {
    executable: 'Exécutable',
    path: "Chemin de l'exécutable",
    pathHint: 'vide = détection automatique',
    pathFound: 'claude (trouvé dans le PATH)',
    pathMissing: 'introuvable — indique le chemin de claude.exe',
    /** Under the path: where its `claude` is. */
    located: 'Trouvé : {path}',
    locatedWsl: 'Trouvé dans WSL ({distro}) : {path}',
    nat: 'Le réseau de WSL est en NAT : le serveur MCP d’Escouade et le suivi de la vue Claude Code ne joignent pas l’app. Passe-le en mode miroir (networkingMode=mirrored sous [wsl2] dans %UserProfile%\\.wslconfig), puis lance wsl --shutdown.',
    notLocated:
      'Introuvable. Indique le chemin de claude.exe, ou de Claude Code installé dans WSL : ~/.local/bin/claude, /home/<utilisateur>/…, ou \\\\wsl.localhost\\<distribution>\\….',
    notLocatedHere: 'Introuvable. Indique le chemin de claude.',
    newAgents: 'Nouveaux agents',
    defaultModel: 'Modèle par défaut',
    defaultEffort: 'Effort par défaut',
    defaultMode: 'Mode de permission par défaut',
    processes: 'Processus',
    autoResume: 'Reprise automatique après la limite d’usage',
    autoResumeDesc: '« continue » envoyé une fois le quota réinitialisé',
    idleStop: 'Arrêter les processus Claude inactifs après',
    idleStopHint: 'minutes, 0 = jamais',
    idleStopLabel: 'Arrêter les processus Claude inactifs après (minutes)',
    terminalView: 'Ouvrir les nouveaux agents dans l’interface de Claude Code',
    terminalViewDesc:
      'Un nouvel agent tourne dans un terminal avec l’interface de Claude Code elle-même plutôt que dans la conversation d’Escouade. Chaque agent change de vue depuis son en-tête ; les agents de ticket restent dans la vue d’Escouade.',
    todoTools: 'Les agents tiennent une liste de tâches',
    todoToolsDesc:
      'Donne aux agents l’outil de liste de tâches de Claude Code : s’ils la tiennent, Escouade montre leur avancée dans le bandeau « Plan » (le modèle n’est pas obligé de s’en servir). S’applique aux agents lancés ensuite.',
    attachments: 'Pièces jointes',
    attachmentsNote:
      'Les images, les PDF et les textes dans leurs limites partent dans le message. Tout autre fichier, ou un fichier trop gros pour le message, est joint par son chemin : Claude le lit avec ses outils.',
    attachMax: 'Taille maximale d’un fichier joint',
    attachMaxHint: 'Mo, 0 = aucune limite',
    attachMaxLabel: 'Taille maximale d’un fichier joint (Mo)',
    attachWarn: 'Avertir au-delà de',
    attachWarnHint: 'Mo, 0 = jamais',
    attachWarnLabel: 'Avertir pour un fichier joint de plus de (Mo)',
    attachOrigin: 'Joindre le fichier d’origine',
    attachOriginDesc:
      'Un fichier déposé est joint là où il est, sans copie : Claude le lit à son emplacement. Désactivé, Escouade en garde toujours une copie. Les tickets et la vue Claude Code copient toujours.',
    attachBigText: 'Texte de plus de 256 Ko',
    attachBigTextDesc: 'Un fichier texte trop gros pour le message est joint par son chemin, ou refusé.',
    attachBigTextPath: 'Joint par son chemin',
    attachBigTextRefuse: 'Refusé',
    attachKeep: 'Purger les copies après',
    attachKeepHint: 'jours, 0 = tant que leur propriétaire existe',
    attachKeepLabel: 'Purger les copies après (jours)',
    /** The group of the remote control of every agent, after the MCP server’s. */
    remoteTitle: 'Remote control',
    remoteAll: 'Remote control pour tous les agents',
    remoteAllDesc:
      'Chaque agent de chaque projet, existant ou nouveau (agents des tickets compris), est accessible depuis claude.ai et l’app Claude. Escouade lance tout de suite le process claude de chacun, qui reste lancé. La session apparaît sur claude.ai sous le nom « projet · agent » (pour un agent de ticket, son nom vient du ticket). En vue Claude Code, une interface déjà ouverte ne le prend qu’à son prochain lancement. Pour mettre un agent à part : clic droit, « Désactiver le remote control ».',
  },

  // The « Notifications » tab.
  notifications: {
    notifyFor: 'Me prévenir pour',
    /** Under the types of notification; the system names the place the app shows in (the Dock, the taskbar). */
    noteMac: 'Désactivé : ni notification système ni carillon pour ce type ; l’onglet, la carte et le Dock signalent toujours l’agent.',
    noteOther:
      'Désactivé : ni notification système ni carillon pour ce type ; l’onglet, la carte et la barre des tâches signalent toujours l’agent.',
    questions: 'Questions et autorisations',
    done: 'Tâches terminées',
    errors: 'Erreurs',
    tickets: 'Tickets (prêt à tester, bloqué)',
    channels: 'Canaux',
    /** `os`: « macOS » or « Windows ». */
    system: "Notifications {os} quand l'app n'est pas au premier plan",
    systemLabel: 'Notifications système',
    sound: 'Son',
    soundOn: 'Son activé',
    soundOnDesc: 'Question de Claude, fin de tour',
    soundTest: 'Tester le son',
    soundTestButton: '▶ Tester',
  },

  // The « Terminaux » tab.
  terminals: {
    paths: 'Chemins',
    detected: 'Détectés : {list}',
    none: 'aucun',
    auto: 'vide = auto',
    wsl: 'Distribution WSL',
    wslHint: 'vide = distribution par défaut',
  },

  // The « Réseau » tab.
  network: {
    proxy: 'Proxy',
    proxyNote:
      "Le proxy est transmis aux processus Claude Code, à la lecture des quotas, aux intégrations et aux mises à jour. Il s'applique aux agents au prochain (re)démarrage de leur processus.",
    proxyUrl: 'Proxy HTTP(S)',
    proxyUrlHint: 'ex. http://utilisateur:motdepasse@proxy:3128',
    proxyUrlNone: 'aucun',
    exclusions: 'Exclusions',
    exclusionsHint: 'NO_PROXY, séparées par des virgules',
    proxyTerminals: 'Appliquer aussi le proxy aux terminaux intégrés',
    certificates: 'Certificats',
    certificatesNote:
      "Les intégrations, les quotas et les mises à jour font confiance aux certificats reconnus et à ceux installés sur ce système (celui d'un proxy d'entreprise, le plus souvent). Claude Code, lui, a sa propre liste.",
    insecureTls: 'Ignorer la vérification des certificats TLS',
    insecureTlsDesc:
      "Pour un proxy qui déchiffre le trafic avec un certificat non reconnu (erreur « UnknownIssuer »). S'applique aux intégrations, aux quotas, aux mises à jour, et aux processus Claude Code (au prochain démarrage de leur processus) avec les commandes que lancent les agents (npm, node…). À réserver à un réseau de confiance : une connexion interceptée, jetons compris, ne serait plus détectée.",
  },

  // The « À propos » tab.
  about: {
    credits: 'Crédits et licences',
    creditsDesc: 'Piper, eSpeak NG, ONNX Runtime, whisper.cpp, et la licence et le crédit de chaque voix',
    creditsOpen: 'Ouvrir',
    claudeFound: 'Claude Code détecté',
    claudeMissing: 'Claude Code introuvable',
    checking: 'Recherche…',
    check: 'Rechercher une mise à jour',
    noUpdate: 'Aucune mise à jour disponible.',
    autoUpdate: 'Installer les mises à jour automatiquement',
    autoUpdateDesc: 'Escouade redémarre d’elle-même quand aucun agent ne travaille et que tout est enregistré.',
    localData: 'Données locales',
    telemetry: 'Statistiques d’usage',
    telemetryDesc:
      'Les fonctionnalités utilisées, la version d’Escouade et le système, sous un identifiant tiré au hasard : rien qui t’identifie, ni tes projets ni ton code.',
    telemetryMore: 'En détail',
  },

  // The « Projets » tab: one project's own settings.
  project: {
    identity: 'Identité',
    nameLabel: 'Nom du projet',
    colorN: 'Couleur {n}',
    /** The group of the remote control of the project’s agents, after its identity. */
    remoteTitle: 'Remote control',
    remote: 'Remote control pour les agents de ce projet',
    remoteDesc:
      'Chaque agent de ce projet, existant ou nouveau (agents des tickets compris), est accessible depuis claude.ai et l’app Claude. Escouade lance tout de suite le process claude de chacun, qui reste lancé. La session apparaît sur claude.ai sous le nom « projet · agent » (pour un agent de ticket, son nom vient du ticket). En vue Claude Code, une interface déjà ouverte ne le prend qu’à son prochain lancement. Pour mettre un agent à part : clic droit, « Désactiver le remote control ».',
    /** Under the switch, shown on and disabled: the setting for all agents covers the project already. */
    remoteGlobal: 'Activé pour tous les projets dans Réglages › Claude Code',
    worktreePerAgent: 'Un worktree par agent',
    worktreePerAgentDesc: 'Isole les modifications de chaque nouvel agent dans sa propre branche.',
    worktreeDir: 'Dossier des worktrees',
    worktreeDirDesc:
      'Relatif au dossier du projet (../app-worktrees, .worktrees), à ton dossier personnel (~/worktrees/app) ou complet. Vide : .claude/worktrees, comme claude --worktree. Les worktrees déjà créés restent où ils sont ; hors du projet, la vue Claude Code demande d’abord ta confiance pour chacun.',
    /** `{path}`: where the next one goes, `<nom>` standing for its name. */
    worktreeDirAt: 'Le prochain : {path}',
    worktreeDirItself: 'C’est le dossier du projet lui-même.',
    worktreeDirContains: 'Ce dossier contient celui du projet : choisis-en un à côté (../app-worktrees) ou dedans (.worktrees).',
    worktreeDirGit: 'Ce dossier est dans un dossier .git.',
    worktreeDirPartial: 'Écris un chemin relatif au dossier du projet, ou un chemin complet (C:\\…).',
    agentPrefix: 'Préfixe des branches des agents',
    agentPrefixDesc: 'Branche d’un nouvel agent : {prefix}<nom>. Vide : son nom seul.',
    ticketPrefix: 'Préfixe des branches des tickets',
    ticketPrefixDesc: 'Branche d’un ticket, celle de sa PR : {prefix}<clé>. Vide : sa clé seule.',
    /** `{at}`: the characters `@{`, which a text of the catalog cannot hold. */
    prefixInvalid:
      'Aucun nom de branche ne commence ainsi : ni espace, ni « .. », « ~ », « ^ », « : », « ? », « * », « [ », « \\ » ou « {at} », ni « - » ou « / » au début, ni « // », ni une partie qui commence par « . » ou finit par « .lock ».',
    /** Stands for the name of the next agent in `worktreeDirAt`. */
    nextName: '<nom>',
    copy: 'Fichiers copiés dans les worktrees',
    copyDesc: 'Seuls ceux que git ignore, jamais commités ; un motif par ligne : .env* à la racine, **/.env* partout.',
    commit: 'Commit',
    commitDesc: 'Direct : Escouade propose un message, tu le relis et tu commites toi-même.',
    commitModes: {
      agent: "Rédigé par l'agent",
      direct: 'Direct, avec un message proposé',
    },
    worktrees: 'Worktrees',
    worktreesNote:
      "Variables disponibles : ESCOUADE_PROJECT_DIR (le projet), ESCOUADE_WORKTREE_DIR, ESCOUADE_BRANCH, et les ports réservés d'un ticket (ESCOUADE_PORT_BASE, ESCOUADE_PORT_END). Un échec est signalé dans la conversation de l'agent.",
    fill: 'Remplir automatiquement',
    fillButton: '✦ Remplir automatiquement',
    filling: 'Claude lit le projet…',
    fillWorktreesDesc:
      "Claude lit le projet (manifestes, lockfiles, README…) sans rien modifier et propose les commandes. Relis-les avant d'enregistrer.",
    fillLaunchDesc:
      "Claude lit le projet (manifestes, scripts, docker-compose, README…) sans rien modifier et propose les commandes à lancer. Relis-les avant d'enregistrer.",
    proposedWorktrees: 'Commandes de worktree proposées',
    proposedWorktreesNote:
      "Proposition de Claude : relis chaque commande en entier. Elles remplacent les deux listes et, une fois enregistrées, tournent seules : la préparation à l'ouverture de chaque nouveau worktree, le démontage avant sa suppression.",
    proposedLaunch: 'Commandes de lancement proposées',
    proposedLaunchNote: 'Proposition de Claude : relis chaque commande en entier. Elles remplacent celles de la liste.',
    ignore: 'Ignorer',
    replace: 'Remplacer les commandes',
    noCommands: 'Aucune commande.',
    worktreeRoot: 'la racine du worktree',
    projectFolder: 'le dossier du projet',
    setupTitle: "À l'ouverture d'un worktree",
    setupDesc: "Dans l'ordre, avant le premier message de son agent : dépendances, code généré… Les messages attendent la fin.",
    teardownTitle: 'Avant sa suppression',
    teardownDesc: 'Ce que la préparation a créé hors du worktree (base de données, conteneurs…) ; souvent rien.',
    launch: 'Lancement',
    launchNote:
      'Chaque commande tourne dans son propre terminal, en lecture seule. Lance-les depuis la section « Lancement » de la barre latérale.',
    commandN: 'Commande {n}',
    namePlaceholder: 'ex. Front',
    commandPlaceholder: 'ex. npm run dev',
    subfolderHint: '(vide = dossier du projet)',
    subfolderPlaceholder: 'ex. apps/web',
    noCommandsYet: "Aucune commande pour l'instant.",
    danger: 'Zone sensible',
    close: 'Fermer le projet',
    closeDesc:
      "Le projet quitte l'application : ses agents, ses terminaux et ses lancements s'arrêtent. Son historique (conversations, tickets, réglages) est gardé : rouvrir ce dossier le retrouve. Les fichiers et les worktrees sur le disque ne sont pas touchés.",
    closeButton: 'Fermer le projet…',
  },

  // The projects closed with their history kept (under the « Projets » tab).
  closed: {
    title: 'Projets fermés',
    note: 'Leur historique est gardé : ajouter un projet dans leur dossier le retrouve.',
    /** `{size}`: what the history takes on the disk; `{date}`: its last activity. */
    detail: '{size} · dernière activité le {date}',
    erase: "Effacer l'historique…",
    eraseTitle: "Effacer l'historique de « {name} » ?",
    eraseBody:
      'Ses conversations, ses tickets et ses réglages sont effacés pour de bon. Les fichiers et les worktrees sur le disque ne sont pas touchés.',
    eraseConfirm: "Effacer l'historique",
    /** Ouvre la fenêtre d'ajout sur le dossier du projet fermé et sur cet historique-là. */
    reopen: 'Rouvrir',
    /** Un fichier de projet fermé que l'application ne sait pas lire : il ne peut qu'être effacé, lui seul. */
    unreadable: 'Historique illisible',
    eraseFile: 'Effacer',
    /** `{file}` : le nom du fichier (`abc123.json`). */
    eraseFileTitle: 'Effacer le fichier « {file} » ?',
    eraseFileBody:
      "Ce fichier, que l'application ne peut pas lire, est effacé pour de bon. Les autres historiques, les fichiers et les worktrees sur le disque ne sont pas touchés.",
    eraseFileConfirm: 'Effacer le fichier',
  },

  // The commands run in a project's worktrees (their setup, their teardown), in order.
  steps: {
    setup: {
      group: 'Commande de préparation {n}',
      add: 'Ajouter une commande de préparation',
    },
    teardown: {
      group: 'Commande de démontage {n}',
      add: 'Ajouter une commande de démontage',
    },
    commandPlaceholder: 'ex. npm ci',
    subfolderTitle: 'Sous-dossier du worktree (vide : sa racine)',
    subfolderPlaceholder: 'sous-dossier',
    /** `keys`: the shortcut, as the system writes it. */
    up: 'Monter ({keys})',
    upN: 'Monter la commande {n}',
    down: 'Descendre ({keys})',
    downN: 'Descendre la commande {n}',
    deleteN: 'Supprimer la commande {n}',
  },
} as const satisfies Tree;
