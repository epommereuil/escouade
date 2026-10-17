# La conversation

La conversation est l’endroit où tu parles à un agent et où tu lis ce qu’il fait. Cette page décrit le champ de saisie, les pièces jointes, l’autocomplétion, le rendu des messages et des appels d’outils, les questions et les autorisations, et les longues conversations.

![La conversation de l’agent « pagination-users » : un bloc de code, le diff d’un appel d’outil Edit et le champ de saisie](/images/chat.jpg)

Sous macOS, `Ctrl` devient `⌘` pour les raccourcis.

## L’en-tête

L’en-tête de la conversation reprend le nom de l’agent (un double-clic le renomme), son statut, puis `projet / branche` en dessous. À droite :

- « Éditeur » ouvre l’[éditeur](editor) sur les fichiers de l’agent ;
- « Tester » ou « Préparer le lancement », selon l’agent, lance son worktree ou demande à l’agent comment le lancer (voir [les tests](testing)) ;
- « Vue Claude Code » fait tourner l’agent dans l’interface de Claude Code elle-même (voir [la vue Claude Code](claude-code-view)). Le bouton n’existe pas pour un agent de ticket ni pour un agent archivé ;
- le modèle, puis les chiffres de l’agent : « Contexte » (par exemple « 76,2 k / 200 k » : la part de la fenêtre du modèle déjà remplie, dont le pourcentage est dans l’infobulle ; la valeur prend une couleur d’alerte à partir de 80 %), « Tokens », « Coût » (précédé de « ≈ » pendant un tour : c’est une estimation), « Fichiers » (en disposition classique, un clic affiche les fichiers non commités, voir [git](git)) et « Durée » ;
- deux boutons de disposition : classique, ou la conversation et les fichiers côte à côte (`Ctrl+Maj+L`, voir [l’interface](interface)).

## Écrire un message

### Envoyer

`Entrée` envoie le message, `Maj+Entrée` va à la ligne. Le champ s’agrandit avec le texte, jusqu’à 40 % de la hauteur de la fenêtre. Un message vide, sans fichier joint, ne part pas. Le bouton « Envoyer » fait la même chose.

Tant que la conversation est vide, le champ dit « Décris la tâche à confier à Claude… » ; ensuite, « Envoyer un message à » suivi du nom de l’agent.

### Pendant que Claude travaille

Tu peux écrire à Claude pendant qu’il travaille. Le message apparaît dans la conversation avec la mention « transmis pendant le tour » : Claude en tient compte dès sa prochaine étape, comme dans Claude Code. Écrire à un agent annule aussi sa reprise automatique après la limite d’usage.

Pour l’arrêter, appuie sur `Échap` dans le champ de saisie, ou clique sur « Stop » à côté de « Envoyer ». Le tour se termine par « Interrompu », l’agent passe à « Terminé », et aucune notification n’est envoyée. Quand une liste de suggestions est ouverte, `Échap` la ferme d’abord.

### Répondre avec le champ

Quand Claude attend une réponse à une question ou une autorisation, le champ change de texte et ce que tu écris lui répond :

- pour une question, « Réponds à la question ou écris une réponse libre… » : ton texte est la réponse ;
- pour une autorisation, « Explique à Claude quoi faire à la place (refuse la demande)… » : ton texte refuse la demande et dit à Claude quoi faire à la place.

### Pièces jointes

Tu peux joindre n’importe quel fichier : une image, un PDF ou un texte, mais aussi une archive, un tableur, un document, une vidéo, un fichier audio… Il y a trois façons de le joindre : le coller (`Ctrl+V`, par exemple une capture d’écran copiée), le glisser sur le champ, ou cliquer sur le trombone (« Joindre un fichier »). La fenêtre de choix n’a pas de filtre : elle montre tous les fichiers. Chaque fichier apparaît au-dessus du champ : une miniature pour une image, sinon une puce avec une icône selon son type (archive, tableur, document, vidéo, audio, code ou générique), son nom, sa taille et une croix qui le retire. Pendant qu’un fichier se copie (voir plus bas), sa puce montre un pourcentage et une barre de progression, et « Envoyer » reste grisé.

Escouade transmet un fichier à Claude de deux façons. Ce que Claude lit directement reste **dans le message**, dans ces limites :

