# Moteurs (harness) — l'interface entre Escouade et les CLI qui font tourner ses agents

Un **moteur** fait tourner les agents d'Escouade : Claude Code aujourd'hui, puis Codex, Copilot CLI, Cursor CLI et OpenCode (docs/TODO-1.8.md, chapitre 1). L'interface de l'app l'appelle **« Harness »**, le mot anglais gardé tel quel en français comme en anglais (décidé le 2026-10-16) ; le code et ce document disent `engine` et « moteur ».

Ce document décrit la forme de l'interface et ses choix. Il a été écrit avec le premier lot de la refonte multi-moteurs (ESC-26) : l'extraction de Claude Code derrière l'interface, sans changement de comportement. « Le banc de conformité » et la liste à cocher « Ajouter un moteur » sont venus avec le lot 10 (ESC-35).

## Où est quoi

| Fichier | Rôle |
|---|---|
| `src-tauri/src/engine/mod.rs` | L'interface : les traits `Engine` et `EngineProcess`, leurs types (`Spawn`, `Start`, `Escouade`, `Message`, `PermissionAnswer`, `Ready`, `Remote`, `OneShot`, `Weight`, `StartLost`), et `engine::of(meta)`, le moteur d'un agent. |
| `src-tauri/src/engine/registry.rs` | Le registre des moteurs : ce que chacun déclare (`EngineCaps`, `Tested`), sa version et son état sur la machine (`EngineInfo`), le refus d'une version trop ancienne (voir « Le registre »). |
| `src-tauri/src/engine/mcp.rs` | Le serveur MCP d'Escouade d'un process : `Escouade` (donné ou refusé), `Launch` (ses arguments et variables), `SERVER` et `tool_name` (les noms `mcp__escouade__<outil>`), voir « Le serveur MCP d'Escouade ». |
| `src-tauri/src/engine/program.rs` | `Program` : le programme d'un moteur, du système ou de WSL (lancé par `wsl.exe`), et `Located`, où il est, comme les réglages le montrent. Commun à tous les moteurs. |
| `src-tauri/src/engine/claude/` | Claude Code, première implémentation : `mod.rs` (le moteur `Claude`, ses arguments, ses messages, ses one-shots, et `EngineProcess` pour son process), `process.rs` (`ClaudeProcess` : le process stdio et ses requêtes de contrôle, l'ancien `claude.rs`), `locate.rs` (où est `claude`). |
| `src-tauri/src/agent/claude.rs` | La traduction des frames de Claude Code (stream-json) en éléments de conversation : l'ancien corps de `AgentRt::handle_frame`. |
| `src-tauri/src/engine/bench/` | Le banc de conformité (tests seulement) : les scénarios et leur pilote (`mod.rs`), le rejeu des flux enregistrés (`replay.rs`). Voir « Le banc de conformité ». |
| `src-tauri/src/engine/claude/bench.rs` | Claude Code sur le banc, avec le faux `claude`, et le rejeu de ses flux (`tests/fixtures/replays/claude/`). |
| `src-tauri/src/engine/minimal/`, `src-tauri/src/agent/minimal.rs` | Le faux moteur minimal (tests seulement) : le moins qu'un moteur écrive pour passer le banc. |
| `src-tauri/src/agent.rs` | La conversation normalisée d'un agent, son statut, ses demandes en attente, son usage : ce que chaque moteur remplit. |

Le reste du backend (cœur, tickets, pilote auto, serveur MCP, stats, comptes) ne parle plus à Claude Code que par ces deux traits : il ne construit plus aucune frame ni requête de contrôle (`core.rs` n'a plus un seul `json!`), ne lit plus les arguments de `claude`, ni son stderr.

## Les deux traits

### `Engine` : le moteur

Un objet par moteur, sans état (`static CLAUDE: Claude`). `engine::of(&meta)` donne celui d'un agent, `engine::default()` celui de ce qui n'a pas encore d'agent (une question sur un projet, les options d'un ticket). `engine::of` lit `AgentMeta.engine` (lot 2, ESC-27) par `engine::by_id` ; tant que seul Claude Code est écrit, chaque id rend Claude Code. `engine::default()` rend Claude Code.

| Méthode | Ce qu'elle fait | Claude Code |
|---|---|---|
| `id()`, `name()` | Son id dans les données (`claude`) et son nom (`Claude Code`). | |
| `speaker()` | Le nom de ses agents dans les textes (« Claude attend ta réponse », voir « Les textes et les consignes »). | `Claude` |
| `instructions_room()` | La place des consignes ajoutées (`Spawn.append_prompt`) : un poids maximal et la façon de peser un texte, ou aucune borne. | 6 000, pesés comme cmd.exe échappe un argument de `.cmd` |
| `subagent_relay(langue, titre, tâche, texte)` | Ce que l'agent reçoit pour transmettre un message à un de ses sous-agents ; aucun s'il ne sait pas. | « … avec l'outil SendMessage … » |
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
4. **`spawn` reçoit ce qu'il faut savoir, pas des arguments de `claude`** : `Spawn` porte le programme, le dossier, l'environnement, le modèle, l'effort, le mode, les consignes ajoutées, `Start`, les dossiers lisibles sans question (`read_dirs` : fichiers joints, fichiers du ticket) et l'accès au serveur MCP d'Escouade (`Escouade::Granted { url, token, file }` ou `Denied { file }`, voir « Le serveur MCP d'Escouade »). Chaque moteur en fait ses options : `--add-dir`, `--mcp-config` ou `--settings` + `--disallowedTools` pour Claude Code ; `-c mcp_servers.escouade.*` pour Codex (essayé, docs/TODO-1.8.md, point 0).
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

