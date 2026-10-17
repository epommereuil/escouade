# Plusieurs comptes Claude

Escouade peut lancer tes agents sur plusieurs comptes Claude (personnel, travail, client) et choisit seule celui de chaque nouvel agent. Cette page explique comment les ajouter, les ordonner, les réserver à des projets et reprendre un agent arrêté par la limite d’usage sur un autre compte.

## À quoi servent plusieurs comptes

Un compte Claude, c’est une connexion à claude.ai avec ses quotas (une fenêtre de 5 heures et une fenêtre hebdomadaire) et ses conversations. Avec plusieurs comptes, tu sépares le perso du pro, ou tu gardes un compte à part pour les projets d’un client. Quand un compte atteint le seuil de pause, les nouveaux agents partent sur un autre.

Chaque compte est Claude Code lancé avec son propre dossier de configuration (la variable `CLAUDE_CONFIG_DIR`) : il a donc sa connexion, ses sessions et son quota. Escouade ne partage jamais la connexion d’un compte avec un autre.

Cette page explique l’usage ; la liste des options de l’onglet est dans [les réglages des comptes](settings-accounts).

## Principal

« Principal » est ton compte Claude habituel, celui que Claude Code utilisait avant que tu en ajoutes un autre. Il existe dès le premier lancement.

- Escouade le lance comme avant : elle ne lui donne pas de dossier de configuration. Il garde ta connexion et tes conversations. Son dossier est celui de la variable `CLAUDE_CONFIG_DIR` quand elle est définie pour l’app, sinon `~/.claude`. Sous macOS, lui donner un dossier te déconnecterait : Claude Code change alors le nom de l’entrée du trousseau où il garde la connexion.
- Il s’appelle « Principal » tant que tu ne l’as pas renommé, dans la langue de l’interface.
- Il ne se supprime pas. Comme les autres comptes, il se renomme, se désactive (tant qu’un autre compte est actif), se réserve à des projets et peut avoir son propre exécutable.
- S’il n’est pas connecté par un compte claude.ai (avec une clé d’API, par exemple), l’onglet l’indique : « Pas connecté par un compte claude.ai (clé d’API ?) ».

## Ajouter un compte

1. Ouvre les réglages (`Ctrl+,`, ou ⚙ dans la barre de statut) et l’onglet « Comptes Claude ».
2. Clique sur « Ajouter un compte… ».
3. Écris le nom du compte dans « Nom » (le champ suggère « Pro, Équipe… »). Deux comptes ne peuvent pas porter le même nom, majuscules ou non.
4. Choisis ce que le compte reprend de Principal, sous « Partager avec Principal » (voir ci-dessous).
5. Clique sur « Créer et se connecter ». Le compte est créé, actif et placé en dernier dans la liste, puis la fenêtre ouvre sa connexion.

Escouade crée pour le compte un dossier sous `~/.escouade/claude/`, nommé d’après le compte. Elle ne reprend jamais le dossier d’un compte supprimé : un nouveau compte a toujours un dossier neuf.

> [!NOTE]
> Sous macOS, `Ctrl` devient `⌘` dans les raccourcis (sauf `Ctrl+Tab`).

### Ce qu’un compte reprend de Principal

Un nouveau compte peut reprendre une partie de ce que tu as réglé dans Claude Code pour Principal. Seuls les éléments que le dossier de Principal contient sont proposés, et ils sont tous cochés au départ. Si Principal n’a rien à partager, la fenêtre le dit.

| Élément | Type |
|---|---|
| `settings.json` | Fichier : les réglages de Claude Code |
| `CLAUDE.md` | Fichier : tes consignes |
| `skills`, `agents`, `commands` | Dossiers : skills, agents et commandes |
| `plugins`, `hooks` | Dossiers : plugins et hooks |
| `output-styles` | Dossier : styles de sortie |

Le choix « Partage » dit comment ces éléments sont repris :

- « Lier (un changement vaut pour les deux comptes) » (par défaut) : le compte pointe vers l’élément de Principal. Une modification faite d’un côté se retrouve de l’autre. Sous Windows, les dossiers sont liés par une jonction, qui ne demande pas de droits d’administrateur, mais les fichiers sont copiés, parce qu’un lien vers un fichier en demande ; la fenêtre le rappelle : « copiés (un lien de fichier demande des droits d’administrateur) ».
- « Copier » : le compte reçoit une copie, et chacun modifie ensuite la sienne.

Deux cas font exception. Quand le dossier de Principal est dans une distribution WSL, tout est copié, quel que soit le choix. Sous Windows, un chemin qui contient `%` ou un guillemet droit ne peut pas être lié : le message te demande alors de choisir « Copier ».