| Type | Formats | Taille maximale |
|---|---|---|
| Image | PNG, JPEG, GIF, WebP | 5 Mo |
| PDF | `.pdf` | 18 Mo |
| Texte | Code, configuration, journaux, CSV, Markdown, JSON… et les fichiers sans extension connue comme `Dockerfile` ou `.env.local` | 256 Ko |

Les fichiers d’un même message ne dépassent pas 18 Mo en tout.

Tout le reste part **par chemin** : un autre format, un fichier lisible mais trop gros pour le message (une image de plus de 5 Mo, un PDF de plus de 18 Mo, un texte de plus de 256 Ko), ou ce qui ferait dépasser les 18 Mo du message. Le message donne alors à Claude le chemin du fichier : une ligne de plus par fichier, à la suite de ton texte (ou seule, si tu n’as rien écrit). Claude lit le fichier avec ses outils.

```text
Fichier joint : rapport.xlsx, C:\…\rapport.xlsx
```

La ligne suit la langue des textes rédigés par Claude (`Attached file: …` en anglais, voir [Réglages › Application](settings-application)). Sous WSL, le chemin est celui que lit Claude Code, par exemple `/mnt/c/…`.

Un fichier est refusé s’il dépasse la taille maximale que tu as fixée (aucune par défaut), si c’est un texte de plus de 256 Ko et que tu as choisi de les refuser, ou si Escouade ne peut pas le lire ou le copier. Il est nommé dans un message rouge, et les autres fichiers sont joints quand même. Dans la conversation, le message affiche « 2 images » et le nom des fichiers ; les lignes des fichiers envoyés par chemin y sont aussi, avec ton texte. Si Escouade ne retrouve plus un fichier au moment d’envoyer (déplacé ou supprimé entre-temps), le message est refusé, avec la raison, et revient dans le champ.

Les fichiers joints n’accompagnent pas une réponse à une question ou à une autorisation : ils restent prêts pour ton prochain message. Dans la vue Claude Code, le champ de saisie d’Escouade n’est pas affiché : un fichier se joint en le collant ou en le déposant sur le terminal, et il y est toujours copié ; voir [la vue Claude Code](claude-code-view). Dans la fenêtre d’un ticket, les fichiers sont aussi toujours copiés ; voir [le Kanban](board).

### Copie ou fichier d’origine

Un fichier envoyé par chemin est soit le fichier d’origine, soit une copie.

- **Le fichier d’origine** (par défaut, grâce au réglage « Joindre le fichier d’origine ») : rien n’est copié, Claude lit le fichier là où il est. Escouade doit en connaître le chemin, et elle ne le connaît que sous Windows : l’application lit elle-même le chemin d’un fichier du disque déposé ou collé depuis l’Explorateur, et la fenêtre ne peut pas lui en donner un autre. Une capture d’écran collée n’est pas un fichier du disque : elle n’a pas de chemin. Un chemin que l’application n’a pas lu elle-même est refusé, à la jointure comme à l’envoi du message, et un fichier du dossier de données d’Escouade ne se joint jamais par son chemin : il est refusé. Sous Linux et macOS, il n’y a aucun chemin d’origine : les fichiers sont copiés. Pour un fichier déposé, Escouade ne donne pas son dossier à Claude : Claude Code demande l’autorisation de lire un fichier qui n’est dans aucun de ses dossiers, et Escouade y répond « autorisé » d’elle-même, pour ce fichier seul, à son chemin d’origine, et pour le lire (jamais pour y écrire). Toute autre demande te revient comme d’habitude, y compris celle d’un autre outil que la lecture (par exemple `Bash`). Claude lit le fichier tel qu’il est à ce moment-là : modifié, il est lu modifié ; déplacé ou supprimé, il n’est plus trouvé. La puce d’un fichier d’origine porte un marqueur et l’infobulle « Fichier d’origine, lu là où il est », pour que tu ne la prennes pas pour une copie.
- **Une copie** : Escouade copie le fichier sous son vrai nom, par morceaux de 4 Mo au plus, dans son dossier de données (`attachments/<agent>/`, voir [les données locales](data)), hors de ton dépôt. Claude Code lit ce dossier sans rien demander. La copie est faite quand le chemin d’origine est inconnu (sous Linux et macOS, et pour une capture collée du presse-papiers, qui n’est pas un fichier du disque), quand tu désactives « Joindre le fichier d’origine », pour les tickets (leur agent lit le fichier plus tard, quand l’original peut avoir bougé ou disparu) et pour la vue Claude Code (son processus est lancé une fois, sans moyen de lui ouvrir un dossier de plus).