- **La vue Claude Code** : passée par l'interface `TerminalView` (lot 9, ESC-34, « La vue terminal » ci-dessous). Restent propres à Claude Code, hors de cette interface : Remote Control (`--remote-control`, ses liens) et les sous-agents lus dans les transcripts (`agent/sidechain.rs`).
- **Les comptes et le quota** : `accounts.rs` (comptes Claude, `CLAUDE_CONFIG_DIR`, connexion), `usage.rs` (fenêtres du quota, point d'accès OAuth). Lot 5. `Program::launch` traduit encore `CLAUDE_CONFIG_DIR` et les options de chemin de Claude Code pour WSL (`PATH_OPTIONS`).
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

## Le serveur MCP d'Escouade (ESC-33)

Donner le serveur MCP d'Escouade au process d'un agent, le lui refuser, et le déclarer dans la config de l'utilisateur (« <harness> peut piloter Escouade ») passent par le moteur. Le cœur décide (`Core::agent_access`, avec l'interrupteur et l'état du serveur, comme avant) ; le moteur dit comment. Claude Code en est la première implémentation (`engine/claude/mcp.rs`), sans changement : mêmes arguments, mêmes fichiers, mêmes commandes.

| Méthode de `Engine` | Ce qu'elle fait | Claude Code |
|---|---|---|
| `grant_file(url, jeton)` | Ce que contient le fichier privé du process (écrit avant son lancement en `<données>/mcp/<id de l'agent>.json`, 0600, oublié à la fin du process) ; `None` : pas de fichier, le moteur passe le serveur autrement. | `{"mcpServers":{"escouade":{"type":"http","url","headers":{"Authorization":"Bearer …"}}}}` |
| `refusal()` | Ce que lit un process privé du serveur, dans un fichier commun à tous les agents (`mcp-refused.json`) ; `None` : ses arguments suffisent. | `{"deniedMcpServers":[{"serverName":"escouade"}]}` |
| `escouade_launch(Escouade)` | Les arguments (donnés en dernier) et les variables du process, donné ou refusé. **Jamais le jeton dans les arguments** : un fichier ou une variable le porte. | `--mcp-config <fichier>` ; refusé, `--settings <fichier>` (s'il y en a un) puis `--disallowedTools mcp__escouade` |
| `declared(config)` | Ce que dit la config de l'utilisateur du serveur (`Standing` : pas de fichier, illisible, absent, déclaré). | l'entrée `mcpServers.escouade` du `.claude.json` du compte |
| `add_declaration`, `remove_declaration` | Ajouter ou retirer l'entrée du compte (`Target` : son programme, son environnement, sa config). | `claude mcp add --scope user --transport http …`, `claude mcp remove escouade --scope user` |
| `manual_declaration` | La commande à lancer à la main (« Copier la commande »). | PowerShell ou shell POSIX, avec `CLAUDE_CONFIG_DIR` le temps de la commande |

`Escouade` (`engine/mcp.rs`) est ce que le cœur donne au moteur : `Granted { url, token, file }` ou `Denied { file }`. Son `{:?}` masque le jeton, et celui de `mcp::Launch` ne montre que le nom des variables. La vue Claude Code (`tui.rs`) prend les mêmes arguments, et met le refus du moteur dans son propre fichier de réglages (Claude Code ne lit que le dernier `--settings`).

`mcp/install.rs` garde ce qui est commun : la comparaison (absente : ajout ; identique : rien ; différente : retrait puis ajout), le masquage des jetons dans les erreurs, le lancement d'une commande d'un compte (`run`), et la boucle sur les comptes. Les comptes sont encore ceux de Claude Code (lot 5) : la déclaration passe par leur moteur, `engine::default()`.

**Les noms des outils.** Chaque moteur nomme le serveur `escouade` (`mcp::SERVER`), et chaque adaptateur nomme un appel d'outil MCP par `mcp::tool_name(serveur, outil)`, `mcp__<serveur>__<outil>` : les appels d'Escouade sont `mcp__escouade__<outil>` quel que soit le moteur, et la carte de permission, les libellés (`tools.ts`), la ligne d'activité et la recherche marchent tels quels. Codex (ESC-38) y viendra par `-c mcp_servers.escouade.url=…` et `bearer_token_env_var`, le jeton dans une variable du process (`grant_file` à `None`), et `-c mcp_servers.escouade.enabled=false` pour le refus ; sa déclaration (ESC-50) par son `config.toml`.

Tests : `mcp/agents_tests.rs` (`no_engine_puts_the_token_on_the_command_line` vérifie la règle du jeton pour chaque moteur de `registry::all()`, et `keeps_the_token_off_the_command_line` resservira au banc de conformité ; le lancement réel, flux et vue Claude Code, n'a jamais le jeton sur sa ligne de commande), `mcp/install_tests.rs` (déclaration par le moteur), `PermissionCard.test.ts` (même carte pour un agent d'un autre harness).

## Les textes et les consignes (ESC-31)

### Les textes

Un texte qui parle d'un agent le nomme comme son moteur, par `Engine::speaker` (« Claude » pour Claude Code) :

- dans la fenêtre, le paramètre `{engine}` des catalogues, que `speakerOf(agent.engine)` de `src/lib/engines.ts` remplit depuis la déclaration (`EngineDecl.speaker`) : « {engine} attend ta réponse », « {engine} travaille… », « {engine} demande une autorisation », « {engine} propose un plan », le placeholder et la file d'attente du composer, le sens des modes « Demander » et « Plan » (`modeTitle` de `src/lib/models.ts` ; le menu des réglages nomme le moteur par défaut), la vue d'ensemble. `{harness}` (`engineName`) nomme le moteur lui-même : « la session {harness} reste sur le disque », « hors du mode de permission de {harness} » ;
- dans le backend : la notification d'une question sans texte (`notify::question_body`), « {speaker} ne tourne plus pour cet agent », la session ou le point de copie perdus, et le nom du moteur (`name()`) dans « … s'est arrêté (code N) », « … n'a pas pu démarrer », « … introuvable ».

Un texte qui vaut pour tous les agents dit « les agents » : « Langue des textes rédigés par les agents », « Arrêter les processus des agents inactifs après », « 2 agents · 1,5 Go · 12 % CPU » dans la barre d'état. Restent « Claude » ou « Claude Code » : les comptes Claude et leurs quotas (lot 5), le Remote Control, la vue Claude Code (lot 9), les tâches de fond et les sous-agents (propres à Claude Code, masqués par les capacités), le serveur MCP (lot 8) et les textes rédigés par un one-shot (« Claude lit le projet… », lot 7).

### Les consignes

Le protocole du ticket (`board::protocol_prompt_for`) et les messages du pilote auto (premier message, boucles, reprise, retour de test, tests en échec, conflits, préparation du lancement) ne nomment aucun outil propre à Claude Code : « pose la question avec l'outil de question », pas `AskUserQuestion`. Un test le vérifie dans les deux langues (`board.rs`, `the_protocol_and_the_autopilots_messages_name_no_tool_of_claude_code`).

Le protocole est une consigne ajoutée : le pilote auto le met dans `AgentOptions.append_prompt`, que `Spawn.append_prompt` porte au moteur, qui le passe à sa façon (Claude Code : `--append-system-prompt` ; Codex : `developerInstructions` de `thread/start`). Sa longueur suit le moteur du ticket (`Engine::instructions_room`) : pour Claude Code, la ligne de commande d'un `.cmd` (6 000, pesés par `escaped_len`), les critères qui n'y tiennent pas remplacés par « … » ; sans borne, tous les critères.

Ce qui nomme un outil d'un moteur passe par lui : le message transmis à un sous-agent (`Engine::subagent_relay`, l'outil `SendMessage` de Claude Code).

## La vue terminal (ESC-34)

« Vue <harness> » : un agent tourne dans l'interface de son harness elle-même, dans un terminal intégré, à la place de la conversation d'Escouade. Une session n'a qu'un process à la fois : changer de vue arrête l'un et reprend la session dans l'autre. Le cœur (`tui.rs`) fait le même travail pour tous les harness (terminal et sortie gardée, serveur de hooks et jetons, lecture du journal au fil de l'eau, sortie aussitôt et session perdue, file des messages, arrêt) et ne parle à un harness que par son `TerminalView` (`engine/terminal.rs`), que `Engine::terminal()` donne, `None` pour un harness sans vue terminal (`caps().terminal_view` dit la même chose, ce qu'un test vérifie pour chaque harness).

| Méthode | Ce qu'elle dit | Claude Code (`engine/claude/terminal.rs`) |
|---|---|---|
| `shell()` | Le nom de son terminal. | `claude` |
| `launch(TerminalLaunch)` | Ses arguments, son fichier privé et ses variables, depuis l'agent, la session nommée d'avance, Remote Control, le serveur de hooks (`HookServer` : adresse, variable du jeton, variable de l'adresse, `escouade-hook`) et le serveur MCP donné ou refusé. | `tui_args`, et les hooks HTTP dans le fichier de `--settings` |
| `read_dir_args(dossier)` | Ce qui lui fait lire un dossier sans demander (celui des fichiers joints). | `--add-dir=<dossier>` |
| `names_its_session()` | Escouade nomme une session neuve avant le lancement ; sinon, son premier hook la dit. | oui (`--session-id`) |
| `on_hook(rt, hook)` | L'état en direct : début et fin de tour, permission ou question en attente. | `AgentRt::on_hook` |
| `running_dir`, `find_running` | Où il liste ses interfaces lancées, et la sienne : elle est passée ce qu'elle demande avant de lire un message. | `<dossier du compte>/sessions`, `tui::find_registered` |
| `find_log`, `on_log_entry` | La conversation : le journal de la session, et chaque entrée traduite. | `projects/*/<session>.jsonl`, `AgentRt::on_transcript` |
| `says_session_lost`, `copy_session` | La reprise : ce qu'il écrit quand il ne trouve pas la session, et la copie d'une session d'un compte à l'autre. | « No conversation found », `accounts::copy_session` |
| `paste`, `submit`, `image_types` | Le collage d'un message (entre crochets, puis la touche d'envoi), et les images qu'il prend par un chemin collé. | collage entre crochets, Entrée, PNG/JPEG/GIF/WebP |
| `interrupt_key`, `quit_key` | La touche qui interrompt un tour, et celle qui le ferme pour de bon, envoyée deux fois. | Échap, Ctrl+C |

Les textes de la vue nomment le harness de l'agent (« Vue {engine} », « {engine} s'est arrêté. ») ; avec Claude Code, ils sont ceux d'avant. Le réglage des nouveaux agents (« Vue des nouveaux agents » : « Escouade » ou « Terminal du harness ») est montré tant qu'un harness a une vue terminal ; un agent dont le harness n'en a pas reste dans la vue d'Escouade (`Core::create_agent_with`), et le passage est refusé (`set_agent_view`).

