# Réglages : Harness

L’onglet « Harness » (« Claude Code » jusqu’à la 1.7) liste les harness des agents, avec leur exécutable, leur version et leur état, et règle les nouveaux agents, la vie des processus, les pièces jointes, le remote control et le serveur qui laisse Claude piloter Escouade.

## Chaque harness

Un groupe par harness, sous son nom :

| Ligne | Ce qu’elle dit |
|---|---|
| « Chemin de l’exécutable » | Le programme du harness (voir ci-dessous pour Claude Code). |
| « Version » | La version trouvée, et si Escouade a été testé avec elle : une version plus ancienne est refusée, avec sa raison et la commande qui la met à jour ; une plus récente est utilisée, avec un avertissement. |
| « État » | « Prêt », « Non connecté » (aucun compte connecté), « Version non testée », « Trop ancien » ou « Introuvable ». « Se connecter… » ouvre, dans un terminal intégré, la connexion du compte où partent les nouveaux agents ; l’onglet revient une fois la fenêtre fermée. |
| « Installation » | Pour un harness introuvable : la commande qui l’installe (Claude Code : `irm https://claude.ai/install.ps1 \| iex` sous Windows, `curl -fsSL https://claude.ai/install.sh \| bash` sous macOS et Linux). |

Un harness introuvable n’apparaît que dans cet onglet. Au premier lancement, si aucun n’est trouvé, l’écran d’accueil dit « Aucun harness trouvé » et donne la commande d’installation de chacun ; Escouade marche dès qu’un harness est trouvé.

Dès que deux harness sont installés, le projet a son « Harness par défaut » (Réglages › Projets), le bouton « ▾ » à côté de « Nouvel agent » propose « Nouvel agent sur … » pour chacun, et la fenêtre d’un ticket a son champ « Harness » (celui du projet par défaut), que le pilote auto suit. Dès que des agents tournent sur deux harness, le nom du harness de chacun s’affiche à côté de lui : sur sa carte, dans la vue d’ensemble, dans son en-tête et sur la carte de son ticket. Les menus du composer (modèles, effort, modes, commandes /) sont ceux du harness de l’agent.

## Exécutable de Claude Code

Le groupe « Claude Code » commence par un champ.

| Réglage | Effet | Par défaut |
|---|---|---|
| « Chemin de l’exécutable » (vide = détection automatique) | Le `claude` qu’Escouade lance pour les agents. Un compte qui a son propre exécutable, dans l’onglet [« Comptes Claude »](settings-accounts), lance le sien. | Vide |

### Où Escouade cherche

Champ vide, Escouade cherche `claude` dans le `PATH`, puis aux emplacements habituels des installeurs :

- sous Windows : `~\.local\bin\claude.exe`, `~\.claude\local\claude.exe` et `~\AppData\Roaming\npm\claude.cmd` ;
- sous macOS et Linux : `~/.local/bin/claude`, `~/.claude/local/claude`, `/opt/homebrew/bin/claude` et `/usr/local/bin/claude`.

Sous Windows, s’il n’en trouve aucun, Escouade cherche un Claude Code installé dans WSL, dans la distribution que nomme « Distribution WSL » dans l’onglet [« Terminaux »](settings-terminals) (vide = la distribution par défaut).

Champ rempli, tu peux écrire :

- un chemin complet ;
- un chemin qui commence par `~`, le dossier personnel (Windows, macOS et Linux) ;
- sous Windows, un chemin sans son `.exe` ni son `.cmd` ;
- sous Windows, un Claude Code installé dans WSL : `~/.local/bin/claude`, `/home/<utilisateur>/.local/bin/claude` ou `\\wsl.localhost\<distribution>\home\<utilisateur>\.local\bin\claude` (`\\wsl$\<distribution>\…` marche aussi).

### La ligne sous le champ

Un quart de seconde après que tu as fini de taper, Escouade cherche le `claude` du champ et dit ce qu’elle a trouvé sous le champ :