> [!NOTE]
> La connexion (`.credentials.json`) et le fichier `.claude.json` (l’adresse e-mail, les serveurs MCP et les projets du compte) ne sont jamais partagés : chaque compte a les siens.

### Se connecter au compte

Après « Créer et se connecter », la fenêtre change de titre (« Se connecter au compte » suivi du nom du compte) et affiche un terminal où tourne le `claude` du compte, avec son dossier de configuration.

1. Connecte-toi dans ce terminal, comme dans Claude Code : suis les instructions, le navigateur s’ouvre. Si Claude Code ne propose pas la connexion, tape `/login`.
2. Escouade cherche la connexion toutes les 2 secondes. Dès qu’elle la trouve, la fenêtre écrit « Connecté au compte ada@exemple.dev » (ou « Connecté » quand l’adresse n’est pas encore connue), ferme le terminal une seconde et demie plus tard et lit le quota du compte.
3. Clique sur « Terminé ».

Si Claude Code s’arrête avant la connexion, la fenêtre écrit « Claude Code s’est arrêté avant la connexion. » et propose « Relancer ». Si tu fermes la fenêtre en cours de route, le compte reste dans la liste, « Pas connecté » : reprends avec « Se connecter… ».

« Se connecter… » sert aussi à reconnecter un compte dont la connexion a expiré. Quand le compte est connecté et à jour, le bouton devient « Se reconnecter… » : utile pour passer à un autre compte claude.ai.

## Gérer les comptes

L’onglet « Comptes Claude » des réglages liste les comptes. Chaque changement est enregistré tout de suite, sans passer par l’enregistrement des autres réglages (« Annuler » ne le défait pas). Une ligne par compte :

| Élément | Rôle |
|---|---|
| Nom | Un champ modifiable. Le changement est pris quand tu quittes le champ ou que tu tapes `Entrée`. |
| État | « Vérification… », « Connecté · ada@exemple.dev », « Connecté », « Pas connecté » ou « Inactif ». Une connexion expirée est signalée en ambre sous la ligne : « Connexion expirée : relance Claude Code pour ce compte. » |
| Actif | Un interrupteur. Un compte inactif ne reçoit plus de nouvel agent. Le dernier compte actif ne peut pas être coupé (« Il faut au moins un compte actif. »). |
| ↑ et ↓ | L’ordre des comptes. Les nouveaux agents les essaient dans cet ordre (« Monter Pro », « Descendre Pro »). |
| Dossier | Le dossier de configuration du compte, en lecture seule. |
| Exécutable | Le `claude` que ce compte lance. Vide (« Celui des réglages »), il prend l’exécutable de l’onglet « Claude Code ». |
| Se connecter… / Se reconnecter… | Ouvre la connexion du compte (voir plus haut). |
| Supprimer | Retire le compte (voir plus bas). Absent pour Principal. |
| Réservé aux projets | Les projets auxquels le compte est réservé (voir plus bas). |

Sous la liste, une ligne ambre apparaît quand un projet n’a plus aucun compte actif pour le servir.

## Sur quel compte part un agent

### Le choix automatique

Un nouvel agent, ou un ticket que le pilote auto prend, part sur :

1. le « Compte préféré » du projet, s’il en a un, que ce compte est actif et qu’il sert ce projet ;
2. sinon le premier compte actif de la liste, dans l’ordre, qui sert le projet et dont les quotas ne sont pas au seuil de « Pause au-delà du quota » (un compte qui vient de buter sur sa limite d’usage est aussi écarté) ;
3. si aucun compte n’est sous le seuil, le premier compte actif. Le [pilote auto](autopilot) se met alors en pause.

L’ordre de la liste décide donc : mets en tête le compte que tu veux user en premier.

Le seuil se règle dans Réglages › Kanban, groupe « Pilote auto » : 80, 90, 95 ou 100 % (100 % par défaut), pour tous les projets. Il est détaillé dans [les réglages du Kanban](settings-board).

Quand le compte qui recevait les nouveaux agents passe le seuil et qu’un autre est disponible, une notification le dit : « Le compte Principal a atteint 91 % : les nouveaux agents partent sur Pro. »

### Le compte préféré d’un projet

Avec plusieurs comptes, les réglages d’un projet (onglet « Projets », groupe « Identité ») ont un choix « Compte préféré » : le compte sur lequel partent les nouveaux agents et les tickets du projet.

- « Automatique » (par défaut) : le choix automatique ci-dessus.
- Un compte précis : il est pris même si son quota est au seuil. Les tickets du projet n’attendent alors que ce compte-là.

