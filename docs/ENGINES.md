| `supports_effort(modèle)`, `supports_auto(modèle)` | Ce que prend un modèle (par modèle ; ce que prend le moteur est dans ses capacités, « Le registre »). |# Moteurs (harness) — l'interface entre Escouade et les CLI qui font tourner ses agents

Un **moteur** fait tourner les agents d'Escouade : Claude Code aujourd'hui, puis Codex, Copilot CLI, Cursor CLI et OpenCode (docs/TODO-1.8.md, chapitre 1). L'interface de l'app l'appelle **« Harness »**, le mot anglais gardé tel quel en français comme en anglais (décidé le 2026-10-16) ; le code et ce document disent `engine` et « moteur ».

Ce document décrit la forme de l'interface et ses choix. Il a été écrit avec le premier lot de la refonte multi-moteurs (ESC-26) : l'extraction de Claude Code derrière l'interface, sans changement de comportement. La partie « Ajouter un moteur » sera complétée avec le banc de conformité (lot 10).

## Où est quoi

| Fichier | Rôle |
|---|---|
| `src-tauri/src/engine/mod.rs` | L'interface : les traits `Engine` et `EngineProcess`, leurs types (`Spawn`, `Start`, `Escouade`, `Message`, `PermissionAnswer`, `Ready`, `Remote`, `OneShot`, `Weight`, `StartLost`), et `engine::of(meta)`, le moteur d'un agent. |
| `src-tauri/src/engine/registry.rs` | Le registre des moteurs : ce que chacun déclare (`EngineCaps`, `Tested`), sa version et son état sur la machine (`EngineInfo`), le refus d'une version trop ancienne (voir « Le registre »). |
| `src-tauri/src/engine/program.rs` | `Program` : le programme d'un moteur, du système ou de WSL (lancé par `wsl.exe`), et `Located`, où il est, comme les réglages le montrent. Commun à tous les moteurs. |
| `src-tauri/src/engine/claude/` | Claude Code, première implémentation : `mod.rs` (le moteur `Claude`, ses arguments, ses messages, ses one-shots, et `EngineProcess` pour son process), `process.rs` (`ClaudeProcess` : le process stdio et ses requêtes de contrôle, l'ancien `claude.rs`), `locate.rs` (où est `claude`). |
| `src-tauri/src/agent/claude.rs` | La traduction des frames de Claude Code (stream-json) en éléments de conversation : l'ancien corps de `AgentRt::handle_frame`. |
| `src-tauri/src/agent.rs` | La conversation normalisée d'un agent, son statut, ses demandes en attente, son usage : ce que chaque moteur remplit. |

Le reste du backend (cœur, tickets, pilote auto, serveur MCP, stats, comptes) ne parle plus à Claude Code que par ces deux traits : il ne construit plus aucune frame ni requête de contrôle (`core.rs` n'a plus un seul `json!`), ne lit plus les arguments de `claude`, ni son stderr.

## Les deux traits

### `Engine` : le moteur

Un objet par moteur, sans état (`static CLAUDE: Claude`). `engine::of(&meta)` donne celui d'un agent, `engine::default()` celui de ce qui n'a pas encore d'agent (une question sur un projet, les options d'un ticket). `engine::of` lit `AgentMeta.engine` (lot 2, ESC-27) par `engine::by_id` ; tant que seul Claude Code est écrit, chaque id rend Claude Code. `engine::default()` rend Claude Code.

| Méthode | Ce qu'elle fait | Claude Code |
|---|---|---|
| `id()`, `name()` | Son id dans les données (`claude`) et son nom (`Claude Code`). | |
| `locate(réglage, distribution)` | Son programme, du chemin d'un réglage (vide : là où il est d'habitude) ; un `Program` du système ou de WSL. | `resolve_binary` |
| `supports_effort(modèle)`, `supports_auto(modèle)` | Ce que prend un modèle (ce que prend le moteur, lui, est dans ses capacités : « Le registre »). | tous sauf Haiku |
| `spawn(Spawn, on_frame, on_exit)` | **Lancer, reprendre, copier** : le process d'un agent, d'une conversation neuve, reprise ou copiée selon `Spawn.start`. | `claude --output-format stream-json …` |
| `message(texte, pièces jointes)` | **Le message avec ses pièces jointes**, dans la forme de son moteur (`Message`, opaque) ; refusé pour un fichier d'un type ou d'une taille qu'il ne prend pas. | blocs `image`, `document`, `text` |
| `translate(rt, frame, fx)` | **La traduction** d'une frame du process dans la conversation de l'agent. | `AgentRt::claude_frame` |
| `start_lost(stderr)` | Pourquoi un process arrêté avant d'être prêt n'a pas pu démarrer : session perdue, ou point de copie absent. | « No conversation found », « No message found with message.uuid » |
| `one_shot(OneShot)` | Une question sans session, sans réglages de l'utilisateur ni serveur MCP : nom d'un agent, message de commit, titres, suggestion des étapes d'un worktree. | `claude -p --output-format json` |