- « Trouvé : » suivi du chemin ;
- « Trouvé dans WSL (Ubuntu) : » suivi du chemin Linux, pour un Claude Code de WSL ;
- « Introuvable. » : sous Windows, la ligne rappelle alors les formes de chemin acceptées, celles de WSL comprises ; ailleurs elle dit « Introuvable. Indique le chemin de claude. ».

Champ vide, le texte grisé dit déjà si `claude` est trouvé : « claude (trouvé dans le PATH) » ou « introuvable — indique le chemin de claude.exe ». Après « Enregistrer », un nouveau chemin ou une nouvelle distribution WSL fait chercher à nouveau, pour mettre à jour le bandeau du [Kanban](board) et le texte du champ.

> [!WARNING]
> Si le `claude` trouvé est dans WSL et que le réseau de WSL est en NAT, un avertissement s’ajoute : le serveur MCP d’Escouade et le suivi de la [vue Claude Code](claude-code-view) n’atteignent pas l’app. Passe WSL en mode miroir (`networkingMode=mirrored` sous `[wsl2]` dans `%UserProfile%\.wslconfig`), puis lance `wsl --shutdown`.

## Nouveaux agents

Les trois choix valent pour chaque [agent](managing-agents) créé ensuite. Dans le champ de message d’un agent, tu peux les changer pour cet agent seul. Les tickets du Kanban les reprennent quand l’onglet [« Kanban »](settings-board) du projet ne choisit pas les siens.

| Réglage | Effet | Par défaut |
|---|---|---|
| « Modèle par défaut » | Un des alias de Claude Code : « Fable », « Opus », « Sonnet » ou « Haiku ». Une fois que Claude Code a dit quelle version il fait tourner pour un alias, la puce l’affiche (« Sonnet 5.5 », par exemple). | « Sonnet » |
| « Effort par défaut » | Combien le modèle réfléchit avant de répondre. | « Moyen » |
| « Mode de permission par défaut » | Ce que Claude peut faire sans te demander. | « Auto » |

### Les niveaux d’effort

| Niveau | Sens |
|---|---|
| « Bas » | Réponses rapides, peu de réflexion |
| « Moyen » | Équilibré |
| « Élevé » | Réflexion approfondie |
| « Très élevé » | Réflexion très approfondie |
| « Max » | Réflexion maximale, plus de tokens |

### Les modes de permission

| Mode | Sens |
|---|---|
| « Auto » | Un classifieur approuve les actions sûres et demande pour le reste |
| « Demander » | Claude demande ton accord avant chaque action sensible |
| « Plan » | Claude analyse et propose un plan sans rien modifier |
| « Édits auto » | Les modifications de fichiers sont acceptées sans demander |
| « Bypass » | Aucune demande de permission (à réserver aux environnements sûrs) |

Les demandes d’autorisation et leur traitement sont décrits dans [la conversation](chat), et le mode « Plan » dans [le plan](plan).

> [!NOTE]
> Avec Haiku, le choix de l’effort est grisé dans le champ de message de l’agent (« Haiku ne gère pas l’effort »), comme le mode « Auto » (« indisponible avec Haiku »).

## Processus

| Réglage | Effet | Par défaut |
|---|---|---|
| « Reprise automatique après la limite d’usage » | « continue » est envoyé à l’agent une fois le quota réinitialisé. | Activé |
| « Reprendre sur un autre compte un agent de ticket arrêté par la limite » | Sinon il attend la remise à zéro de son compte. Absent tant qu’il n’y a qu’un compte. | Désactivé |
| « Vue des nouveaux agents » | « Escouade » : un nouvel agent tourne dans la conversation d’Escouade. « Terminal du harness » : il tourne dans l’interface de son harness elle-même, dans un terminal (la vue Claude Code). Affiché tant qu’un harness a une vue terminal ; les agents d’un harness qui n’en a pas restent dans la vue d’Escouade. | Escouade |
| « Les agents tiennent une liste de tâches » | Les agents reçoivent l’outil de liste de tâches de Claude Code. | Activé |
| « Arrêter les processus des agents inactifs après » (minutes, 0 = jamais) | Le processus Claude d’un agent inactif est arrêté après ce délai. | 30 |

### Reprise automatique