Un compte préféré qui est devenu inactif, qui est réservé à d’autres projets ou qui n’existe plus est ignoré : le projet repasse en automatique. Supprimer un compte efface aussi la préférence des projets qui l’avaient choisi.

### Choisir le compte à la main

Avec plusieurs comptes, le champ de saisie d’un agent (voir [le chat](chat)) a un menu « Compte » à côté du modèle. Tant que tu n’as rien écrit à l’agent, il propose :

- « Automatique (Pro) » : le compte que le choix automatique prendrait maintenant (« Celui du projet, sinon le premier compte sous le seuil de pause. ») ;
- chaque compte actif qui sert le projet.

Choisir un compte change celui de l’agent avant qu’il ne démarre.

### Chaque agent reste sur son compte

Dès le premier message, le compte d’un agent ne change plus : le menu devient en lecture seule (« Le compte d’un agent ne change plus après son premier message (sa conversation est rangée dans ce compte). »). Claude Code range en effet chaque conversation dans le dossier du compte qui la lance.

Une seule chose déplace un agent : « Reprendre sur… » (plus bas), qui emporte sa session. Les statistiques comptent chaque tour sur le compte qu’avait l’agent à ce moment-là.

## Réservé aux projets

Chaque compte, Principal compris, peut être gardé pour certains projets. Sous un compte, la ligne « Réservé aux projets » liste tes projets avec une case à cocher chacun. Tant qu’aucune case n’est cochée, la ligne finit par « · Tous les projets » : le compte sert tous les projets. Le survol de l’intitulé rappelle le principe : « Coche des projets pour garder ce compte à eux seuls (les projets d’un client, par exemple) : les autres n’y partent jamais. »

Un projet que tu ne coches pas ne peut jamais utiliser le compte :

- ni par le choix automatique, pour un agent comme pour un ticket ;
- ni par le menu « Compte » de l’agent ;
- ni comme « Compte préféré », que le projet ne propose pas ;
- ni par « Reprendre sur… », ni par la reprise automatique.

Les agents déjà partis sur le compte y restent.

C’est fait pour isoler un client : coche ses projets sur son compte, et ses projets ne partent que sur lui.

Si aucun compte actif ne sert un projet (par exemple parce que chaque compte est réservé à d’autres projets), rien ne démarre pour lui :

- le Kanban du projet écrit « Aucun compte Claude pour ce projet — aucun ticket ne démarre » ;
- un nouvel agent est refusé, avec un message qui dit où cocher le projet ;
- l’onglet « Comptes Claude » le dit sous la liste, en ambre, par exemple : Aucun compte actif ne sert « Client » : ses agents et ses tickets ne démarrent pas.

Pour y remédier, coche le projet sur un compte actif, ou décoche toutes les cases d’un compte pour qu’il serve de nouveau tous les projets.

« Fermer le projet » (zone sensible des réglages du projet) garde l’historique du projet, et le projet reste dans la liste « Réservé aux projets » des comptes qui lui étaient réservés : il n’en sort que lorsque son historique est effacé (la case « Effacer aussi son historique » à la fermeture, ou « Effacer l’historique… » dans « Projets fermés »).

Un compte qui n’était réservé qu’à ce projet ne sert donc aucun projet ouvert tant que le projet est fermé. Si c’était ton seul compte actif, plus rien ne démarre pour les autres projets, et l’onglet « Comptes Claude » le dit sous la liste, comme plus haut.