### `EngineProcess` : le process vivant d'un agent

Tenu par `AgentRt.proc` (`Option<Process>`, `Process = Arc<dyn EngineProcess>`).

| Méthode | Opération du ticket | Claude Code |
|---|---|---|
| `is_alive`, `usage`, `still_running`, `pids` | (process, CPU et RAM par agent) | le Job de l'agent |
| `close_input` | **Arrêter** en douceur : il finit ce qu'il fait, la session reste reprenable. | stdin fermé |
| `kill` | **Arrêter** net, tout l'arbre. | `TerminateJobObject` |
| `wait_exit`, `wait_gone` | Attendre la fin du process, puis de tout ce qu'il a lancé. | |
| `initialize` | Le prêt du process : ses commandes et ses modèles (`Ready`). | `initialize` |
| `send_message(uuid, Message)` | **Envoyer un message** (pièces jointes comprises). | frame `user` |
| `interrupt(cancel_queued, délai)` | **Interrompre** le tour (et les messages en file). | `interrupt` |
| `set_model`, `set_effort`, `set_mode` | **Changer de modèle, d'effort ou de mode** en cours de process. | `set_model`, `apply_flag_settings`, `set_permission_mode` |
| `answer_permission(id, PermissionAnswer)` | **Répondre à une permission** : une fois, toujours (règles proposées gardées), ou refus avec un message. | `control_response` `allow` / `deny` |
| `answer_question(id, appel, input)` | **Répondre à une question**, ses réponses dans `input`. | `control_response` `allow` avec `updatedInput` |
| `read_usage` | **Lire l'usage** : les fenêtres du quota du compte, que lit `usage::parse_windows`. | `get_usage` |
| `rename(titre)` | Le titre de la session. | `rename_session` |
| `stop_task`, `task_output`, `remote_control` | Propres à Claude Code pour l'instant : tâches de fond et sous-agents, Remote Control. | `stop_task`, `get_task_output`, `remote_control` |
| `control(requête, délai)`, `reply(id, réponse)` | Le protocole du moteur, brut : une requête à lui, une réponse à une des siennes. Pour les tests et la traduction (refuser une `elicitation`). | `control_request` / `control_response` |

## Le flux : frames et éléments normalisés

Le process lit son flux et le passe en `Value` à `on_frame`, sauf les réponses aux requêtes qu'on lui a faites, qu'il garde pour lui (`control`). Le cœur appelle `AgentRt::handle_frame`, qui le confie au moteur de l'agent (`Engine::translate`). Chaque moteur remplit la même conversation :

- les éléments `user`, `text`, `thinking`, `tool`, `question`, `permission`, `turn`, `notice`, `event` (`AgentRt::append`, `patch`, `push_user`, `notice`) ;
- le statut (`set_status`), l'activité (`set_activity`), les demandes en attente (`add_pending`) ;
- les changements du bandeau « Plan » (`plan_apply`) ;
- l'usage du tour, la fin de tour (`Effects.turn_end`), la limite (`Effects.limited`), le quota (`Effects.rate`).