Quand un agent s’arrête sur la limite d’usage, Escouade prévoit de lui écrire « continue » à la remise à zéro du quota. Désactiver le réglage annule aussi les reprises déjà prévues. La limite et les quotas sont expliqués dans [l’usage](usage).

### Reprise sur un autre compte

Avec plusieurs comptes, un agent de ticket arrêté par la limite repart tout seul, avec sa session, sur le compte que choisirait Escouade, quand un autre est utilisable, au lieu d’attendre la remise à zéro de son compte. Voir [les comptes](accounts) et l’onglet [« Comptes Claude »](settings-accounts).

### Vue Claude Code

Chaque agent change de vue depuis son en-tête, et ce réglage ne fait que choisir la vue de départ. Les agents de ticket restent dans la vue d’Escouade. Voir [la vue Claude Code](claude-code-view).

### Liste de tâches

Si l’agent tient une liste, Escouade montre son avancée dans le bandeau « Plan » ; le modèle n’est pas obligé de s’en servir. Le réglage s’applique aux agents lancés ensuite. Voir [le plan](plan).

### Processus inactifs

Le champ est un nombre de minutes ; 0 veut dire jamais, et un champ vide vaut 0. La session d’un agent dont le processus a été arrêté reste reprenable. Un agent en remote control n’est jamais arrêté ainsi, pour rester joignable depuis claude.ai.

## Pièces jointes