Cet onglet montre le projet fermé dans la ligne « Réservé aux projets » du compte, coché et marqué « (fermé) », par exemple « Client (fermé) ». Décoche-le pour libérer le compte : sans case cochée, il sert de nouveau tous les projets. Quand tu rouvres le projet (voir [Projets fermés](settings-projects#projets-fermes)), ses réservations sont toujours là : il n’y a rien à refaire. Si tu effaces l’historique, à la fermeture ou plus tard dans « Projets fermés », le projet sort de la liste de chaque compte. Le « Compte préféré » du projet, lui, repasse sur « Automatique » à la réouverture si son compte n’existe plus.

## Reprendre un agent arrêté par la limite d’usage

### Ce qui se passe à la limite

Quand Claude refuse un tour parce que le quota du compte est épuisé, l’agent s’arrête. La carte d’erreur du tour, la carte de l’agent dans la barre latérale (« Reprise à 15:00 ») et le Kanban donnent l’heure de la reprise automatique.

Par défaut, Escouade envoie « continue » à l’agent une trentaine de secondes après la remise à zéro du quota, quand elle en connaît l’heure. C’est le réglage « Reprise automatique après la limite d’usage » (Réglages › Harness, groupe « Processus »). Le bouton « Annuler la reprise » de la carte l’annule pour cet agent.

### Reprendre sur un autre compte

Avec plusieurs comptes, la carte propose « Reprendre sur Pro » : le premier compte éligible dans l’ordre de la liste. Quand plusieurs comptes conviennent, le bouton ▾ (« Reprendre sur un autre compte ») ouvre le menu des autres.

Un compte est éligible s’il est actif, différent de celui de l’agent, au service de son projet, connecté et sous le seuil de pause : un compte déjà au seuil est écarté, l’agent y retrouverait la limite.

En cliquant, tu fais ceci :

1. Escouade arrête le processus Claude de l’agent.
2. Elle copie sa session (la conversation et ce que ses sous-agents et ses outils y ont gardé) dans le dossier de l’autre compte.
3. L’agent passe sur ce compte, et sa reprise automatique est annulée.
4. Escouade lui envoie « continue », comme pour une reprise automatique.

La conversation garde une trace : « L’agent reprend sur le compte Pro (il était sur Principal). »

Le déplacement a quelques conditions : l’agent doit avoir fini son tour (« L’agent travaille encore : reprends quand son tour est fini. ») et avoir une session. Une session ne passe pas non plus d’un compte qui lance Claude Code sous Windows à un compte qui le lance dans WSL, ni l’inverse.

Si le tour qui suit échoue sur le nouveau compte, la carte écrit « La reprise sur Pro a échoué : … » et propose « Revenir sur Principal ». Ce bouton ramène la session sur le compte d’origine, avec ce que le tour raté y a ajouté, et l’agent attend de nouveau la remise à zéro qu’il attendait.

### Tout seul, pour les agents de ticket

Le réglage « Reprendre sur un autre compte un agent de ticket arrêté par la limite » (Réglages › Harness, groupe « Processus », visible avec plusieurs comptes) fait la même chose sans toi. Il est désactivé par défaut ; sa description dit : « Sinon il attend la remise à zéro de son compte ».

Activé, l’agent d’un ticket arrêté par la limite passe de lui-même sur un autre compte quand l’un convient : le compte préféré du projet, sinon le premier de la liste. Il faut que ce compte soit connecté, sous le seuil, qu’aucune pause après une limite d’usage ne le retienne, qu’aucun agent n’y attende sa propre remise à zéro, et qu’il soit du même côté de WSL que l’agent. S’il n’y en a pas, ou si le déplacement échoue (la conversation écrit alors « Reprise sur un autre compte impossible : … »), l’agent attend la remise à zéro de son compte, comme avant.

Le compte quitté ne reçoit plus de nouveau ticket jusqu’à sa remise à zéro (30 minutes quand elle n’est pas connue). Un projet dont le « Compte préféré » est le compte de l’agent garde son agent là : il attend.

## Désactiver ou supprimer un compte

**Désactiver.** L’interrupteur « Actif » garde le compte dans la liste, avec sa connexion, son dossier et ses conversations, mais plus aucun nouvel agent, ticket ou reprise ne part dessus. L’état devient « Inactif ». Les agents qui y sont déjà y restent ; leur menu « Compte » l’écrit « Pro (inactif) ».

**Supprimer.** Le bouton « Supprimer » (jamais sur Principal) demande confirmation. La fenêtre commence par « Supprimer le compte » suivi du nom du compte, puis dit : « Les nouveaux agents ne partiront plus dessus. Son dossier reste sur le disque, avec sa connexion et ses conversations : » et le chemin du dossier.

- Tant que des agents non archivés tournent sur le compte, la suppression est refusée : « Le compte sert encore à 2 agents. » Archive-les ou supprime-les d’abord.
- Le dossier du compte reste sur le disque : Escouade ne l’efface pas, et ne le reprend pas si tu ajoutes un compte du même nom. Pour retrouver le compte, ajoute-en un nouveau et reconnecte-toi.
- Les projets qui avaient ce compte pour « Compte préféré » repassent en « Automatique ».
- Ses tours restent dans les statistiques, sous « Compte supprimé (pro) ».
- Un agent archivé sur ce compte, que tu restaures plus tard, tourne sur Principal.

## Quotas et statistiques par compte

- La barre de statut montre le quota du compte sur lequel partirait un nouvel agent ; un clic ouvre le détail de chaque compte. Voir [les quotas et le coût](usage).
- Les [statistiques](stats) se filtrent par compte, et leur tableau « Par compte » met les comptes côte à côte.