Le nom des outils reste celui de Claude Code pour tous les moteurs (`Bash`, `Edit`, `Write`, `Task`, `mcp__<serveur>__<outil>`…, table dans docs/TODO-1.8.md, « Un moteur par agent ») : `tools.ts`, la ligne d'activité, `convsearch.rs` et les cartes ne changent pas.

## Les choix

1. **Deux traits objets**, plutôt qu'une énumération des moteurs : ajouter un moteur, c'est écrire son adaptateur et une ligne dans `engine::of`, sans toucher aux appels du cœur. Les méthodes asynchrones rendent un `BoxFuture` (`Pin<Box<dyn Future + Send>>`) : les traits restent utilisables en objets, sans dépendance nouvelle (`async-trait`).
2. **Le moteur (sans état) et le process (vivant) sont séparés.** Ce qui se décide avant le process (son programme, ses arguments, la forme d'un message, un one-shot, la lecture de son stderr) est au moteur ; ce qui parle au process est au process. Un message est préparé par `Engine::message` **avant** que le process démarre : un fichier refusé laisse le message dans le composer sans rien lancer, comme avant.
3. **Lancer, reprendre et copier sont une seule méthode**, `spawn`, avec `Start::New`, `Start::Resume { session }` ou `Start::Fork { of, at }` (le point de la copie : le dernier message de l'original quand il a été copié). C'est la forme des essais de Codex (`thread/start`, `thread/resume`, `thread/fork` avec `lastTurnId`) et ce que docs/TODO-1.8.md dit de Copilot (dernier événement) et d'OpenCode (dernier message). Un moteur qui ne sait pas copier refusera `Start::Fork` (et « Dupliquer la conversation » est masqué par ses capacités, `fork: none`, voir « Le registre »).
4. **`spawn` reçoit ce qu'il faut savoir, pas des arguments de `claude`** : `Spawn` porte le programme, le dossier, l'environnement, le modèle, l'effort, le mode, les consignes ajoutées, `Start`, les dossiers lisibles sans question (`read_dirs` : fichiers joints, fichiers du ticket) et l'accès au serveur MCP d'Escouade (`Escouade::Granted { config }` ou `Denied { settings }`). Chaque moteur en fait ses options : `--add-dir`, `--mcp-config` ou `--settings` + `--disallowedTools` pour Claude Code ; `-c mcp_servers.escouade.*` pour Codex (essayé, docs/TODO-1.8.md, point 0).
5. **Le flux reste du JSON** (`serde_json::Value`) entre le process et la traduction : tous les protocoles connus en sont (stream-json de Claude Code, JSON-RPC de Codex, de Copilot et d'ACP, événements SSE d'OpenCode). Un moteur dont le transport n'est pas une ligne par message (en-têtes `Content-Length`, SSE) le lit dans son process et passe la même chose à `on_frame`.
6. **La traduction vit dans `agent/<moteur>.rs`**, un module enfant de `agent` : elle atteint l'état de l'agent (blocs en cours, demandes en attente, compteurs, plan) sans qu'il soit ouvert au reste du crate, comme `agent/transcript.rs` et `agent/sidechain.rs` le faisaient déjà. Le moteur l'appelle depuis `Engine::translate`.
7. **Les réponses aux demandes sont typées** (`PermissionAnswer::Allow`, `Always`, `Deny`) et portent à part l'id de la demande et l'appel d'outil qu'elle concerne (`call`) : chez Claude Code, `request_id` et `tool_use_id` ; chez Codex, l'id JSON-RPC de `requestApproval` et l'`itemId` ; chez ACP, l'id de `session/request_permission` et le `toolCallId`. Qui a répondu (« Refusé par <client> via Escouade ») reste écrit par le cœur, dans le message, pour tous les moteurs.
8. **Modèle, effort et mode gardent les valeurs d'Escouade** (celles de Claude Code : `auto`, `plan`, `acceptEdits`…) ; un autre moteur fera sa correspondance dans son adaptateur (pour Codex : `approvalPolicy`, bac à sable et `collaborationMode` pour le mode Plan). Les modes qu'il prend et leur sens sont dans ses capacités (« Le registre ») ; ses modèles viennent avec le composer (lot 4).
9. **Ce que Claude Code est seul à faire** (Remote Control, tâches de fond, arrêt d'un sous-agent) a ses méthodes à part dans `EngineProcess`, plutôt que des requêtes brutes dans le cœur. Un autre moteur les refusera (« non pris en charge ») et l'interface les masquera par ses capacités (docs/TODO-1.8.md, « Ce qui reste propre à Claude Code »).
10. **Une échappatoire, `control` et `reply`** : une requête et une réponse dans le protocole du moteur. Les tests s'en servent (`background_tasks`), et la traduction pour refuser ce qu'Escouade ne sait pas traiter. Le cœur n'en a pas besoin.
11. **Les one-shots disent leur poids, pas leur modèle** : `Weight::Light` (le modèle le plus rapide, sans outil : Haiku) ou `Weight::Reading` (un modèle plus fort, avec des outils qui ne font que lire : Sonnet avec `Read,Glob,Grep`). Le moteur choisit ; les textes rédigés par moteur sont le lot 7.
12. **Les lectures propres à un moteur passent par lui** : le stderr d'un démarrage raté (`start_lost`), le quota (`read_usage`), les modèles (`Ready`).

## Ce qui reste propre à Claude Code hors de `engine/`

L'extraction s'est arrêtée là où d'autres lots reprennent :

- **La vue Claude Code** : `tui.rs` (les arguments et réglages de l'interface de `claude`, ses hooks), `agent/transcript.rs` et `agent/sidechain.rs` (son transcript). Lot 9, vue terminal générique.
- **Les comptes et le quota** : `accounts.rs` (comptes Claude, `CLAUDE_CONFIG_DIR`, connexion), `usage.rs` (fenêtres du quota, point d'accès OAuth). Lot 5. `Program::launch` traduit encore `CLAUDE_CONFIG_DIR` et les options de chemin de Claude Code pour WSL (`PATH_OPTIONS`).
- **Le serveur MCP** : `mcp/install.rs` (l'entrée dans la config de Claude Code), `AgentAccess::refusal` (le fichier de réglages qui tient le serveur à l'écart). Lot 8.
- **Les consignes et les textes** : le protocole du ticket (`board::protocol_prompt`), les textes qui disent « Claude ». Lots 6 et 7.
- **Les modèles** : `ModelInfo::list` lit la liste de `initialize` de Claude Code. Avec les menus du composer (lot 4).

## Les données (ESC-27)

Le moteur est gardé partout où il compte, par son id (`EngineId` de `model.rs` : `claude`, `codex`, `copilot`, `cursor`, `opencode`). Ce qui a été enregistré avant la 1.8 vaut Claude Code.

| Où | Champ | Avant la 1.8 | Ce qu'il dit |
|---|---|---|---|
| Agent | `AgentMeta.engine` | `claude` | Le moteur de l'agent, un à la fois. Il n'en change que par une passation (ESC-88). Sa copie (« Dupliquer la conversation ») prend celui qu'il a au moment de la copie. |
| Ticket | `Ticket.engine` | `null` | Le moteur de ses agents, que le pilote auto suit ; `null` : celui du projet. |
| Projet | `Project.engine` | `null` | « Harness par défaut » de ses nouveaux agents et de ses tickets ; `null` : Claude Code (`Project::engine()`). L'assistant « Nouveau projet » le copie avec les réglages des agents. |
| Tour | `TurnRow.engine`, élément `turn` (`engine`), colonne `engine` de la table `turns` de `stats.db` | `claude` (défaut de la colonne, ajoutée par `stats::migrate`) | Le moteur qui a fait le tour : celui de l'agent à ce tour, gardé même s'il en change ensuite. `StatsView.by_engine` les additionne. |

Le moteur d'un nouvel agent : celui demandé (`AgentOptions.engine`), sinon celui de son ticket, sinon celui de son projet. Les outils MCP `list_agents` et `get_agent_summary` le donnent (`engine`). Aucun texte de l'interface ne le montre encore : le choix et la marque du moteur viennent avec le lot 4.

## Le registre (ESC-28)

`engine/registry.rs` tient ce que chaque moteur déclare et ce qu'on trouve de lui sur la machine. `registry::all()` liste les moteurs écrits (Claude Code seul aujourd'hui), le moteur par défaut en premier.

### Ce que chaque moteur déclare (`Engine`)

| Méthode | Ce qu'elle dit | Claude Code |
|---|---|---|
| `locate(réglage, distribution)` | Son exécutable, comme `resolve_binary` le trouve pour `claude` (binaire natif sous Windows, ou programme de WSL). | `resolve_binary` |
| `version_args()` | Ce qui lui fait écrire sa version ; `registry::version` en lit le premier numéro (`2.1.301 (Claude Code)`), gardé tant que le fichier ne change pas. | `--version` |
| `tested()` | Sa plage de versions testées (`Tested { oldest, newest }`). | 2.1.283 (protocole de base, docs/PROTOCOL.md) à 2.1.301 (dernier essai réel) |
| `oldest_reason(langue)`, `update_command()` | Pourquoi une version plus ancienne est refusée, et la commande qui le met à jour. | « son flux JSON n'a été vérifié qu'à partir de celle-ci », `claude update` |
| `caps()` | Ses capacités (`EngineCaps`, ci-dessous). | voir `tests/fixtures/engines/claude.json` |

### Les capacités (`EngineCaps`)

| Champ | Ce qu'il dit | Ce que l'interface en fait | Claude Code |
|---|---|---|---|
| `modes` | Les modes d'Escouade qu'il prend, chacun avec son sens chez lui (`meaning`, `null` : celui du menu, donc de Claude Code). | Le menu « Mode » ne liste qu'eux, avec leur sens. | les cinq |
| `effort` | Ses modèles prennent un effort (chaque modèle peut encore n'en avoir aucun : `supports_effort`). | Le menu « Effort » est masqué sinon. | oui |
| `images`, `pdf` | Images et PDF joints à un message. | `Engine::message` refuse ce qu'il ne lit pas. | oui |
| `fork` | La copie d'une conversation et jusqu'où : `none`, `entry`, `turn`, `event`, `message`. | « Dupliquer la conversation » masqué pour `none`. | `entry` |
| `resumeOtherAccount` | Une conversation reprise sur un autre compte du même moteur. | (comptes, lot 5) | oui |
| `midTurn` | Un message envoyé pendant un tour : `queued`, `immediate` ou `refused`. | (composer, lot 4) | `queued` |
| `slashCommands` | Ses commandes `/` pour un client. | Le composer n'en propose pas sinon. | oui |
| `quota` | Le quota de ses comptes : `windows`, `credits` ou `none`. | (lot 5) | `windows` |
| `cost` | Le coût d'un tour : `exact`, `estimated` ou `none`. | Le coût est masqué pour `none` (carte, en-tête, vue d'ensemble). | `exact` |
| `terminalView` | Sa propre interface dans un terminal. | « Vue Claude Code » et son réglage masqués sinon. | oui |
| `remoteControl` | Remote Control. | Le menu, l'icône de la carte et le réglage masqués sinon. | oui |
| `backgroundTasks` | Tâches de fond, workflows, arrêt d'un sous-agent. | La pastille « N en fond » et la liste sous la carte masquées sinon. | oui |
| `todoTools` | Les outils de tâches qu'on peut lui donner (`CLAUDE_CODE_ENABLE_TODO_TOOLS`). | Le réglage masqué si aucun moteur ne l'a. | oui |
| `defaultRefusal` | Il dit ce qu'il refuserait par défaut. | (l'avertissement vient de son flux) | oui |

La fenêtre reçoit les déclarations au démarrage (`InitialState.engines`, `EngineDecl`) et ne décide d'afficher une fonction que par `src/lib/engines.ts` (`can`, `canFork`, `showsCost`, `modesOf`, `anyCan`) : jamais d'après le nom du moteur, ce qu'un test vérifie en cherchant dans le code de la fenêtre (`src/lib/engines.test.ts`). Une fonction qu'un moteur n'a pas est masquée, pas grisée. Le fichier `tests/fixtures/engines/claude.json`, la déclaration de Claude Code que prennent les tests de la fenêtre, reste égal à celle du backend (test Rust).

### Version et état

`registry::state_of` donne l'état d'un moteur : `absent` (programme introuvable), `tooOld` (version plus ancienne que la plage : refusée), `notConnected` (aucun compte connecté), `untested` (plus récente : utilisée, avec un avertissement), `ready`. Une version qu'il ne dit pas est prise telle quelle. La commande `engines` le rend pour chaque moteur (`EngineInfo` : programme, version, plage, état, texte, capacités) ; Réglages › Harness l’affiche avec son état (voir « L’interface »).

Le refus est fait au démarrage du process d'un agent, en vue Escouade comme en vue Claude Code (`registry::check`, après `accounts::program`) : « Claude Code 2.0.14 est trop ancien pour Escouade, qui demande au moins la version 2.1.283 : … Mets-le à jour (claude update). » L'avertissement : « Claude Code 2.1.400 n'a pas été testé avec Escouade (testé jusqu'à la 2.1.301) : il est utilisé quand même, et ce qu'Escouade ne reconnaît pas de lui est ignoré. »

### La lecture tolère l'inconnu

Un champ inconnu est ignoré, une frame, un événement, un bloc ou un delta inconnus sont écartés sans casser le tour (`agent.rs`, `an_unknown_field_or_frame_of_a_newer_claude_code_leaves_the_turn_going`). Chaque nouvel adaptateur fait de même.

### Les schémas des versions testées

Le schéma de la plus récente version testée est gardé dans le dépôt : `tests/fixtures/engines/claude-code-<version>.schema.json`, les frames de Claude Code et leurs champs, relevés dans ses flux réels enregistrés (`tests/fixtures/real-run-*.jsonl`) et, pour ce qu'aucun enregistrement n'a, dans docs/PROTOCOL.md. Deux tests le tiennent : chaque champ qu'Escouade lit y est (`claude_code_frames_read_by_escouade_are_in_the_schema`), et chaque champ des flux enregistrés aussi. Passer `tested().newest` à une version nouvelle demande son schéma. Pour Codex, ce sera la sortie de `codex app-server generate-json-schema` ; pour Copilot, le schéma du protocole de son SDK ; pour Cursor, celui d'ACP et la liste des extensions `cursor/*`.

## L'interface (ESC-29)

Ce que l'utilisateur voit des moteurs, toujours appelés « Harness » à l'écran. Avec Claude Code seul, rien ne change à l'écran, hors l'onglet renommé et l'écran de premier lancement.

### Ce que chaque moteur déclare de plus

`EngineDecl` (ce que la fenêtre reçoit au démarrage) porte, en plus de ses capacités :

| Champ | Méthode de `Engine` | Ce que l'interface en fait | Claude Code |
|---|---|---|---|
| `install` (`windows`, `unix`) | `install()` | La commande qui l'installe, sur l'écran « Aucun harness trouvé » et dans Réglages › Harness quand il est introuvable. | `irm https://claude.ai/install.ps1 \| iex`, `curl -fsSL https://claude.ai/install.sh \| bash` |
| `models` (`id`, `label`, `effort`, `auto`) | `models()` | Le menu « Modèle » du composer, dans son ordre ; chaque modèle dit s'il prend un effort et le mode `auto` (`supports_effort`, `supports_auto`, un test vérifie l'accord). Le nom affiché devient la version que le moteur dit faire tourner (`ModelInfo`, `initialize`) quand il l'a dite. | les alias `fable`, `opus`, `sonnet`, `haiku` (Haiku sans effort ni `auto`) |
| `efforts` | `efforts()` | Le menu « Effort », vide (et masqué) sans `caps.effort`. | `low` à `max` |

`InitialState.enginesFound` (et la commande `claude_found`, relue quand le chemin est enregistré) liste les moteurs dont le programme est trouvé (`Core::engines_found` ; pour Claude Code, sur le compte où partent les nouveaux agents). C'est la seule liste que l'interface propose : un moteur absent n'apparaît que dans Réglages › Harness.

### Où chaque chose se montre

Tout passe par `src/lib/engines.ts`, jamais par le nom du moteur :

| Fonction | Ce qu'elle dit | Où |
|---|---|---|
| `offered()`, `choosesEngine()`, `engineOptions(actuel)` | Les moteurs trouvés ; s'il y a un choix (deux ou plus) ; les options d'un menu « Harness » (celui d'un ticket ou d'un projet reste listé même s'il n'est plus trouvé). | Réglages › Projets « Harness par défaut », menu « ▾ » de « Nouvel agent » (« Nouvel agent sur … », celui du projet en premier), champ « Harness » de la fenêtre d'un ticket (« Celui du projet (…) » par défaut). Tous masqués avec un seul moteur trouvé. |
| `showsMark()`, `EngineMark.svelte` | La marque du moteur d'un agent (son premier mot : « Claude », « Codex »…), dès que les agents non archivés tournent sur deux moteurs. | Carte de l'agent (barre latérale), vue d'ensemble, en-tête de sa conversation, carte de son ticket. |
| `modelsOf`, `effortsOf`, `modelTakes`, `modesOf` | Les menus du composer : modèles, efforts, et ce qu'un modèle prend ; les modes avec leur sens (`ModeCap.meaning`). Les commandes `/` viennent du process de l'agent, et ne sont proposées que si son moteur en a (`slashCommands`). | `Composer.svelte` |

Réglages › Harness (`AppTab.svelte`, onglet `claude`) : un groupe par moteur déclaré, avec son exécutable (le champ du chemin pour le moteur par défaut, le seul qui ait un réglage de chemin tant que chaque moteur n'a pas le sien ; « Trouvé : … » pour les autres), sa version et son état (`EngineInfo`, commande `engines`), et « Se connecter… », qui ouvre la connexion du compte où partent les nouveaux agents (la fenêtre « Se connecter au compte », qui revient ensuite à l'onglet). Un moteur introuvable y donne sa commande d'installation.

La fenêtre d'un ticket envoie `engine` (null : celui du projet) ; `TicketDraft.engine` est absent pour les outils MCP et les imports, qui laissent au ticket le sien. `create_agent` et `create_agent_on_branch` prennent `engine` (null : celui du ticket, puis du projet, voir « Les données »).

## Ajouter un moteur (ébauche)

1. Écrire `engine/<moteur>/` : un `Engine` (lancement, message, one-shot, lecture du stderr) et un `EngineProcess` pour son process (dans le Job de l'agent, `job::Job::for_child`).
2. Écrire `agent/<moteur>.rs` : la traduction de son flux dans les éléments normalisés, les noms d'outils de Claude Code.
3. Le faire rendre par `engine::by_id` pour son `EngineId` (déjà dans les données : `AgentMeta.engine`, voir « Les données »).
4. Sa ligne dans `registry::all()`, ses capacités, sa plage de versions testées et le schéma de la plus récente (voir « Le registre »), son faux moteur et le banc de conformité (lot 10).

## Vérification de l'extraction (ESC-26)

Sans changement de comportement : `core_tests.rs`, `tickets_tests.rs` et les tests de `agent.rs` sont inchangés ; les autres fichiers de tests n'ont changé que par leurs imports (`crate::claude::…` devenu `crate::engine::…`). Les tests unitaires des arguments et des messages de Claude Code ont suivi leur code dans `engine/claude/mod.rs`, ceux du programme et de sa localisation dans `engine/program.rs` et `engine/claude/locate.rs`.