Ce groupe décide de ce qui arrive aux fichiers joints envoyés par chemin (voir [les pièces jointes](chat#pieces-jointes)). Il ne touche pas à ce que Claude lit dans le message : images, PDF et textes dans leurs limites.

| Réglage | Effet | Par défaut |
|---|---|---|
| « Taille maximale d’un fichier joint » (Mo, 0 = aucune limite) | Au-delà, le fichier est refusé. | 0 |
| « Avertir au-delà de » (Mo, 0 = jamais) | Au-delà, la puce du fichier porte un avertissement ; le fichier se joint quand même. | 200 |
| « Joindre le fichier d’origine » | Activé : un fichier déposé est joint là où il est, sans copie : Claude le lit à son emplacement, quand Escouade en connaît le chemin (sous Windows seulement : sous Linux et macOS, les fichiers sont toujours copiés). Désactivé : Escouade en garde toujours une copie. Les tickets et la vue Claude Code copient dans tous les cas. | Activé |
| « Texte de plus de 256 Ko » | « Joint par son chemin », comme les autres fichiers, ou « Refusé », comme avant. | « Joint par son chemin » |
| « Purger les copies après » (jours, 0 = tant que leur propriétaire existe) | Les copies plus vieilles que ce nombre de jours sont effacées, avec leurs dossiers vides, au démarrage puis chaque heure. 0 = elles restent tant que leur agent, leur projet ou leur ticket existe. | 0 |

Un champ de nombre vidé vaut 0. La taille maximale vaut pour tous les fichiers envoyés par chemin : dans le chat, dans la vue Claude Code et dans les tickets. L’avertissement n’apparaît que sur une puce (chat et tickets). La purge n’efface jamais un fichier d’origine. Les copies des messages sont dans `attachments/<agent>/`, celles d’un ticket dans `tickets/<ticket>/files/`, sous le [dossier de données](data).

## Remote control

Ce groupe rend les agents de tous les projets accessibles depuis claude.ai et l’app Claude, sans activer le [remote control](remote-control) agent par agent.

### Remote control pour tous les agents

L’interrupteur est désactivé par défaut. Allumé, chaque agent de chaque projet, existant ou nouveau (agents des tickets compris), est accessible depuis claude.ai et l’app Claude. Escouade lance tout de suite le processus `claude` de chacun, au plus 3 à la fois, et il reste lancé : il démarre avec l’app et n’est jamais arrêté pour inactivité. La session apparaît sur claude.ai sous le nom « projet · agent » (pour un agent de ticket, son nom vient du ticket). En vue Claude Code, une interface déjà ouverte ne le prend qu’à son prochain lancement. Pour mettre un agent à part, fais un clic droit sur sa carte, puis « Désactiver le remote control ».

Le réglage s’enregistre avec « Enregistrer », comme la plupart des autres. Éteint, il retire le remote control aux agents qui le tenaient de lui, sans toucher à ceux que tu as activés à la main ni à ceux que le réglage de leur projet couvre encore.

Tant qu’il est allumé, l’interrupteur « Remote control pour les agents de ce projet » de chaque projet, dans [l’onglet « Projets »](settings-projects), se montre allumé et grisé : « Activé pour tous les projets dans Réglages › Harness ». Le choix propre de chaque projet est gardé, et revient quand celui-ci est éteint.

Pour un agent en [vue Claude Code](claude-code-view), le changement vaut au prochain lancement de son interface. La page sur [le remote control](remote-control) donne le détail : d’où il vient, comment mettre un agent à part et ce qui se passe au redémarrage.

## Escouade dans Claude

Ce groupe laisse Claude Code, dans un terminal, dans un autre outil ou dans un agent d’Escouade, lire tes projets, tes agents et tes tickets, et créer des tickets ou lancer des agents, par le [serveur MCP](mcp) d’Escouade.

### Claude et les agents peuvent piloter Escouade

L’interrupteur est désactivé par défaut. Il donne le serveur à Claude Code hors d’Escouade (un terminal, un autre outil) et à chaque agent d’Escouade, de tous les projets, avec un jeton à lui : il n’y a rien à permettre dans les réglages d’un projet. Il s’enregistre tout de suite, sans passer par « Enregistrer » : l’activer déclare le serveur dans la config de Claude Code de chaque compte actif, ce qu’un « Annuler » ne pourrait pas défaire. Le désactiver change le jeton, retire le serveur de chaque compte et l’écarte des agents : ceux déjà lancés perdent les outils tout de suite.

Un agent déjà lancé reçoit les outils au prochain démarrage de son processus : sa conversation affiche alors « Outils d’Escouade au prochain démarrage » avec « Relancer », qui reprend sa session dans un nouveau processus, et une ligne sous l’interrupteur dit combien d’agents sont dans ce cas (« 1 agent déjà lancé aura les outils au prochain démarrage de son process : « Relancer » sur sa conversation. »). Voir [Les agents d’Escouade et le serveur](mcp#les-agents-d-escouade-et-le-serveur).

Interrupteur allumé, une ligne dessous dit où en est la déclaration :

- « Déclaration dans Claude… » pendant qu’Escouade écrit le serveur dans la config de Claude Code ;
- « Déclaré dans Claude · compte Principal, compte Pro » quand c’est fait pour les comptes listés ;
- « Pas déclaré pour le compte Pro : » suivi de la raison, quand ça a échoué pour un compte : la fenêtre montre alors la commande à lancer à la main (introduite par « À lancer à la main dans PowerShell : », ou « … dans sh : » sous macOS), avec le jeton masqué, et le bouton « Copier la commande » copie la vraie commande (« Commande copiée ») ;
- « Le serveur n’a pas démarré : » suivi de la raison, à la place des lignes précédentes.

> [!WARNING]
> Le jeton est écrit en clair dans la config de Claude Code (`~/.claude.json` pour le compte Principal). Désactiver change le jeton.

## Activité MCP

Le groupe « Activité MCP » liste ce que le serveur a reçu et répondu, les appels les plus récents en tête. Chaque ligne donne l’heure, qui a appelé (le nom d’un agent, « Claude (hors Escouade) » ou, pour une requête refusée avant de savoir qui l’envoie, « Client inconnu »), l’outil, le résultat (« Fait », « Refusé » ou « Erreur »), puis ce qui a été demandé et, pour un refus ou une erreur, pourquoi. Pour un `set_board` réussi, la ligne dit aussi ce qui a changé, champ par champ, avant et après (« model: opus → sonnet · effort: (défaut) → medium »), ou « Aucun changement ». Les 200 derniers appels sont gardés en mémoire, pas enregistrés. Le bouton « Effacer » vide la liste ; sans appel, elle dit « Aucun appel pour l’instant. ».
