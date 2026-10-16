# La vue Claude Code

La vue Claude Code fait tourner un agent dans l’interface de Claude Code elle-même, dans un terminal, et le ramène dans la conversation d’Escouade sans perdre la session. Cette page explique comment changer de vue, ce qu’Escouade continue de suivre et ce qui change.

## À quoi ça sert

La conversation d’Escouade montre l’essentiel du travail d’un agent, mais pas tout ce que propose Claude Code. Dans sa propre interface, tu retrouves tout : les commandes `/`, les raccourcis, les dialogues, `/model`, `Maj+Tab` pour changer de mode… C’est utile quand tu veux travailler comme tu le ferais dans un terminal, tout en gardant l’agent dans la liste d’Escouade avec ses statuts, ses notifications et son coût.

## Passer d’une vue à l’autre

Dans l’en-tête de la conversation d’un agent, le bouton « Vue Claude Code » (`>_`) lance l’interface de Claude Code dans un terminal qui prend la place de la conversation. Le bouton devient « Vue Escouade » (`◧`) : un clic te ramène à la conversation. Le menu de la carte de l’agent, dans la barre latérale (clic droit), propose la même chose : « Vue Claude Code » ou « Vue Escouade ». La session est la même dans les deux sens : Escouade arrête le processus de l’une des vues et reprend la session dans l’autre (`--resume`), donc l’agent n’oublie rien. Le choix est gardé pour chaque agent. L’interface démarre quand tu affiches l’agent (le terminal dit alors « Démarrage de Claude Code… »), y compris après un redémarrage d’Escouade, et reprend sa session. Un agent en remote control fait exception : au démarrage d’Escouade, son interface est lancée en fond pour qu’il soit joignable (voir [plus bas](#le-remote-control-dans-cette-vue)).

Le passage à la vue Claude Code est refusé dans deux cas, avec un message ; le retour à la vue Escouade, lui, n’est refusé dans aucun :

- **L’agent travaille encore** : change de vue quand son tour est fini.
- **L’agent travaille sur un ticket** : un agent de ticket reste dans la vue d’Escouade, que son tableau pilote (voir [le Kanban](board)). Ni le bouton ni l’entrée du menu de sa carte n’existent pour lui, ni pour un agent archivé.

Si l’interface s’arrête (tu as tapé `/exit`, ou le processus a été tué), le terminal affiche « Claude Code s’est arrêté. » et un bouton « Relancer » ; si elle ne démarre pas, « Claude Code n’a pas démarré : » suivi de l’erreur, avec le même bouton. Archiver ou supprimer l’agent ferme aussi son terminal.

## Ce qu’Escouade continue de suivre

L’interface de Claude Code est un terminal, mais Escouade sait toujours ce que fait l’agent. Il le lit de deux façons : les hooks de Claude Code, que l’interface appelle sur ta machine (`127.0.0.1`, avec un jeton propre à chaque interface), et le transcript de la session, que l’app relit en continu. Tes propres hooks restent actifs.

Grâce à cela, un agent en vue Claude Code garde :

- **sa pastille et ses statuts** : « En cours », « Question » quand il attend une autorisation ou une réponse, « Terminé » à la fin d’un tour ;
- **ses notifications** : le clignotement, le carillon et la notification système quand il attend une autorisation ou une réponse, puis quand il termine (voir [les notifications](notifications)) ;
- **sa conversation** : ce qui se passe dans l’interface s’écrit aussi dans la conversation d’Escouade, que tu retrouves en revenant à la « Vue Escouade » ;
- **la recherche** (`Ctrl+K`, voir [suivre ses agents](overview#rechercher-dans-les-conversations)) ;
- **le bandeau « Plan »** (voir [l’avancée d’un plan](plan)) ;
- **ses sous-agents** : leur liste dans la barre latérale et, en lecture seule, leur conversation (voir [plus bas](#les-sous-agents)) ;
- **ses tâches de fond** : leur liste dans la barre latérale et leur vue, sans « Arrêter » (voir [plus bas](#les-taches-de-fond)) ;
- **ses statistiques et son coût** (voir [les statistiques](stats)). L’interface ne donne pas le coût de chaque tour : Escouade l’estime d’après les tarifs publics.

Quand l’agent attend une réponse, c’est dans le terminal que tu la donnes : la [vue d’ensemble](overview) le rappelle (« Attend ta réponse dans l’interface de Claude Code ») et son bouton « Répondre » ouvre l’agent.

## Les sous-agents

Les sous-agents d’un agent en vue Claude Code sont listés comme ailleurs, sous sa carte dans la barre latérale et dans le bandeau « Plan » (voir [les sous-agents dans la barre latérale](plan#les-sous-agents-dans-la-barre-laterale)). Un clic sur l’un d’eux ouvre sa conversation à la place du terminal ; le fil d’Ariane, ou `Échap`, ramène à l’agent.

Cette conversation est en **lecture seule**. Escouade la lit dans le transcript que Claude Code tient pour ce sous-agent, à côté de celui de l’agent : elle est lue à l’ouverture de la vue, relue toutes les 2 secondes tant que le sous-agent tourne, puis une dernière fois quand il finit. La vue le dit en haut (« Lecture seule : son transcript, tel que Claude Code l’écrit. On agit sur ce sous-agent dans l’interface de Claude Code. »). Il n’y a ni « Arrêter » ni « Lui écrire » : pour arrêter un sous-agent ou lui écrire, passe par l’interface de Claude Code, dans le terminal. Si Escouade ne trouve pas ce transcript (Claude Code ne l’a pas encore écrit, ou le range ailleurs), la vue dit « Pas encore de message de ce sous-agent. »

Dans cette vue, aucun signal ne dit à Escouade qu’un sous-agent en arrière-plan a fini. Escouade le déduit de ce que Claude Code rejoue à l’agent dans son transcript : le rapport que le sous-agent lui rend, ou la notification de sa fin. Tant que ce message n’est pas arrivé, la ligne du sous-agent reste « En cours ». Son rapport est celui qu’il a rendu à l’agent.

## Les tâches de fond

Les tâches que Claude Code lance en arrière-plan pour un agent en vue Claude Code (commandes, surveillances…) sont listées comme ailleurs, sous sa carte dans la barre latérale, avec la puce « N en fond » sur la carte (voir [les tâches de fond](plan#les-taches-de-fond)). Un clic sur l’une d’elles ouvre sa vue à la place du terminal ; le fil d’Ariane, ou `Échap`, ramène à l’agent.

Dans cette vue, aucun signal ne les annonce à Escouade. Elle lit le début d’une tâche dans le résultat de l’outil que Claude Code écrit dans le transcript de l’agent, avec la commande de l’appel, et sa fin dans la notification qu’il y rejoue. Tant que cette notification n’est pas arrivée, la ligne de la tâche reste « En cours », et l’heure de départ n’est pas exacte à la seconde. Il n’y a pas de « Arrêter » : la vue dit « Cette tâche s’arrête depuis l’interface de Claude Code. », et tu arrêtes la tâche dans le terminal. La sortie se lit dans le fichier de sortie que Claude Code écrit pour la tâche (la vue dit « lue dans le fichier de sortie »), puisqu’aucune requête ne peut la demander à Claude Code. Par le [serveur MCP](mcp#les-sous-agents-et-les-taches-de-fond-d-un-agent), Claude peut les lister et lire leur sortie, mais `stop_background_work` et `message_subagent` sont refusés pour un agent en vue Claude Code : on y arrête une tâche et on y écrit à un sous-agent depuis l’interface de Claude Code.

## Écrire à un agent dans cette vue

Le champ de saisie d’Escouade n’est pas affiché : tu écris dans le terminal, comme dans Claude Code. Pour joindre une image, par exemple une capture d’écran copiée, colle-la dans le terminal (`Ctrl+V`, `Cmd+V` sous macOS) ou dépose-la dessus : Escouade l’enregistre dans un fichier et tape son chemin, que Claude Code prend pour l’image (« [Image #1] »). Du texte collé est tapé tel quel.

Un autre fichier (une archive, un tableur, un document…) se joint de la même façon : colle-le dans le terminal, ou dépose-le dessus (un cadre en pointillés montre la zone de dépôt). Escouade le copie toujours, et ne lit jamais le fichier à son emplacement d’origine : l’interface de Claude Code est lancée une fois, et seul le dossier de l’agent y est lisible sans demander. Elle tape ensuite le chemin de la copie (`/mnt/c/…` pour un Claude Code dans WSL), que Claude lit avec ses outils. La copie est dans le dossier de l’agent, avec celles du chat (voir [les pièces jointes](chat#pieces-jointes)). La taille maximale des [réglages](settings-claude-code#pieces-jointes) s’applique ; l’avertissement de taille, lui, n’existe pas ici, faute de puce.

Pour dicter plutôt que taper, clique sur le micro en haut à droite du terminal (ou appuie sur `Ctrl+Maj+Espace`, `⇧⌘Espace` sous macOS) : un clic commence et un second finit, un appui long dicte tant qu’il est maintenu. Le texte est tapé dans le prompt de Claude Code comme un collage, à son curseur, et n’est pas validé : tu le relis, puis tu appuies sur `Entrée`. La transcription se fait sur ta machine (voir [dicter un message](chat#dicter-un-message)).

Un message envoyé à l’agent d’ailleurs, par exemple par le [serveur MCP](mcp), est tapé dans son interface. Il est refusé tant que l’agent attend une réponse dans son terminal (« L’agent attend une réponse dans son terminal : réponds-y d’abord. »). Il l’est aussi pour une interface lancée en fond que personne n’a encore affichée, tant qu’elle n’est pas prête (voir [plus bas](#le-remote-control-dans-cette-vue)). Une interruption demandée depuis Escouade devient la touche `Échap` dans l’interface.

## Le remote control dans cette vue

Le [remote control](remote-control) suit les mêmes règles que dans la vue Escouade : tu l’actives par un clic droit sur la carte de l’agent ou par un réglage (celui d’un projet ou le réglage global), et l’agent est accessible depuis claude.ai et l’app Claude sous le nom `projet · agent`. Le passage à la vue Claude Code n’est pas refusé quand il est activé. C’est l’interface de Claude Code qui tient alors la session distante.

- **Le lancement.** L’interface d’un agent en remote control est lancée avec `--remote-control=<projet · agent>` : Claude Code affiche le lien de la session. Quand l’interface reprend sa session (redémarrage d’Escouade, relance), Claude Code rattache la même session distante, avec le même lien. Une interface fermée archive sa session distante.
- **Au démarrage d’Escouade.** L’interface d’un tel agent est lancée en fond, sans que tu l’ouvres. Ouvrir l’agent affiche l’interface déjà lancée ; si son remote control s’éteint avant, elle s’arrête, sauf en plein tour. Ces lancements se font au plus 3 à la fois : un démarrage garde sa place jusqu’à ce que l’interface soit prête, 15 secondes au plus.
- **Un changement.** Escouade ne peut pas allumer ni couper le remote control d’une interface déjà ouverte : un changement vaut au prochain lancement de l’interface. Après un clic droit, un message le dit ; pour un réglage, c’est sa description. D’ici là, la commande `/remote-control` de Claude Code le fait.
- **Le menu de la carte.** Il propose « Activer le remote control » ou « Désactiver le remote control ». « Ouvrir sur claude.ai » et « Copier le lien claude.ai » sont proposés aussi, une fois l’interface connectée : le lien vient de l’interface, qui l’affiche dans la sienne.
- **L’icône de la carte.** Son infobulle dit où en est l’interface : aucune interface lancée (pas joignable pour l’instant), connexion…, connecté, au prochain lancement de l’interface (ouverte avant que le remote control s’allume), ou pas ouvert par Claude Code (compte sans abonnement claude.ai, réseau, proxy ou règle de l’organisation). Éteint pour Escouade mais encore actif dans l’interface ouverte, le remote control garde une icône barrée, dans la couleur d’avertissement, jusqu’au prochain lancement, si l’interface a vraiment eu son lien. Le détail est dans [le remote control](remote-control#l-icone-d-une-interface).
- **Un message refusé.** Tant qu’une interface lancée en fond n’a jamais été affichée et n’est pas prête (écran du premier lancement, dossier à approuver), un message de la fenêtre ou du serveur MCP est refusé : ouvre l’agent pour voir l’interface.

## Ouvrir les nouveaux agents dans cette vue

Dans Réglages › Claude Code, groupe « Nouveaux agents », l’interrupteur « Ouvrir les nouveaux agents dans l’interface de Claude Code » (désactivé par défaut) fait démarrer chaque nouvel agent dans cette vue. Chaque agent peut ensuite changer de vue depuis son en-tête. Les agents de ticket restent toujours dans la vue d’Escouade. Voir [les réglages de Claude Code](settings-claude-code).

## La confiance du dossier

La première fois que l’interface de Claude Code se lance dans un dossier, elle demande si tu lui fais confiance. Escouade ne répond jamais à ta place. Les worktrees créés dans le dossier des worktrees par défaut du projet (`.claude/worktrees`) héritent de la réponse donnée pour le projet. Un « Dossier des worktrees » hors du projet n’en hérite pas : l’interface pose la question au premier lancement de chaque worktree (voir [les worktrees](worktrees)).

## Sous Windows avec WSL

Quand Claude Code est installé dans WSL, Escouade le lance par `wsl.exe` (voir [les réglages de Claude Code](settings-claude-code)). Le suivi en direct de la vue Claude Code demande alors le réseau miroir de WSL : sans lui, les hooks de l’interface n’atteignent pas l’app. Les réglages le signalent sous le chemin de `claude` (« Le réseau de WSL est en NAT… »). Pour passer en mode miroir, ajoute ceci à `%UserProfile%\.wslconfig`, puis lance `wsl --shutdown` :

```ini
[wsl2]
networkingMode=mirrored
```