> [!NOTE]
> Que Claude Code lise sans rien demander le dossier des copies a été vérifié avec le vrai Claude Code (2.1.301). L’autorisation d’un fichier d’origine par Escouade l’a été avec un faux Claude Code dans les tests automatiques (le vrai envoie bien le chemin exact du message dans sa demande) ; le chemin traduit sous WSL n’a pas été essayé en vrai.

### Taille, gros textes et réglages

- **Taille.** Aucune limite par défaut. Un fichier de plus de 200 Mo porte un avertissement (une marque « ! » sur sa puce, dont l’infobulle dit « Gros fichier : 250 Mo, copié sur le disque », ou « … joint là où il est, sans copie » pour un fichier d’origine), mais il se joint. Un fichier vide aussi. Tu peux fixer une taille maximale : au-delà, le fichier est refusé.
- **Texte de plus de 256 Ko.** Par défaut, il part par chemin comme les autres fichiers. Tu peux le faire refuser, comme avant, en réglant « Texte de plus de 256 Ko » sur « Refusé » ; cela vaut aussi dans la fenêtre d’un ticket et dans la vue Claude Code.
- **Réglages.** Les cinq réglages du groupe « Pièces jointes » (« Taille maximale d’un fichier joint », « Avertir au-delà de », « Joindre le fichier d’origine », « Texte de plus de 256 Ko » et « Purger les copies après ») sont dans [Réglages › Claude Code](settings-claude-code#pieces-jointes), avec leurs valeurs par défaut.

### Effacer les fichiers joints

- La croix de la puce efface la copie, ou arrête celle qui est en cours. Pour un fichier d’origine, elle ne retire que la puce.
- Les copies d’un agent partent avec lui quand tu le supprimes. Celles d’un projet partent quand tu le supprimes pour de bon : fermer un projet les garde avec son historique, et la taille de cet historique (dans Réglages › Projets) les compte aussi, comme les images de ses tickets. Celles d’un ticket partent avec le ticket.
- Si tu règles la purge, Escouade efface les copies plus vieilles que le nombre de jours choisi, au démarrage puis chaque heure. Par défaut, rien n’est purgé.
- Escouade n’efface jamais un fichier d’origine.
- Pour chaque agent, Escouade garde, avec lui, la liste des fichiers d’origine qu’elle l’a autorisé à lire (200 au plus, les plus récents). L’interface ne montre pas encore cette liste et ne permet pas d’en retirer un fichier ; supprimer l’agent l’efface.

### Dicter un message

Le micro, à côté du trombone, dicte le message au lieu de le taper. Deux façons de parler :

- **un clic** commence la dictée, **un second** la finit ;
- **un appui long** dicte tant que le bouton reste enfoncé : le relâcher la finit.

Le raccourci `Ctrl+Maj+Espace` (`⇧⌘Espace` sous macOS) fait la même chose, appui bref ou maintenu, dans le champ qui a le focus. Pendant l’écoute, un panneau montre le niveau du micro et la durée ; `Échap` annule sans rien écrire.

Le texte dicté est **inséré à l’endroit du curseur** (il remplace la sélection s’il y en a une), séparé des mots voisins par une espace. Il n’est **jamais envoyé tout seul** : tu le relis, le corriges, puis tu l’envoies avec `Entrée`. On dicte de la même façon la description d’un ticket (le micro est à côté de « Joindre ») et, en [vue Claude Code](claude-code-view), le prompt de Claude Code : le micro est en haut à droite du terminal, et le texte y est tapé comme un collage, sans être validé.

La transcription se fait **sur ta machine**, par Whisper (whisper.cpp), dans un fil à part : rien de ce que tu dis ne quitte ta machine. À la première dictée, Escouade propose de télécharger le modèle « base » (148 Mo), une seule fois, depuis Hugging Face, par le proxy des [réglages réseau](settings-network) ; sa somme de contrôle est vérifiée avant qu’il soit gardé, dans `~/.escouade/voice/models`. Ensuite, une phrase se transcrit en une à deux secondes.

Dans **Réglages › Voix** :

- « Micro utilisé » : celui du système par défaut, ou un autre ;
- « Modèle » : tiny (78 Mo, le plus rapide), base (148 Mo, par défaut), small (488 Mo), large-v3-turbo-q5_0 (574 Mo), medium (1,5 Go) ou large-v3-turbo (1,6 Go, le plus juste). Chacun se télécharge ou s’efface depuis sa ligne ; celui choisi se télécharge à la première dictée ;
- « Langue parlée » : celle de l’interface par défaut, la détection automatique, ou une langue précise ;
- « Raccourci » : « Changer », puis appuie sur le raccourci voulu (avec `Ctrl`, `Alt` ou `Cmd`, ou une touche `F1` à `F24`).

Si le micro est refusé ou absent, Escouade le dit avec la marche à suivre :

- **macOS** demande la permission à la première dictée. Si tu l’as refusée, coche Escouade dans Réglages Système › Confidentialité et sécurité › Microphone, puis relance l’app ;
- **Windows** : Paramètres › Confidentialité et sécurité › Microphone, « Accès au microphone » puis « Autoriser les applications de bureau à accéder à votre microphone » ;
- **Linux** : PulseAudio ou PipeWire doit tourner, et le micro ne doit pas être coupé (pavucontrol ou les réglages du son).

La dictée s’arrête d’elle-même après dix minutes, quand le micro est débranché (ce qui a été dit est transcrit), quand la fenêtre est fermée ou rechargée, et quand l’app quitte.

### Parler avec l’agent (conversation vocale)

Le bouton **Conversation**, à gauche du micro, fait une conversation à voix haute avec l’agent, sans toucher au clavier :

1. tu parles ; quand tu te tais, ce que tu as dit **part seul** à l’agent après un court silence (« Délai avant l’envoi », 1,2 s par défaut) ;
2. l’agent travaille et répond comme d’habitude, dans la conversation ;
3. il finit sa réponse par **un court passage écrit pour être lu**, moins verbeux et moins technique : Escouade le montre à part sous la réponse (« 🔊 Lu à voix haute ») et le **lit à voix haute** ;
4. puis l’écoute reprend.

Un panneau au-dessus du bouton dit où en est la conversation (« À l’écoute », « Transcription sur ta machine… », « Alice travaille… », « Alice te répond »), avec le niveau du micro, ce que tu as dit et ce qui est lu ; « Arrêter » ferme le micro.

- **Couper la parole** : parle pendant la lecture, elle s’arrête aussitôt et Escouade t’écoute. Le micro n’entend pas la voix de l’agent pour une phrase de toi : pendant la lecture, il sert seulement à savoir si tu parles par-dessus, au-dessus de l’écho des haut-parleurs. Un casque reste le plus confortable.
- **Questions et permissions** : quand l’agent pose une question ou demande une permission, Escouade la lit, puis ta réponse dite y répond : « oui », « d’accord » ou « vas-y » autorisent, « non » refuse, « toujours » autorise toujours ; une option se dit par son nom ou son rang (« la deuxième »). Si Escouade ne comprend pas, ou si la question demande plusieurs choix, la conversation se met **en pause** et le dit : réponds dans la fenêtre, puis « Reprendre ».

Tout se passe **sur ta machine** : la transcription par Whisper, comme la dictée, et la voix par **Piper**, liée à Escouade. À la première conversation, Escouade propose de télécharger la voix (environ 60 Mo, une seule fois, depuis Hugging Face, sa somme de contrôle vérifiée). La conversation se tient en français ou en anglais : la langue parlée des réglages, sinon celle de l’interface.

Dans **Réglages › Voix › Conversation** :

- la **voix** de chaque langue, parmi celles dont la licence le permet : modèle et jeu de données libres, aucune voix de personnage, de personne connue ni de marque (6 voix en français, 29 en anglais). Pour chacune, sa qualité, sa taille, son locuteur s’il y en a plusieurs, « ▶ Écouter », « Télécharger » ou « Effacer », sa licence et le crédit qu’elle demande ;
- la **vitesse** et le **volume** de la lecture ;
- le **délai avant l’envoi** : le silence après lequel ce que tu as dit part (de 0,5 à 3 s).

Les crédits de Piper, eSpeak NG, ONNX Runtime et de chaque voix sont dans Réglages › À propos › « Crédits et licences ».

### Mentionner un fichier avec @

Tape `@` au début d’un message ou après une espace, puis une partie du nom : Escouade liste jusqu’à 12 fichiers du dossier de l’agent (son worktree s’il en a un), avec leur dossier. `↑` et `↓` choisissent, `Entrée` ou `Tab` (ou un clic) insèrent `@chemin/du/fichier`, `Échap` ferme la liste. La recherche est approximative : quelques lettres du nom suffisent. Elle porte sur les fichiers que git connaît (suivis, ou non suivis mais pas ignorés) ; hors d’un dépôt git, le dossier est parcouru sans les dossiers de dépendances et de build.

### Lancer une commande avec /

Au tout début d’un message, `/` ouvre la liste des commandes que Claude Code annonce pour cet agent. Celles dont le nom commence par ce que tu tapes viennent d’abord, puis celles qui le contiennent ; la liste en montre 12 au plus, et chaque ligne donne l’indication d’argument et la description. Les touches sont les mêmes que pour `@`, et `Entrée` insère `/commande` suivie d’une espace. Si le processus de l’agent est arrêté, il est relancé pour obtenir la liste.

### Rappeler le dernier message

`↑` dans un champ vide remet ton dernier message : tu peux le renvoyer tel quel ou le modifier. L’original reste dans la conversation.

### Les brouillons

Ce que tu écris est gardé séparément pour chaque agent : passer à un autre agent puis revenir retrouve ton texte. Le texte survit aussi à un redémarrage, à une mise à jour ou à un rechargement de la fenêtre (il est enregistré un instant après la dernière frappe). Les pièces jointes, elles, restent en mémoire : leurs puces disparaissent au redémarrage (la copie d’un fichier envoyé par chemin reste sur le disque, avec celles de l’agent). Un brouillon est effacé quand le message part, ou quand l’agent est supprimé. Si l’envoi échoue, le message revient dans le champ et une erreur s’affiche.

### Modèle, effort, mode et compte

La barre sous le champ règle le modèle, l’effort et le mode de permission de l’agent, et son compte quand tu en as plusieurs. Tout est expliqué dans [la page des agents](managing-agents#modele-effort-et-mode-de-permission).

### Pendant la préparation d’un worktree

Quand le worktree d’un nouvel agent se prépare, la conversation affiche « Préparation du worktree » avec l’étape en cours (« Voir la sortie » montre ce qu’elle écrit). Ton message est mis en attente (« En attente de la préparation… ») et part quand la préparation est finie ; un seul message peut attendre à la fois.

## Lire la conversation

### Les messages

Tes messages sont dans des bulles à droite, ceux de Claude à gauche avec un « C ». Le texte de Claude apparaît au fil de l’eau, avec « Claude travaille… » tant que le tour dure. Il est rendu en Markdown : titres, listes, tableaux, citations, liens (un clic sur un lien `http`, `https` ou `mailto` l’ouvre dans ton navigateur). Du HTML écrit dans une réponse est affiché comme du texte.

Les blocs de code ont un en-tête avec leur langage (« texte » quand il n’est pas précisé) et un bouton « Copier » qui copie le code, puis affiche « Copié ✓ ». Une fois le texte terminé, le code est coloré pour les langages courants : TypeScript, JavaScript, JSON, Rust, Python, Bash, PowerShell, CSS, HTML, Svelte, Vue, Markdown, YAML, TOML, SQL, Go, Java, Kotlin, C, C++, C#, PHP, Ruby, Swift, diff, Dockerfile, GraphQL… Les autres restent en texte brut.

### La réflexion

Quand Claude réfléchit, une ligne « Réflexion » (▸) apparaît, avec « … » tant qu’elle se fait. Un clic la déplie.

### Les appels d’outils

Chaque outil que Claude utilise tient sur une ligne : le nom de l’outil (`Read`, `Edit`, `Bash`, `Grep`…), ce sur quoi il agit (la commande, le chemin du fichier relatif au dossier de l’agent, le motif cherché, l’adresse), et à droite le résultat en bref : pour une commande, la dernière ligne de sa sortie (ou une coche s’il n’y en a pas) ; pour une lecture, le nombre de lignes ; « 14 résultats » ou « aucun résultat » pour une recherche ; « +24 −3 » pour une modification ; « interrompu » ou « erreur ». Un cercle tourne tant que l’outil s’exécute. Survole la ligne pour lire son texte en entier.

Un clic sur la ligne (ou `Entrée` quand elle a le focus) la déplie :

- **Modification de fichier** (`Edit`, `Write`, `MultiEdit`) : le diff, avec les lignes numérotées, en vert et en rouge. Il est unifié ou côte à côte selon le choix que tu as fait dans la visionneuse de diff (« Unifié » ou « Côte à côte », voir [git](git)). Au-delà de 400 lignes, il s’arrête à « … N lignes de plus ». Le chemin du fichier est un lien : il ouvre le fichier dans l’éditeur, à la première ligne modifiée.
- **Commande** (`Bash`, `PowerShell`) : la commande après `$`, puis sa sortie.
- **Liste de tâches** (`TodoWrite`) : les tâches avec ☐, ◐ (en cours) et ☑.
- **Sous-agent** (`Agent`) : ce qu’on lui a demandé, ses propres appels d’outils (des lignes imbriquées, que tu peux déplier aussi) et son dernier texte. La ligne dit combien d’outils il a utilisés, et son bouton ↗ ouvre la conversation du sous-agent en grand, à la place de celle de l’agent (voir [la conversation d’un sous-agent](plan#la-conversation-d-un-sous-agent)).
- **Les autres outils** : leur résultat, sinon les paramètres de l’appel.

Les outils qui ne font que relire la liste des tâches (`TaskList`, `TaskGet`) sont affichés en teintes plus douces. Les outils du serveur MCP d’Escouade portent un badge « Escouade · … » (voir [le serveur MCP](mcp)).

### Sous-agents, tâches de fond et autres sessions

Ce que Claude Code transmet de lui-même à Claude n’est pas pris pour un message de toi : une ligne « Tâche de fond terminée » (ou « en échec », « arrêtée ») avec son résumé, un bloc « Rapport du sous-agent » (avec le libellé de sa tâche) qui contient son rapport en Markdown, ou « Message d’une autre session Claude ». Un message envoyé depuis claude.ai ou l’app Claude (voir [le remote control](remote-control)) est dans une bulle comme les tiens, avec la mention « depuis claude.ai ».

### La fin d’un tour et son coût

Entre deux tours, une ligne donne la durée, les tokens et le coût : « 1m 20s · 12 k tokens · 0,14 $ ». Un tour interrompu l’indique (« Interrompu »). Quand l’agent est « Terminé », le dernier tour s’affiche en carte : « Tâche terminée », avec la durée, les tokens, le coût et « N fichiers modifiés », puis la liste de ces fichiers avec leurs lignes ajoutées et supprimées (un clic ouvre le fichier dans l’éditeur).

Un tour qui échoue affiche une carte rouge, « Le tour s’est terminé en erreur », avec le message. Quand la cause est la limite d’usage, la carte annonce la reprise automatique (« Reprise automatique à 15:00 ») avec un bouton « Annuler la reprise », et propose « Reprendre sur… » un autre compte, par exemple « Reprendre sur Pro » (voir [les comptes](accounts)).

### Les cartes du Kanban et du test

Un agent de ticket, ou un agent à qui tu as demandé de préparer son lancement, termine ses tours par un bloc que la conversation affiche sous forme de carte plutôt que de texte : « Bilan des critères » (les critères du ticket atteints, par exemple `2/3`, avec une note éventuelle), « Ce qui a été fait » (jusqu’à huit lignes) et « Lancement de test » (les commandes de préparation et les processus, avec un bouton « ▶ Tester » quand le worktree peut être lancé). Voir [le Kanban](board) et [les tests](testing).

### Les avis

De courtes lignes, en dehors des messages, signalent ce qui arrive à la session : « Contexte compacté », « Nouvelle conversation Claude (contexte vidé) », « Session Claude introuvable : une nouvelle session sera démarrée au prochain message. », ou, en rouge, « Claude Code s’est arrêté (code 1) ». Quand l’agent est en erreur, un bandeau ajoute : « L’agent s’est arrêté. Envoie un message pour relancer Claude sur la même session. »

## Questions et autorisations

Quand Claude a besoin de toi, la conversation affiche une carte ambre, l’agent passe en « Question », et tu es prévenu (voir [les notifications](notifications)). Tu réponds à la souris, au clavier ou en écrivant dans le champ.

Quand la demande vient d’un sous-agent, la carte est précédée de « Demande du sous-agent » et de son nom, avec un bouton « Ouvrir sa conversation ». Tu peux y répondre ici ou dans la conversation du sous-agent, où la même carte apparaît (voir [la conversation d’un sous-agent](plan#la-conversation-d-un-sous-agent)) ; la réponse vaut des deux côtés.

### Les questions

La carte « Claude attend ta réponse » montre la question et un bouton par option. Survole une option pour lire sa description ; elle est aussi écrite sous les boutons.

- Une question à choix unique est répondue d’un clic.
- Quand il y a plusieurs questions, ou une question à choix multiple (des cases ☐ à cocher), la réponse se valide avec le bouton « Valider », actif quand chaque question a une réponse.
- Tu peux aussi répondre librement : ce que tu écris dans le champ (« ou réponds librement dans le champ ci-dessous ») est la réponse à chaque question de la carte.

Une fois répondue, la carte se réduit à la question et à la réponse (« → Oui »).

### Les autorisations

La carte « Claude demande une autorisation » montre l’outil et ce qu’il veut faire (la commande, le fichier, l’adresse…), avec la description et la raison que Claude Code donne.

| Bouton | Effet |
|---|---|
| Autoriser | Autorise cette action. |
| Toujours autoriser | Autorise et applique la règle que Claude Code propose avec la demande, pour que ce genre de demande ne soit plus posé. Absent quand Claude Code n’en propose pas. |
| Refuser | Refuse. Claude reçoit « L’utilisateur a refusé cette action. » Pour refuser en expliquant, écris dans le champ à la place. |

Quand Claude Code refuserait la demande par défaut, le bouton « Refuser » est le bouton principal, et seul un clic sur « Autoriser » l’autorise : aucun raccourci clavier ne le fait. Pour un outil du serveur MCP d’Escouade, la carte liste chaque paramètre (jusqu’à 2 000 caractères chacun), pour que tu lises ce qui part.

En mode Plan, la demande est « Claude propose un plan » : le plan s’affiche en Markdown, et les boutons sont « Approuver le plan », « Approuver et accepter les édits » (le plan est approuvé et les modifications de fichiers qui suivent sont acceptées) et « Continuer à planifier ». Ce dernier dit à Claude de continuer à planifier ; si tu préfères préciser ce qui ne va pas, écris-le dans le champ.

Une demande traitée devient une ligne : « ✓ Autorisé · Bash npm test », « ✕ Refusé », « ✓ Toujours autorisé ».

### Au clavier

| Touches | Effet |
|---|---|
| `Ctrl+Entrée` | Autorise la demande en attente. Pour une question, valide la réponse quand elle est complète, sinon passe à la question suivante qui n’a pas de réponse. |
| `Ctrl+Maj+Entrée` | « Toujours autoriser » (ou « Approuver et accepter les édits » pour un plan). |
| `Alt+1` … `Alt+9` | Choisit la n-ième option de la question (coche ou décoche pour un choix multiple). Les touches s’affichent sur les boutons. |
| Du texte, puis `Entrée` | Répond librement à la question, ou refuse l’autorisation avec ce texte. |

Ces touches marchent quand le focus est dans la conversation ou nulle part ; elles laissent leur place à un terminal, à l’éditeur et à une fenêtre ouverte. Quand plusieurs demandes attendent, le clavier répond à la première. Une demi-seconde de garde protège des mauvaises réponses : pendant 500 ms après qu’une demande est devenue celle à laquelle le clavier répond, ces touches (et `Entrée` dans le champ) ne font rien, pour qu’un `Ctrl+Entrée` destiné à envoyer ton message n’autorise pas une demande que tu n’as pas lue ; ton texte reste dans le champ.

Tu peux aussi autoriser ou refuser sans ouvrir l’agent, depuis [la vue d’ensemble](overview).

## Les longues conversations

Une conversation longue n’affiche d’abord que ses 80 derniers éléments (messages, appels d’outils, cartes). Un bouton « Afficher les 80 précédents » en haut ajoute les 80 suivants ; la vue reste sur ce que tu lisais. La conversation suit le bas tant que tu n’as pas remonté ; une fois remontée, un bouton « ↓ Nouveaux messages » te ramène en bas quand il y a du nouveau. Chaque agent se rouvre là où tu l’avais laissé.

Un résultat de [la recherche dans les conversations](overview#rechercher-dans-les-conversations) ouvre l’agent sur le message trouvé, même s’il est ancien, et le met en évidence un instant.

Un agent archivé s’ouvre en lecture : un bandeau « Agent archivé. » et un bouton « Restaurer » remplacent le champ de saisie.
