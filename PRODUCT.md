# Product

<!-- impeccable:product-schema 1 -->

Ce que les skills Impeccable doivent savoir d'Escouade, quel que soit l'écran : l'app comme le site.

## Platform

web

L'app est une fenêtre desktop Tauri 2 (Windows, macOS et Linux) dessinée en technologies web (Svelte 5) ; le site de présentation est un site statique Nuxt 4, dans `website/`.

## Users

Des développeurs qui développent avec des agents, plusieurs en parallèle sur leurs projets, sous Windows 10 ou 11, macOS 11 et plus ou Linux, avec un ou plusieurs comptes Claude (perso, pro…) ou une clé API. Ils lancent le travail, puis reviennent quand un agent a besoin d'eux : une question, une autorisation, une tâche finie, un ticket à tester.

## Product Purpose

Escouade est l'environnement où ces développeurs mènent tout le cycle avec leurs agents, du ticket au merge, dans une fenêtre native : ils planifient, les agents codent, ils relisent, testent et livrent, et ne sont appelés que quand il le faut. Réussi : plusieurs tickets avancent en même temps sans qu'on surveille des terminaux, chaque changement se relit et se teste avant d'entrer, et rien n'attend sans qu'on le sache.

## Positioning

Un environnement de développement agentique (ADE) complet : l'endroit où l'on développe avec des agents de bout en bout, pas seulement celui où on leur parle. Le récit suit le cycle de développement, dans cet ordre :

- **Planifier** : un Kanban de tickets avec leurs critères d'acceptation, leurs captures et leurs fichiers, importés de Jira, Trello, GitHub ou Linear, que le pilote auto confie à des agents qui bouclent jusqu'à les atteindre.
- **Coder** : des agents en parallèle, chacun dans son worktree, dans un vrai chat ou dans l'interface du moteur ; leurs sous-agents, leurs tâches de fond et leur plan à vue ; un éditeur et de vrais terminaux.
- **Relire et tester** : diffs, git graph et branches, « ▶ Tester » sur chaque ticket, les commandes qui lancent le projet.
- **Livrer** : commit relu, merge (squash ou rebase), push ou pull request ; un conflit revient à l'agent.
- **Piloter** : un signal dès qu'un agent attend, la vue d'ensemble, quotas, coût et statistiques, plusieurs comptes, un serveur MCP qui laisse un agent mener Escouade, le téléphone.

Gratuit, local et open source (GPL-3.0). Le récit ne repose pas sur le nom du moteur : les agents tournent aujourd'hui sur le Claude Code de l'utilisateur, d'autres moteurs (Codex, Copilot CLI, Cursor CLI, OpenCode) et les hébergeurs de code (PR, CI, déploiements) viennent s'y ajouter sans le réécrire. On n'annonce que ce qui est publié ; ce qui arrive va dans la feuille de route.

## Operating Context

- Chaque agent est un process `claude` local, dans le dossier du projet ou dans son propre worktree ; conversations, projets et statistiques restent dans `~/.escouade/` (le dossier de chaque compte Claude ajouté compris).
- Le réseau ne sert qu'à Claude Code lui-même, à la lecture des quotas, aux mises à jour de l'app et, si l'utilisateur les connecte, à Jira, Trello ou GitHub. Le serveur MCP d'Escouade (1.7) n'écoute que sur la machine, derrière un jeton.
- Statuts d'un agent : Prêt, En cours, Question, Terminé (et erreur). Un ticket passe par À faire, En cours (avec sa boucle, « boucle 2/5 »), À tester, Terminé.
- Les raccourcis portent l'usage quotidien : Ctrl+N nouvel agent, Ctrl+J prochain agent qui attend, Ctrl+1…9 projets.

## Capabilities and Constraints