### `escouade-hook`

Codex et Copilot CLI lancent leurs hooks comme des commandes, pas en HTTP. `escouade-hook` (`src-tauri/src/bin/escouade-hook.rs`, la bibliothèque standard seule) lit l'événement sur son entrée et le poste au serveur de hooks d'Escouade comme le ferait un hook HTTP de Claude Code : à l'adresse de `ESCOUADE_HOOK_URL` (la boucle locale seulement), avec le jeton de `ESCOUADE_HOOK_TOKEN` en `Authorization: Bearer`. Sans jeton, il sort aussitôt sans rien lire ni envoyer : un hook déclaré dans un dossier que l'utilisateur partage avec ses propres sessions ne les touche pas. Il sort toujours avec le code 0 et n'écrit rien : le harness continue comme sans lui.

C'est un second binaire du crate : `tauri build` le construit et l'installe à côté de l'app (Windows : le dossier d'installation, l'installeur NSIS l'y copie et le désinstalleur l'enlève ; macOS : `Escouade.app/Contents/MacOS` ; Linux : `/usr/bin` du .deb et de l'AppImage), ce que la CI vérifie sur chaque paquet. `engine::terminal::hook_command()` le trouve à côté du programme de l'app (ou un dossier au-dessus, pour les tests). Ses tests : `tests/escouade_hook.rs` (le programme, avec et sans jeton) et `terminal_tests.rs` (posté au vrai serveur de hooks, l'agent suit).

