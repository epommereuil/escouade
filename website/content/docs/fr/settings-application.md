# Réglages : Application

Cette page décrit la fenêtre des réglages (ses onglets, son ouverture, son enregistrement) et son onglet « Application », qui règle l’affichage (le zoom de l’interface, la taille du texte des terminaux et de l’éditeur) et choisit la langue de l’interface et celle des textes que Claude rédige.

## La fenêtre des réglages

Les réglages d’Escouade tiennent dans une seule fenêtre, avec un onglet par sujet. Ouvre-la avec `Ctrl+,` (`⌘,` sous macOS) ou avec le bouton ⚙ de la [barre d’état](interface). Elle s’ouvre sur l’onglet « Claude Code », sauf quand un bouton l’ouvre directement sur l’onglet qui le concerne : le bouton ⚙ de l’en-tête du [Kanban](board) ouvre « Kanban », le menu d’un projet ouvre « Projets ». Le raccourci ne fait rien tant qu’une autre fenêtre est ouverte.

### Les onglets

La colonne de gauche liste les onglets, avec la version d’Escouade en bas. Le nom et la description de l’onglet affiché sont en haut de la partie droite. Quand le focus est sur la liste, les flèches haut et bas passent d’un onglet à l’autre, `Home` et `End` vont au premier et au dernier.

| Onglet | Ce qu’il règle |
|---|---|
| « Application » | Zoom, taille du texte et langues |
| [« Claude Code »](settings-claude-code) | Exécutable, modèle et permissions par défaut |
| [« Comptes Claude »](settings-accounts) | Les comptes sur lesquels partent les agents, enregistrés à chaque changement |
| [« Notifications »](settings-notifications) | Alertes visuelles et sonores |
| [« Projets »](settings-projects) | Réglages propres à chaque projet |
| [« Kanban »](settings-board) | Pilote auto et tickets validés |
| [« Intégrations »](settings-integrations) | Jira, Trello, GitHub Issues et Linear |
| [« Terminaux »](settings-terminals) | Shells disponibles dans les terminaux intégrés |
| [« Réseau »](settings-network) | Proxy HTTP(S) et certificats TLS pour Claude Code, les intégrations et les mises à jour |
| [« À propos »](settings-about) | Version et données locales |

« Projets », « Kanban » et « Intégrations » règlent un projet à la fois. Sous l’en-tête, une rangée « Projet » propose un bouton par projet ouvert, avec sa pastille de couleur et son nom. La fenêtre démarre sur le projet affiché, ou sur celui du bouton qui l’a ouverte. Changer de projet ne perd pas ce que tu as modifié sur les autres. Sans projet ouvert, ces onglets disent « Aucun projet ouvert. ».

### Enregistrer ou annuler

Les changements se font dans un brouillon : rien ne s’applique avant « Enregistrer ». Un point sur un onglet (info-bulle « Modifié, pas encore enregistré ») signale qu’il contient des changements non enregistrés.

- « Enregistrer » enregistre d’un coup tout ce qui a changé, dans tous les onglets et pour tous les projets. La fenêtre se ferme et affiche « Réglages enregistrés ». Si une partie échoue, un message d’erreur s’affiche, la fenêtre reste ouverte, et ce qui a pu être enregistré ne compte plus comme un changement.
- « Annuler », la croix, `Échap` ou un clic sur le fond ferment la fenêtre et jettent le brouillon, sans demander confirmation. À la réouverture, tout repart de ce qui est enregistré.
- Quand un problème empêche d’enregistrer, un message rouge s’affiche en bas à gauche, nomme le projet concerné (même s’il n’est pas celui qui est affiché) et « Enregistrer » est grisé. Trois cas : un projet n’a plus de nom ; une commande de lancement n’a pas de nom ou pas de ligne de commande ; le dossier des worktrees ou un préfixe de branche d’un projet n’est pas valide.

### Ce qui s’enregistre tout de suite

Trois endroits n’attendent pas le bouton. L’onglet « Comptes Claude », où chaque changement part au moment où tu le fais, et l’interrupteur « Claude et les agents peuvent piloter Escouade » de l’onglet « Claude Code », parce qu’un « Annuler » ne pourrait pas défaire ce qu’ils écrivent sur le disque. Et le groupe « Affichage » de l’onglet « Application », qui change aussi au clavier, fenêtre des réglages ouverte ou non : ce que tu y choisis se voit et s’enregistre tout de suite.

