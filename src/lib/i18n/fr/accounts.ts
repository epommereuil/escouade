import type { Tree } from '../types';

// The accounts of every harness.
export default {
  /** The user's own account, as long as they have not renamed it (its name is saved in the language of its first save). */
  principal: 'Principal',

  // The « Comptes » tab of the settings: a group per harness.
  tab: {
    list: 'Comptes',
    /** The accounts of one harness; `{harness}`: « Claude Code ». */
    group: 'Comptes {harness}',
    order: 'Les nouveaux agents partent sur le premier compte actif de leur harness sous le seuil de pause, dans cet ordre.',
    name: 'Nom',
    folder: 'Dossier',
    executable: 'Exécutable',
    executableDefault: 'Celui des réglages',
    active: 'Actif',
    lastActive: 'Il faut au moins un compte actif par harness.',
    up: 'Monter {name}',
    down: 'Descendre {name}',
    signIn: 'Se connecter…',
    signInAgain: 'Se reconnecter…',
    remove: 'Supprimer',
    add: 'Ajouter un compte…',
    /** A harness installed without an account (ESC-128): nothing starts on it. */
    none: 'Aucun compte',
    noneHint: 'Aucun agent ni ticket ne démarre sur {harness} avant qu’un compte soit ajouté.',
    addTo: 'Ajouter un compte {harness}…',
    /** The Principal of a harness: its usual folder, as it is. */
    machine: 'Compte de la machine',
    /** What the account's new agents go with (ESC-128). */
    defaults: 'Nouveaux agents',
    defaultModel: 'Modèle',
    defaultEffort: 'Effort',
    defaultMode: 'Mode',
    harnessDefault: 'Celui du harness',
    harnessDefaultNamed: 'Celui du harness ({name})',
    reserved: 'Réservé aux projets',
    reservedAll: 'Tous les projets',
    /** For a harness without a quota (OpenCode), which goes through the providers' APIs. */
    budget: 'Budget par jour ($)',
    budgetNone: 'Aucun',
    budgetHint:
      'Atteint, le pilote auto se met en pause jusqu’à minuit, comme au quota épuisé. Vide : aucun budget. Un modèle local ne coûte rien.',
    budgetInvalid: 'Le budget par jour est un montant en dollars, positif.',
    /** Un projet fermé (son historique est gardé) auquel le compte reste réservé : coché, jusqu'à ce qu'on le décoche ou que l'historique soit effacé. */
    closedProject: '{name} (fermé)',
    /** `{names}` : les projets, chacun entre guillemets (`quoted`) et énumérés comme dans une phrase. */
    noAccount: {
      one: 'Aucun compte actif de son harness par défaut ne sert {names} : ses agents et ses tickets ne démarrent pas.',
      other: 'Aucun compte actif de leur harness par défaut ne sert {names} : leurs agents et leurs tickets ne démarrent pas.',
    },
    quoted: '« {name} »',
    reservedHint:
      'Coche des projets pour garder ce compte à eux seuls (les projets d’un client, par exemple) : les autres n’y partent jamais.',
    stillUsed: { one: 'Le compte sert encore à {count} agent.', other: 'Le compte sert encore à {count} agents.' },
    state: {
      checking: 'Vérification…',
      connected: 'Connecté · {email}',
      connectedNoEmail: 'Connecté',
      notConnected: 'Pas connecté',
      /** Principal without a claude.ai sign-in: most likely run with an API key. */
      principalNotConnected: 'Pas connecté par un compte claude.ai (clé d’API ?)',
      inactive: 'Inactif',
    },
    removeMachineConfirm: {
      title: 'Retirer le compte de la machine « {name} » ?',
      body: 'Les nouveaux agents ne partiront plus dessus. {harness} reste connecté sur cette machine : le retirer ne déconnecte rien ({path}).',
      confirm: 'Retirer',
    },
    removeConfirm: {
      title: 'Supprimer le compte « {name} » ?',
      body: 'Les nouveaux agents ne partiront plus dessus. Son dossier reste sur le disque, avec sa connexion et ses conversations : {path}',
      confirm: 'Supprimer',
    },
  },

  // « Ajouter un compte… » and « Se connecter… ».
  modal: {
    addTitle: 'Ajouter un compte {harness}',
    harness: 'Harness',
    /** What is added (ESC-128): the machine's account of the harness, or a new one. */
    kind: 'Compte',
    machine: 'Le compte de la machine',
    machineConnected: '{harness} est connecté sur cette machine · {email}',
    machineConnectedNoEmail: '{harness} est connecté sur cette machine',
    machineFound: '{harness} est installé sur cette machine',
    machineNotConnected: '{harness} n’est pas connecté sur cette machine',
    machineAdded: 'Déjà ajouté',
    machineChecking: 'Vérification…',
    machineHint: 'Son dossier habituel, tel quel : ses réglages, sa connexion et ses conversations ({path}).',
    newAccount: 'Un nouveau compte',
    newHint: 'Un dossier à lui sous ~/.escouade, et sa propre connexion.',
    addMachine: 'Ajouter ce compte',
    signInTitle: 'Se connecter au compte « {name} »',
    name: 'Nom',
    namePlaceholder: 'Pro, Équipe…',
    share: 'Partager avec {name}',
    /** The machine's account of the harness, not added (ESC-128): what a new account shares, and what is said of it. */
    shareMachine: 'Partager avec le compte de la machine',
    machineName: 'Le compte de la machine',
    files: 'Fichiers',
    folders: 'Dossiers',
    filesCopied: 'copiés (un lien de fichier demande des droits d’administrateur)',
    mode: 'Partage',
    link: 'Lier (un changement vaut pour les deux comptes)',
    copy: 'Copier',
    nothingToShare: '{name} n’a ni réglages, ni CLAUDE.md, ni skills, agents, commandes, plugins, hooks ou styles de sortie à partager.',
    neverShared: 'La connexion (.credentials.json) et .claude.json ne sont jamais partagés : chaque compte a les siens.',
    create: 'Créer et se connecter',
    signInHint: 'Connecte-toi dans le terminal ci-dessous (commande /login si Claude Code ne la propose pas).',
    connected: 'Connecté au compte {email}',
    connectedNoEmail: 'Connecté',
    ended: '{harness} s’est arrêté avant la connexion.',
    // What a Codex account keeps apart (its folder is a CODEX_HOME).
    codex: {
      nothingToShare: '{name} n’a ni config.toml, ni AGENTS.md, ni skills, prompts ou règles à partager.',
      neverShared: 'La connexion (auth.json) n’est jamais copiée : chaque compte a la sienne (son jeton change à chaque renouvellement).',
      signInHint: 'Connecte-toi dans le terminal ci-dessous : codex login ouvre ton navigateur sur la connexion de ChatGPT.',
    },
    // What a Copilot CLI account keeps apart (its folder is a COPILOT_HOME).
    copilot: {
      nothingToShare: '{name} n’a ni mcp-config.json, ni copilot-instructions.md, ni agents ou skills à partager.',
      neverShared:
        'La connexion n’est jamais copiée : chaque compte se connecte par copilot login (son config.json et le trousseau du système), sans le jeton du GitHub CLI.',
      signInHint: 'Connecte-toi dans le terminal ci-dessous : copilot login donne un code à saisir sur github.com/login/device.',
    },
    restart: 'Relancer',
    done: 'Terminé',
  },

  // The account chip of the Composer, before the agent's first message.
  composer: {
    caption: 'Compte',
    auto: 'Automatique ({name})',
    autoNone: 'Automatique (aucun compte)',
    autoDetail: 'Celui du projet, sinon le premier compte sous le seuil de pause.',
    inactive: '{name} (inactif)',
    locked: 'Le compte d’un agent ne change plus après son premier message (sa conversation est rangée dans ce compte).',
  },

  // « Compte préféré » in a project's settings.
  project: {
    label: 'Compte préféré',
    desc: 'Le compte sur lequel partent les nouveaux agents et les tickets de ce projet.',
    auto: 'Automatique',
    autoTitle: 'Le premier compte actif sous le seuil de pause, dans l’ordre des comptes',
    inactive: '{name} (inactif)',
  },

  // Under the autopilot's pause: the accounts that are past « Pause au-delà du quota ».
  pause: {
    over: { one: 'Le compte {accounts} a passé le seuil.', other: 'Les comptes {accounts} ont passé le seuil.' },
  },

  // The current account's quota in the status bar (the percentage is in a tooltip), and the panel of every account's.
  // Each bar is a window of the quota, labelled by its length (`{n}`), or the month's credits.
  quota: {
    hours: { label: '{n}h', name: { one: 'Quota sur {count} heure', other: 'Quota sur {count} heures' } },
    days: { label: '{n}j', name: { one: 'Quota sur {count} jour', other: 'Quota sur {count} jours' } },
    credits: { label: 'crédits', name: 'Crédits du mois' },
    /** A week's window, as its bar is labelled. */
    week: { label: '7j' },
    /** `{countdown}`: the time left, as `fCountdown` writes it. */
    reset: 'reset {countdown}',
    /** After the reset: where the window would end at the pace used so far; `{pct}`: « 112 % ». */
    projected: '→ {pct}',
    /** The value of a bar: `{pct}`: « 42 % »; `{date}`: « 10/10 »; `{time}`: « 18:00 ». */
    tip: '{pct} · remise à zéro le {date} à {time}',
    unavailable: 'Quota indisponible',
    /** One window as the bar group says it to the keyboard and to screen readers; `{name}`: « Quota sur 5 heures », `{tip}`: the tooltip's text. */
    line: '{name} : {tip}',
  },

  // The panel the quota group opens, above the status bar, when there are several accounts.
  panel: {
    /** The button that is the quota group; `{name}`: the current account. */
    open: 'Quotas par compte (compte en cours : {name})',
    title: 'Quotas des comptes',
    /** Under a harness without a quota: only what its turns cost. */
    noQuota: 'Pas de quota : seul le coût de ses tours compte.',
    current: 'en cours',
    over: 'au-delà du seuil de pause',
    /** What the account's turns cost today; `{amount}`: « 1,20 $ » (« ≈ 1,20 $ » while a turn is running). */
    today: "Aujourd'hui : {amount}",
  },

  // The card of a turn stopped by the usage limit: go on on another account (the session goes along).
  resume: {
    /** `{account}`: the account the agent goes on on. */
    on: 'Reprendre sur {account}',
    /** The button that opens the menu of the other accounts. */
    another: 'Reprendre sur un autre compte',
    /** The turn that followed the move failed; `{account}`: the account it went to, `{error}`: what Claude Code said. */
    failed: 'La reprise sur {account} a échoué : {error}.',
    /** `{account}`: the account the agent came from. */
    back: 'Revenir sur {account}',
  },

  // « Ordre des harness », in the « Comptes » tab once there are two harnesses.
  engineOrder: {
    label: 'Ordre des harness',
    desc: 'Après son harness par défaut, un projet passe aux suivants dans cet ordre quand le quota du sien est épuisé, s’ils ont un compte actif qui le sert.',
    up: 'Monter {name}',
    down: 'Descendre {name}',
  },

  // The setting of the Harness tab.
  switchOnLimit: {
    label: 'Reprendre sur un autre compte un agent de ticket arrêté par la limite',
    desc: 'Sinon il attend la remise à zéro de son compte',
  },
} as const satisfies Tree;