## Le banc de conformité (ESC-35)

Une suite de scénarios commune que chaque moteur passe avec son faux moteur (`src-tauri/src/engine/bench/mod.rs`). Elle juge ce que la traduction du moteur fait de chaque scénario **dans la conversation de l'agent** (éléments normalisés, statut, demandes en attente, plan, `Effects`), jamais ses frames : la même suite vaut pour tous les protocoles.

Le banc pilote le moteur comme le cœur le fait, sans le cœur : `Engine::spawn` (avec `Spawn::of`, comme `Core::ensure_process`), `EngineProcess::initialize`, `Engine::message` puis `send_message` et `AgentRt::push_user` (comme `Core::deliver`), `AgentRt::answer_permission_by` et `answer_question_by` (comme la fenêtre), `interrupt` avec `AgentRt.interrupted` (comme `Core::interrupt`), `AgentRt::detach` puis `close_input` (l'arrêt d'un agent inactif). Chaque frame passe par `Engine::translate` du moteur essayé, pas par `engine::of` : un moteur se met sur le banc avant d'avoir sa ligne dans `engine::by_id`.

### Les scénarios

| Scénario | Ce que fait le banc | Ce qu'il vérifie | Demandé |
|---|---|---|---|
| `Text` | Un message ordinaire. | Un élément `text`, un `turn` sans erreur, `TurnEnd::Finished` avec le texte, statut `done`, une session. | toujours |
| `Thinking` | Un message qui fait raisonner. | Un élément `thinking` non vide, puis un `text`. | toujours |
| `Approval` | Une commande qui demande son approbation, autorisée. | Une demande en attente de type permission, une carte `permission` d'outil `Bash`, statut `waiting` ; après l'accord, la décision sur la carte, l'outil `Bash` en `ok`, le tour fini. | toujours |
| `Edit` | Une modification de fichier. | Un outil `Edit`, `Write` ou `MultiEdit` en `ok`, le fichier parmi `touchedFiles`, `Effects.files_changed`. | toujours |
| `Question` | Une question à l'utilisateur, répondue par son premier choix. | Une carte `question` (forme d'`AskUserQuestion` : `questions[].question`, `options[].label`) en attente ; ses réponses sur la carte, le tour fini. | toujours |
| `Interrupt` | Un tour long, interrompu. | `TurnEnd::Interrupted`, l'élément `turn` marqué `interrupted`. | toujours |
| `PlanMode` | La fin du mode plan, un plan à approuver. | Une permission d'outil `ExitPlanMode`, accordée, le tour fini. | si `caps.modes` a `plan` |
| `Subagents` | Un sous-agent lancé. | Un outil `Task` (ou `Agent`), une ligne dans `meta.plan.agents`, finie (`done`) au bout du tour. | toujours |
| `Limit` | Un tour arrêté par la limite d'usage. | `TurnEnd::Limited`, `Effects.limited`, l'élément `turn` marqué `limited`. | si `caps.quota` n'est pas `none` |
| `Resume` | Un tour, l'arrêt du process, un nouveau process, un tour. | `Start::of` donne `Resume` sur la session, et le second tour la garde. | toujours |
| `Fork` | Un tour, puis une copie (`fork_of` et `fork_at` de l'original, comme « Dupliquer la conversation »). | La copie a sa propre session, et `fork_of` est oublié dès son premier tour ; pour `fork: entry`, l'original a une `last_entry`. | si `caps.fork` n'est pas `none` |
| `Quota` | `EngineProcess::read_usage`. | Des fenêtres que `usage::parse_windows` lit. | si `caps.quota` n'est pas `none` |

Un scénario qui échoue dit le moteur, le scénario et la conversation entière ; un process qui ne dit plus rien le fait échouer au bout de 60 s.

### Brancher un moteur

Un moteur se branche par une `Target`, écrite à côté de lui (`engine/<moteur>/bench.rs`), et un test qui appelle `bench::run` : rien du banc ni du cœur ne change.

```rust
impl Target for Codex {
    fn engine(&self) -> &'static dyn Engine { &CODEX }
    fn program(&self) -> Program { /* tests/fixtures/fake-codex.cmd */ }
    fn env(&self, dir: &Path) -> Vec<(String, String)> { /* ex. CODEX_HOME dans dir */ }
    fn prompt(&self, s: Scenario) -> Option<String> { /* le message qui fait jouer s au faux */ }
}

#[tokio::test]
async fn the_fake_codex_passes_the_bench() {
    let played = run(&Codex, &bench_dir("bench-codex")).await;
    assert_eq!(played, Scenario::ALL);
}
```

`run` joue chaque scénario que ses capacités demandent (`Scenario::applies`), chacun dans son dossier, et rend ceux qu'il a joués : le test dit lesquels il attend. Un faux qui ne joue pas un scénario demandé (`prompt` rend `None`) fait échouer le banc.

- **Claude Code** : `engine/claude/bench.rs`, avec le faux `claude` (`tests/fixtures/fake-claude.mjs`, dont le message choisit le scénario ; « raisonnement » a été ajouté pour `Thinking`). Il joue les douze scénarios (`the_fake_claude_passes_the_bench`).
- **Le faux moteur minimal** : `engine/minimal/` et sa traduction `agent/minimal.rs`, pour les tests seulement. C'est le moins qu'un moteur écrive pour passer le banc : un `Engine` (ses méthodes que le banc n'appelle pas sont `unreachable!`), un process joué sur un fil de l'app dans un protocole à lui (`start`, `thinking`, `say`, `call`, `done`, `ask`, `question`, `end`), des outils à lui (`shell`, `patch`, `agent`) nommés comme ceux de Claude Code (`Bash`, `Edit`, `Task`). Ses capacités n'ont ni copie, ni quota, ni mode `plan` : il joue les huit autres scénarios (`the_minimal_fake_engine_plugs_into_the_bench_and_passes_what_its_capabilities_call_for`). Il s'est branché par ses deux déclarations de module (`engine/mod.rs`, `agent.rs`), comme tout moteur, sans une ligne du cœur ni du banc.

### Les flux enregistrés

Un flux réel enregistré se rejoue dans la traduction d'un moteur et se compare aux éléments attendus (`engine/bench/replay.rs`). Un cas est un fichier JSON de `tests/fixtures/replays/<moteur>/` :

```json
{
  "about": "Ce qui a été enregistré, avec quelle version, et ce que ça montre.",
  "flux": "../../real-run-send-message.jsonl",
  "agent": { "cwd": "C:\\Users\\dev\\repo" },
  "items": [{ "kind": "text", "parent": null, "streaming": false, "text": "LAUNCHED" }],
  "agentAfter": { "sessionId": "e172c854-…", "status": "done", "touchedFiles": [] }
}
```

- `flux` : le flux tel qu'il est venu, une frame (une valeur JSON) par ligne, chemin relatif au cas. Les enregistrements restent où ils sont (`tests/fixtures/real-run-*.jsonl`, `tests/fixtures/codex/`).
- `agent` (facultatif) : l'agent avant la première frame, par-dessus les valeurs d'un nouvel agent, comme son état est sauvé (`AgentMeta`, en camelCase).
- `items` : la conversation que font les frames, dans l'ordre, sans son `id` ni ses heures (`ts`, `startedAt`, `endedAt`, inventés à chaque rejeu). Un élément attendu n'est comparé que par ce qu'il dit : une clé qu'il omet n'est pas comparée (un objet en lui non plus ; une liste a sa longueur). Les nombres sont comparés à leur dernier bit près.
- `agentAfter` (facultatif) : l'agent après la dernière frame, comparé de même.

Un écart dit le cas, l'élément, le chemin de la clé, l'attendu et l'obtenu. `ESCOUADE_BLESS=1 cargo test --lib <test>` réécrit les cas d'après ce que font leurs frames (leurs `items`, et les clés de leur `agentAfter`, ou six d'entre elles s'il n'en a pas) au lieu de les comparer : le diff se relit avant d'être commité. Un test par moteur rejoue tous ses cas (`replay::check_all(&CLAUDE, "claude")`). Aujourd'hui : trois flux réels de Claude Code (sous-agent à qui l'on écrit, sous-agent arrêté, commande passée en arrière-plan) et un flux du faux moteur minimal, écrit à la main dans son protocole.

## Ajouter un moteur

À cocher dans l'ordre, dans le ticket du moteur. `<moteur>` est son id dans les données (`codex`), déjà dans `EngineId`.

### L'adaptateur

- [ ] `src-tauri/src/engine/<moteur>/mod.rs` : un `static` qui implémente `Engine` (sans état), déclaré dans `engine/mod.rs` (`mod <moteur>;`).
- [ ] `spawn` : lancer, reprendre et copier selon `Spawn.start` (`New`, `Resume`, `Fork`), avec le modèle, l'effort, le mode, les consignes ajoutées (`append_prompt`), les dossiers lisibles sans question (`read_dirs`) et le serveur MCP d'Escouade (`spawn.escouade`) ; un `Fork` refusé si le moteur ne copie pas.
- [ ] Un `EngineProcess` pour son process, dans le Job de l'agent (`job::Job::for_child`) : `initialize` (`Ready` : commandes `/`, modèles), `send_message`, `interrupt`, `set_model`, `set_effort`, `set_mode`, `answer_permission`, `answer_question`, `read_usage`, `rename`, `close_input`, `kill`, `wait_exit`, `wait_gone`. Ce qu'il ne sait pas faire (`stop_task`, `task_output`, `remote_control`) répond « non pris en charge ».
- [ ] Un transport qui n'est pas une ligne par message (en-têtes `Content-Length`, SSE) est lu dans le process, qui passe une `Value` par frame à `on_frame` ; les réponses à ses propres requêtes restent dans le process.
- [ ] `message` : la forme de son message, pièces jointes comprises, et le refus d'un fichier qu'il ne lit pas (`caps.images`, `caps.pdf`).
- [ ] `start_lost` : la session ou le point de copie perdus, lus dans son stderr.
- [ ] `one_shot` : `Weight::Light` (son modèle le plus rapide, sans outil) et `Weight::Reading` (outils de lecture seule), sans session, sans réglages de l'utilisateur ni serveur MCP.
- [ ] Sa ligne dans `engine::by_id`, et dans `registry::all()`.

### Les capacités et le registre

- [ ] `caps()` : ce qu'il sait faire, ni plus ni moins (`EngineCaps`, voir « Le registre ») ; chaque mode avec son sens chez lui (`ModeCap.meaning`). L'interface masque le reste.
- [ ] `models()`, `efforts()`, `supports_effort`, `supports_auto` : les menus du composer.
- [ ] `locate`, `version_args`, `tested()`, `oldest_reason`, `update_command`, `install()` : le trouver, le refuser trop ancien, l'installer.
- [ ] Le schéma de sa plus récente version testée dans `tests/fixtures/engines/<moteur>-<version>.schema.json`, et les deux tests qui le tiennent (champs lus par Escouade, champs des flux enregistrés).

### Le traducteur

- [ ] `src-tauri/src/agent/<moteur>.rs` (`mod <moteur>;` dans `agent.rs`) : `AgentRt::<moteur>_frame`, que `Engine::translate` appelle.
- [ ] Les éléments normalisés : `text`, `thinking`, `tool` (puis son résultat : `status` `ok` ou `error`, `result`), `permission` et `question` avec leur demande en attente (`add_pending`, statut `waiting`), `notice`, `event`, et le `turn` de fin de tour avec `Effects.turn_end` (`Finished`, `Interrupted`, `Limited`, `Error`), `Effects.limited` et `Effects.rate`.
- [ ] Les noms d'outils de Claude Code (`Bash`, `Edit`, `Write`, `Task`…, table de docs/TODO-1.8.md, « Un moteur par agent »), un outil MCP nommé par `mcp::tool_name`, un outil inconnu sous son propre nom ; un fichier modifié passé à `touch`.
- [ ] La session : `meta.session_id` dès qu'il la dit, `fork_of` et `fork_at` oubliés au premier tour d'une copie, `last_entry` (ou son équivalent) pour copier jusqu'au bon point.
- [ ] Le plan : sous-agents (`plan_tool_use`, `on_tool_result`), liste de tâches, fin de tour (`PlanState::end_turn`).
- [ ] L'inconnu toléré : un champ, une frame ou un événement inconnus sont ignorés sans casser le tour (un test, comme `an_unknown_field_or_frame_of_a_newer_claude_code_leaves_the_turn_going`).

### Le serveur MCP d'Escouade et les textes

- [ ] `grant_file`, `refusal`, `escouade_launch` : le serveur donné ou refusé, **jamais le jeton dans les arguments** (`no_engine_puts_the_token_on_the_command_line` le vérifie pour chaque moteur de `registry::all()`).
- [ ] `declared`, `add_declaration`, `remove_declaration`, `manual_declaration` : « <harness> peut piloter Escouade ».
- [ ] `speaker`, `instructions_room`, `subagent_relay` : comment les textes nomment ses agents, la place des consignes ajoutées, le message transmis à un sous-agent.

### Le faux moteur et le banc

- [ ] `tests/fixtures/fake-<moteur>.mjs`, avec son `.cmd` (Windows) et un script sans extension (macOS, Linux) : son vrai protocole, rejoué d'après ses flux enregistrés ; le message choisit le scénario, comme pour le faux `claude`.
- [ ] `src-tauri/src/engine/<moteur>/bench.rs` : sa `Target` et le test qui appelle `bench::run`, avec la liste des scénarios attendus ; le banc passe.
- [ ] Ses flux réels enregistrés (`tests/fixtures/<moteur>/`), un cas par flux dans `tests/fixtures/replays/<moteur>/` (béni, relu), et le test `replay::check_all(&<MOTEUR>, "<moteur>")`.
- [ ] S'il a une vue terminal (`caps.terminal_view`) : son interface factice, lancée dans un pseudo-terminal, qui écrit son journal et appelle ses hooks (lot 9).
- [ ] Les e2e : un agent sur ce moteur (message, approbation, diff, fin de tour), un ticket lancé dessus par le pilote auto.

### Les essais réels

- [ ] Un essai réel avant la release : un vrai compte, un ticket en worktree jusqu'au commit et au merge, un plan avec sous-agents, une limite d'usage si possible ; ses flux enregistrés (voir ci-dessus).
- [ ] La plage de versions testées mise à jour d'après l'essai (`tested()`).
- [ ] docs/PROTOCOL.md : sa section (versions testées, méthodes et événements utilisés, correspondance des modes et des outils) ; ce document : sa colonne dans les tables ; README (installation), CHANGELOG et site.

## Vérification de l'extraction (ESC-26)

Sans changement de comportement : `core_tests.rs`, `tickets_tests.rs` et les tests de `agent.rs` sont inchangés ; les autres fichiers de tests n'ont changé que par leurs imports (`crate::claude::…` devenu `crate::engine::…`). Les tests unitaires des arguments et des messages de Claude Code ont suivi leur code dans `engine/claude/mod.rs`, ceux du programme et de sa localisation dans `engine/program.rs` et `engine/claude/locate.rs`.