## L’onglet « Application »

L’onglet a deux groupes, « Affichage » et « Langue ».

### Affichage

Ces trois réglages s’appliquent tout de suite, sans « Enregistrer » ni redémarrage, et restent d’un lancement à l’autre.

| Réglage | Effet | Par défaut |
|---|---|---|
| « Zoom de l’interface » | Agrandit ou réduit toute la fenêtre, comme le zoom d’un navigateur : le texte, les espacements et les icônes ensemble, terminaux et éditeur compris. Paliers : 80 %, 90 %, 100 %, 110 %, 125 %, 150 %, 175 % et 200 %. | 100 % |
| « Taille du texte des terminaux » | La taille de la police des terminaux et de la [vue Claude Code](claude-code-view), en pixels, de 9 à 24 par demi-pixel. Le zoom s’y ajoute. | 12.5 |
| « Taille du texte de l’éditeur » | La taille de la police de l’[éditeur](editor), en pixels, de 9 à 24 ; les lignes grandissent avec elle. Le zoom s’y ajoute. | 12.5 |

Au clavier, partout, même dans un terminal ou avec une fenêtre ouverte : `Ctrl+=` (ou `Ctrl++`) agrandit d’un palier, `Ctrl+-` réduit d’un palier, `Ctrl+0` revient à 100 % (`⌘=`, `⌘-`, `⌘0` sous macOS). Les touches `+` et `-` du pavé numérique marchent aussi.

Un terminal dont la police change se redimensionne aussitôt dans sa zone, et son programme apprend sa nouvelle taille en colonnes et en lignes : rien ne dépasse ni ne se coupe.

> [!NOTE]
> L’interface est prévue pour au moins 1000 × 600 pixels, la taille minimale de la fenêtre. Un palier qui ne laisserait pas cette place est grisé, avec l’info-bulle « Trop grand pour la taille de la fenêtre », et `Ctrl+=` s’arrête avant. Si la fenêtre rétrécit sous le palier choisi, l’interface passe au plus grand palier qu’elle peut tenir, et l’onglet le dit ; le palier choisi revient dès que la fenêtre est assez grande.

### Langue

Les deux choix prennent effet dès l’enregistrement, sans redémarrer : la fenêtre, les menus de l’app et les textes qu’Escouade écrit passent dans la nouvelle langue.

| Réglage | Effet | Par défaut |
|---|---|---|
| « Langue de l’interface » | La langue de la fenêtre, des menus de l’app et des messages qu’Escouade affiche. | « Système » |
| « Langue des textes rédigés par Claude » | La langue de ce que Claude écrit pour toi : commits, pull requests, commentaires, consignes aux agents. | « Comme l’interface (par défaut) » |

### Langue de l’interface

Trois choix, chacun écrit dans sa propre langue pour que tu retrouves la tienne quelle que soit celle de l’interface :

- « Système (Français) » suit la langue de l’ordinateur. Escouade existe en français et en anglais : elle prend le français quand la première langue préférée du système est le français, l’anglais sinon. La langue du système est nommée dans celle de l’interface, donc un système en anglais avec une interface en français donne « Système (Anglais) ».
- « English ».
- « Français ».

Le changement touche aussi les menus natifs de l’app et l’info-bulle de l’icône de la barre des tâches.

### Langue des textes rédigés par Claude

Ce choix décide dans quelle langue Escouade demande à Claude d’écrire ce qui sort de l’app :

- les messages de commit et les descriptions de pull request proposés, voir [Git](git) ;
- les commentaires publiés dans Jira, Trello, GitHub et Linear, voir [les intégrations](integrations) ;
- les consignes qu’Escouade donne aux agents.

Les trois choix sont « Comme l’interface (par défaut) », « English » et « Français ». Avec « Comme l’interface », le message de commit proposé reprend la langue des derniers commits du dépôt, pour s’y fondre. Avec « English » ou « Français », c’est cette langue qui est demandée.

> [!TIP]
> Beaucoup d’équipes commitent en anglais avec une interface en français : choisis « Français » pour l’interface et « English » pour les textes de Claude.
