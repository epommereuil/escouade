import type { Tree } from '../types';

// The Kanban: its columns, tickets and criteria.
export default {
  // The four columns (glossary): their names and what one says while it holds nothing.
  columns: { todo: 'À faire', doing: 'En cours', review: 'À tester', done: 'Terminé' },
  empty: {
    todo: "Ajoute un ticket : un agent le prendra dès qu'une place se libère.",
    doing: 'Aucun agent en boucle',
    review: 'Rien à tester',
    done: 'Aucun ticket terminé',
  },

  column: { newTicket: 'Nouveau ticket' },

  // The header of the board.
  header: {
    sub: {
      one: '{name} · {count} ticket · {looping} en boucle',
      other: '{name} · {count} tickets · {looping} en boucle',
    },
    noEngine: 'Aucun harness trouvé — aucun ticket ne démarre',
    importTitle: 'Importer des tickets de Jira, Trello, GitHub Issues ou Linear',
    settingsTitle: 'Réglages du Kanban — {summary}',
    afterApproval: 'Après validation :',
    autopilotTitle: "Les tickets « À faire » partent seuls dès qu'une place se libère",
    autopilot: 'Pilote auto',
    autopilotOff: 'Pilote auto · off',
    resumeNow: 'Reprendre maintenant',
  },

  // A ticket's card.
  card: {
    openExternal: 'Ouvrir {key} dans {service}',
    syncError: 'Synchro avec {service} : {error}',
    resync: 'Resynchroniser',
    loop: 'Boucle {iteration}/{max}',
    partial: 'Objectif partiel',
    // Its own model or effort, which come before the Kanban's for its agent (the label of the chip, and its tooltip).
    ownModel: 'Modèle de ce ticket : {model} (avant celui du Kanban)',
    ownEffort: 'Effort de ce ticket : {effort} (avant celui du Kanban)',
    ownBoth: 'Modèle de ce ticket : {model}, effort {effort} (avant celui du Kanban)',
    doneHeading: 'Ce qui a été fait',
    progressLabel: 'Avancement',
    moreSteps: { one: '{count} autre élément', other: '{count} autres éléments' },
    criteriaLabel: 'Critères',
    images: { one: '{count} image jointe', other: '{count} images jointes' },
    files: { one: '{count} fichier joint', other: '{count} fichiers joints' },
    criteriaMetLabel: 'Critères atteints',
    criteriaMet: { one: '{met}/{total} critère', other: '{met}/{total} critères' },
    todoMeta: { one: '{count} critère · max {max} boucles', other: '{count} critères · max {max} boucles' },
    questionWaiting: 'Question en attente de ta réponse',
    resumes: 'Reprise {when}',
    settingUp: 'Prépare le worktree · {step}',
    thinking: 'Réfléchit',
    costLabel: 'Coût du ticket',
    launch: 'Lancer',
    launchTitle: 'Lancer {key} ?',
    launchAnyway: 'Lancer quand même',
    stopTests: 'Arrêter',
    test: 'Tester',
    resume: 'Reprendre',
    agentResolves: "L'agent résout",
    sendBack: 'Renvoyer',
    prioritize: 'Passer en tête',
    openAgent: "Ouvrir l'agent",
    removeTitle: 'Supprimer {key} ?',
    removeBody: 'Le ticket et sa description sont supprimés.',
    removeBodyImported: 'Le ticket et sa description sont supprimés. Il ne sera plus importé depuis {service}.',
    // A ticket with images: they are files of its folder, which go with it.
    removeBodyImages: {
      one: 'Le ticket, sa description et son image sont supprimés.',
      other: 'Le ticket, sa description et ses {count} images sont supprimés.',
    },
    removeBodyImportedImages: {
      one: 'Le ticket, sa description et son image sont supprimés. Il ne sera plus importé depuis {service}.',
      other: 'Le ticket, sa description et ses {count} images sont supprimés. Il ne sera plus importé depuis {service}.',
    },
    // A ticket with files (alone or with images): `count` is all its attachments, which go with it.
    removeBodyFiles: {
      one: 'Le ticket, sa description et sa pièce jointe sont supprimés.',
      other: 'Le ticket, sa description et ses {count} pièces jointes sont supprimés.',
    },
    removeBodyImportedFiles: {
      one: 'Le ticket, sa description et sa pièce jointe sont supprimés. Il ne sera plus importé depuis {service}.',
      other: 'Le ticket, sa description et ses {count} pièces jointes sont supprimés. Il ne sera plus importé depuis {service}.',
    },
    removeRunningTitle: 'Supprimer le ticket {key} ?',
    removeRunningBody: 'Son agent est archivé, avec son worktree.',
    approveTitle: 'Valider {key} ?',
    approveBody: 'Le worktree de son agent est supprimé après le merge.',
  },

  // The form of a ticket, new or edited, in its window.
  form: {
    newTitle: 'Nouveau ticket',
    /** « Harness » of the ticket, from two harnesses found on: the project's by default, which the autopilot follows. */
    engine: 'Harness',
    engineProject: 'Celui du projet ({engine})',
    editTitle: 'Modifier {key}',
    addHint: '{key} pour ajouter',
    saveHint: '{key} pour enregistrer',
    discardTitle: 'Abandonner les modifications ?',
    discardBody: 'Ce que tu as saisi dans ce ticket ne sera pas enregistré.',
    discard: 'Abandonner',
    title: 'Titre du ticket',
    descriptionPlaceholder: 'Description (facultative)',
    description: 'Description',
    criteriaPlaceholder: "Critères d'acceptation, un par ligne",
    criteria: "Critères d'acceptation",
    maxLoops: 'Boucles max',
    after: 'Après',
    searchKey: 'Rechercher une clé',
    noMatch: 'Aucun ticket pour cette clé',
    // The button over the description that attaches any file (an image or not), as pasting and dropping do.
    attach: 'Joindre un fichier',
    attachTitle: 'Joindre un fichier (ou colle-le, glisse-le dans la fenêtre)',
    // The files that are no image of the ticket, as chips under its images: copied at once, kept with the ticket.
    files: {
      label: 'Fichiers du ticket',
      tooMany: "{name} n'est pas ajouté : un ticket prend {max} fichiers au plus.",
    },
    // The images pasted or dropped in the window, under the description: the formats and limits of the chat.
    images: {
      label: 'Images du ticket',
      // Several images are named with their rank: screenshots are all called image.png.
      ranked: '{name} ({n}/{total})',
      remove: 'Retirer {name}',
      loading: 'Chargement de {name}…',
      missing: "{name} n'est plus dans le dossier du ticket : il en est retiré à l'enregistrement.",
      notImage: "« {name} » n'est pas une image : un ticket prend les images PNG, JPEG, GIF et WebP.",
      totalTooBig: "{name} n'est pas ajoutée : les images d'un ticket sont limitées à {max} en tout.",
      tooMany: "{name} n'est pas ajoutée : un ticket prend {max} images au plus.",
    },
  },

  // The form that sends a ticket back to its agent.
  reject: { comment: 'Ce qui ne va pas', submit: 'Renvoyer' },

  // The report an agent gives when it hands a ticket over: its criteria, its progress, its test launch.
  report: {
    title: 'Bilan des critères',
    criterion: 'Critère {n}',
    doneHeading: 'Ce qui a été fait',
    progressLabel: 'Avancement',
    testLaunch: 'Lancement de test',
    prepare: 'Préparation',
    process: 'processus {n}',
    test: 'Tester',
  },
} as const satisfies Tree;