- Projets en onglets, agents en parallèle avec leur modèle (Fable, Opus, Sonnet, Haiku), leur effort et leur mode de permission ; copie d'un agent qui reprend sa conversation (1.6).
- Français et anglais (1.7) : l'interface suit la langue du système ou le choix de l'utilisateur, sans redémarrer ; nombres, dates et pluriels suivent la langue. Une langue à part pour ce que Claude rédige (messages de commit, pull requests, commentaires Jira, Trello et GitHub, consignes aux agents).
- Plusieurs comptes Claude (1.7) : chacun son dossier de configuration et sa connexion, ajoutés et connectés depuis l'app ; quotas et statistiques par compte, nouveaux agents et tickets envoyés sur le premier compte sous le seuil, agent arrêté par la limite d'usage repris sur un autre compte.
- Serveur MCP (1.7) : Claude, depuis un terminal, un autre outil ou un agent d'Escouade, lit les projets, agents et tickets et peut créer, déplacer et lancer des tickets ou des agents, sous les garde-fous du pilote auto ; aucune permission accordée, aucune commande lancée, rien supprimé ; journal des appels.
- Vue d'ensemble (1.6) : tous les agents de tous les projets, ceux qui attendent en tête, avec les autorisations qui s'accordent sur place.
- Chat natif : markdown, appels d'outils compacts, questions et autorisations en cartes cliquables, auxquelles on répond aussi au clavier ; brouillons gardés, position de lecture retrouvée, longues conversations dessinées par tranches.
- Avancée d'un plan (1.7) : un bandeau « Plan » dans la conversation et une ligne sur la carte de l'agent disent les tâches faites, en cours ou bloquées, les sous-agents qui travaillent et ce qu'ils font, d'après la liste de tâches de l'agent ou son plan superpowers. Le modèle n'est pas obligé de tenir une liste ; les workflows de Claude Code ne sont pas montrés.
- Recherche dans les conversations de tous les agents (1.6), sans tenir compte de la casse ni des accents.
- Notifications : onglet et carte qui clignotent, carillon, notification système qui dit ce qui est demandé, barre des tâches ou Dock ; choix des types qui préviennent.
- Git : fichiers non commités, diffs (les gros se déplient par tranches), git graph, commit rédigé par l'agent ou commit direct avec un message proposé par Haiku, merge ou squash d'un worktree dans sa branche de base.
- Branches (1.7) : sélecteur de branche dans la barre d'état (changer, créer, supprimer, nettoyer les branches mergées, avance et retard sur la branche distante), menu du git graph (créer une branche, passer dessus, comparer), agent lancé sur une branche existante, base intégrée dans la branche d'un agent.
- Éditeur intégré : aller à une définition sans serveur de langage, recherche dans les fichiers, ouverture rapide d'un fichier, changements montrés dans le texte et comparaison avec la version du disque, renommer et supprimer (1.6) ; vrais terminaux (PowerShell, Git Bash, WSL ; zsh, bash, fish).
- Commandes de lancement du projet (proposées par Claude), et lancements de test sur des ports réservés, dont la recette écrite par l'agent se lit et s'approuve avant de tourner.
- Barre de statut et statistiques : tokens et coût en direct, quotas de session de 5 h et hebdomadaire du compte en cours (compacts, le détail de chaque compte en un clic, 1.7), coût par agent, par ticket et par compte.
- Kanban (1.3) : des tickets avec critères d'acceptation, pris par des agents dans leur propre worktree, qui bouclent jusqu'à les atteindre puis passent « À tester » ; validation par merge, pull request ou push. Dépendances entre tickets et pause du pilote auto près de la limite des quotas (1.6). Un ticket s'écrit dans une grande fenêtre et peut reprendre une branche existante (1.7).
- Intégrations (1.4) : import et synchro des tickets Jira, Trello et GitHub Issues, synchros ratées retentées, jetons dans le trousseau du système (1.6).
- Mises à jour silencieuses (1.6) : téléchargées en arrière-plan, installées sans fenêtre, au redémarrage quand l'app est au repos.
- Remote control depuis claude.ai et l'app Claude sur mobile.
- Pas encore de Linux. L'app macOS est signée avec un certificat Apple Developer ID et notarisée depuis la 1.5.4.

## Brand Commitments

- Nom : Escouade (anciennement « Claude Code Manager » ; l'ancien nom et « CCM » n'apparaissent plus).
- Logo (depuis le 2026-10-11) : « l'invite », une tuile arrondie pleine en #35C1BD portant, en encre presque noire (#08090A), le chevron `>` de Claude Code et une étincelle à huit rayons à la place du curseur (`public/logo.svg`, `website/public/logo.svg`, icônes de l'app tirées de `src-tauri/icons/app-icon.svg` par `npx tauri icon`). Il remplace les trois fenêtres empilées ; les pistes écartées sont dans `design/logo-explorations/`.
- Voix : en français, au tutoiement, simple et concrète, sans emphase publicitaire ; depuis la 1.7 l'app et le site existent aussi en anglais (la vidéo garde sa voix française, avec des sous-titres anglais), dans le même ton.
- Projet indépendant, non affilié à Anthropic ; Claude et Claude Code sont des marques d'Anthropic, et le site le dit.
- Le site suit le standard des sites d'outils de dev, au niveau de finition de Linear et de Raycast, sans thème ni gadget : choix de l'utilisateur du 2026-10-11, après avoir vu sur aperçu des directions plus marquées (tableau des départs, cuisine, cracktro) et les avoir écartées.

## Evidence on Hand

- Captures et vidéo de présentation, rendues depuis les composants de l'app dans `video/` : `website/public/images/*.jpg` et `website/public/images/en/` (l'app en anglais), `website/public/escouade.mp4` avec ses sous-titres français et anglais.
- La version, lue dans `src-tauri/tauri.conf.json` ; les releases sur GitHub.
- Aucun témoignage, nombre d'utilisateurs, benchmark ni article de presse : rien de tout cela ne s'invente. Les données de démonstration (noms d'agents, tokens, coûts) sont fictives, comme sur les captures.

## Product Principles

- Le développeur garde la vue d'ensemble ; les agents font le travail et disent quand ils ont besoin de lui.
- Montrer la vraie chose : l'app au travail plutôt que des promesses sur elle.
- Local et transparent : le Claude Code de l'utilisateur, sa machine, du code ouvert.
- Des mots qui disent exactement ce qui se passe, en français ou en anglais selon l'utilisateur.

## Accessibility & Inclusion

Les couleurs de texte respectent le WCAG AA (4,5:1) sur le fond (testé dans `website/tests/tokens.test.ts`) ; les animations respectent `prefers-reduced-motion` ; tout se fait au clavier, avec un focus visible.
