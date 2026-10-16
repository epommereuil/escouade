# Fiabilité de la CI — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qu'un test instable ne bloque plus la CI ni une release, et corriger les causes des échecs intermittents relevés du 28 septembre au 13 octobre 2026 (23 runs de CI en échec sur 84 terminés).

**Architecture:** Deux couches. (1) Un filet dans la CI : cargo-nextest (un processus par test, délai par test, nouveaux essais signalés comme instables), e2e découplés des tests Rust, fixture e2e plus sûre. (2) Les causes, corrigées en TDD dans le code de l'app (beaucoup sont aussi de vrais défauts) : sorties de git qui ne dépendent plus de la fin du tube, descripteurs hérités sous macOS, port du serveur MCP, terminaux Windows, suppression d'un agent sous Windows, nommage d'un agent, tests de quota.

**Tech Stack:** Rust (tokio, std::process, portable-pty, windows-sys pour les Job Objects, libc sous Unix), cargo-nextest, GitHub Actions (`.github/workflows/ci.yml`), Playwright (`tests/e2e/fixture.ts`, `playwright.config.ts`), Vitest (`vitest.config.ts`).

**Spec:** l'analyse du 2026-10-13 (mémoire `ci-flakiness-2026-10`, rapports de trois sous-agents) tient lieu de spec ; elle est résumée tâche par tâche ci-dessous. Demande de l'utilisateur : « fais tout en mode économe » (lots 1, 2 et 3).

**Forme du plan :** comme en 1.6 et 1.7, les tâches donnent les exigences, les interfaces et les cas de test, sans le code complet. L'implémenteur lit le code cité, écrit d'abord les tests (rouge vérifié), puis le code.

## Global Constraints

- Mode économe : implémenteurs et relecteurs Sonnet, une relecture par paire de tâches, revue finale Opus ; pas de re-relecture pour les petites corrections.
- TDD : test rouge vérifié avant le code, pour chaque correction de cause.
- Tests Rust en local : `cargo test` (le `env -u CLAUDE_CODE_ENABLE_TODO_TOOLS` d’alors n’est plus nécessaire depuis ESC-111 : le harness retire la variable héritée) ; `cargo fmt --check` ; `cargo clippy --all-targets -- -D warnings`. Front : `npm test`, `npm run check`, `npm run format:check`.
- Commits atomiques sur main, messages en français au format du dépôt (`type(portée): ce qui change — pourquoi`), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pas de push avant la fin du lot 1 (la CI est le banc d'essai du lot 1).
- Rien ne change dans ce que l'app fait pour l'utilisateur, sauf les défauts corrigés (port MCP stable, terminaux qui meurent avec leur arbre, erreurs de git dites comme telles).
- Les messages d'erreur de l'app restent bilingues (`tr!`).
- `cargo test` doit continuer de passer en local : nextest est l'outil de la CI, pas une obligation pour le poste.

## Review Focus

- Un test qui comptait sur un verrou statique pour être sérialisé (`pty.rs:575` `SHELLS`, `isola.rs:37` `TEST_CLI`) tourne en parallèle sous nextest : chaque verrou de ce genre doit devenir un groupe de tests nextest à un seul fil.
- Une commande git qui sort beaucoup (un gros `diff`, `log`) doit tout rendre : le délai de grâce après la fin du processus ne doit couper que si le tube reste ouvert sans données.
- Le port MCP gardé vraiment pris par un autre programme : l'app attend au plus ~3 s avant d'en tirer un autre, pas indéfiniment.
- Un terminal dont le shell se termine de lui-même (`exit`) ne doit pas tuer les programmes que l'utilisateur a détachés ; seul « fermer le terminal » tue l'arbre.
- Une suppression d'agent dont l'arbre ne meurt pas : l'attente est bornée et le message dit ce qui bloque.

---

## Lot 1 — le filet de la CI

### Tâche 1 : cargo-nextest en CI (un processus par test, délai, nouveaux essais)

**Files:**
- Create: `src-tauri/.config/nextest.toml`
- Modify: `.github/workflows/ci.yml` (étapes « Rust tests » des trois jobs)
- Modify si besoin : tests qui supposent de tourner dans le même processus que d'autres

**Exigences :**
- Profil `ci` : `slow-timeout = { period = "60s", terminate-after = 3 }` (un test bloqué est tué au bout de 3 min et nommé), `retries = 2` (backoff fixe 1 s), `fail-fast = false`, sortie JUnit (`[profile.ci.junit] path = "junit.xml"`).
- Groupes de tests à un seul fil pour ce que des verrous statiques sérialisaient : `pty::windows_powershell_tests::*` et les tests qui prennent `SHELLS` (`pty.rs:575`), ceux qui écrivent `isola::TEST_CLI` (`isola.rs:37`). Auditer `grep -rn "static .*Mutex" src` et `set_var` (`shellenv.rs:22`) : tout état de processus partagé que des tests supposaient sérialisé.
- CI : installer nextest avec `taiki-e/install-action@v2` (`tool: cargo-nextest`) ; remplacer `cargo test` par `cargo nextest run --profile ci` dans les trois jobs. Garder l'extraction des échecs en annotation (`::error`), et ajouter une annotation `::warning title=Tests instables::` qui liste les tests passés au second ou troisième essai (lignes `FLAKY` de la sortie de nextest, ou `flakyFailure` du JUnit).
- macOS (3 vCPU) : `--test-threads 3`, le reste par défaut.
- Vérifier en local sous Windows : installer nextest (binaire précompilé : `curl -LsSf https://get.nexte.st/latest/windows-tar | tar zxf - -C ~/.cargo/bin`, ou `cargo install cargo-nextest --locked`), lancer `cargo nextest run --profile ci` (sans `env -u CLAUDE_CODE_ENABLE_TODO_TOOLS` depuis ESC-111) dans `src-tauri` : tout passe, et la durée totale est notée.

**Cas de test :** la suite entière sous nextest en local ; un test volontairement bloqué (`#[test] fn _probe() { loop {} }`, non commité) est tué et nommé au bout du délai.

- [ ] Écrire `.config/nextest.toml`, auditer les verrous statiques, lancer la suite sous nextest en local
- [ ] Brancher la CI, annotation des instables
- [ ] Commit `ci(tests): cargo-nextest — un processus par test, un test bloqué tué au bout de 3 min et nommé, deux nouveaux essais signalés comme instables`

### Tâche 2 : e2e découplés, fixture sûre, hygiène (lot 3 compris)

**Files:**
- Modify: `.github/workflows/ci.yml` (job Windows, job Linux ; déclencheur `workflow_dispatch`)
- Modify: `tests/e2e/fixture.ts`, `playwright.config.ts`
- Modify: `vitest.config.ts`
- Create: `scripts/ci-flakes.mjs` (+ son test `scripts/ci-flakes.test.mjs` si le dépôt teste ses scripts : voir `scripts/*.test.*`)

**Exigences :**
- Job Windows : la construction de l'app et les e2e tournent même si les tests Rust ont échoué (`if: ${{ !cancelled() }}`) ; le job reste en échec. Les traces Playwright sont envoyées dès qu'il y a un échec ou un nouvel essai (`if: ${{ !cancelled() }}` sur l'upload, `test-results/`).
- `workflow_dispatch` sur la CI, pour relancer à la demande et mesurer l'instabilité.
- Playwright : `retries: 2` en CI, `trace: 'on-first-retry'` (garder les traces des échecs).
- Fixture e2e (`tests/e2e/fixture.ts`) : avant de lancer l'app, attendre que le port DevTools (9222 en CI, `ESCOUADE_E2E_CDP_PORT`) refuse les connexions (l'instance précédente est morte), au plus 30 s ; après le démontage d'un test, même attente. Ainsi `connect()` ne s'attache jamais à l'instance mourante.
- Vitest : `testTimeout: 15_000` en CI seulement (`process.env.CI`).
- Job Linux : réserver la plage du serveur MCP hors de la plage éphémère (`sudo sysctl -w net.ipv4.ip_local_reserved_ports=47000-47999`) avant les tests.
- `scripts/ci-flakes.mjs [N]` : sur les N derniers runs de CI (défaut 50, via `gh run list` / `gh run view --log-failed`, comme `%TEMP%/esc-flaky/scan.cjs`), compte par test les échecs, les blocages (« running for over 60 seconds », « TIMEOUT » de nextest) et les instables (« FLAKY »), par système ; imprime un tableau trié. La logique d'analyse d'un log (pure) est séparée et testée sur des extraits de logs réels.

**Cas de test :** test du parseur de `ci-flakes` sur des lignes réelles (FAILED, HUNG, FLAKY, e2e « ✘ ») ; fixture : un test unitaire de l'attente de port si la fixture a des tests, sinon vérification par la CI.

- [ ] Workflow (e2e découplés, traces, workflow_dispatch, sysctl Linux)
- [ ] Fixture e2e et Playwright, Vitest
- [ ] `scripts/ci-flakes.mjs` + test
- [ ] Commit `ci(e2e): les e2e tournent même après un test Rust en échec, la fixture attend que l'instance précédente soit morte ; relevé des tests instables`

**Fin du lot 1 :** push de main, CI sur les trois systèmes ; vérifier dans les logs que nextest tourne, que les annotations sortent, que les e2e tournent. Corriger ce que la CI révèle (un groupe de tests manquant, etc.) avant le lot 2.

## Lot 2 — les causes

### Tâche 3 : git ne dépend plus de la fin de ses tubes, et a un délai maximal

**Cause :** sous macOS, std crée ses tubes avec `pipe()` puis `FIOCLEX` (pas de `pipe2`) ; un faux `claude` lancé au même moment (il vit jusqu'à la fin du test) hérite de l'écriture du tube de sortie de git ; `output()` attend une fin de tube qui ne vient jamais. Les tests pendent 45 min (cinq fois, dont la release 1.7.4). Aucune commande git locale n'a de délai (`git.rs:34-37`, `:70`).

**Files:**
- Create: `src-tauri/src/proc.rs` (déclaré dans `lib.rs`)
- Modify: `src-tauri/src/git.rs` (`run`, `run_english`, `run_net_command`), helpers git des tests (`core_tests.rs:47` `git()`, et tout `Command::new("git")` des tests : `grep -rn 'Command::new("git")' src`)

**Interfaces :**
- Produces: `pub async fn output_within(cmd: tokio::process::Command, limit: Duration) -> std::io::Result<std::process::Output>` dans `proc.rs` : lance la commande (stdout et stderr en tubes), lit les deux tubes dans des tâches qui accumulent dans un tampon partagé, attend la fin du processus ; après la fin, laisse aux lecteurs une grâce (`EOF_GRACE`, 2 s) pour atteindre la fin des tubes, puis rend ce qui a été lu (un tube resté ouvert par un héritier ne bloque plus). Au-delà de `limit`, tue le processus (`kill_on_drop`) et rend une erreur `TimedOut`. Constante `GIT_TIMEOUT = 120 s` dans `git.rs`.
- `run` et `run_english` passent par `output_within(cmd, GIT_TIMEOUT)` ; `run_net_command` garde ses délais et son Job, mais lit aussi avec la grâce.
- Les helpers git des tests (synchrones) écrivent stdout et stderr dans des fichiers temporaires plutôt que dans des tubes (un fichier n'attend pas de fin de tube).

**Cas de test (dans `proc.rs`) :**
- Une commande qui sort « out » puis laisse un petit-enfant tenir sa sortie 30 s (`sh -c 'echo out; sleep 30 & exit 0'` sous Unix ; sous Windows `cmd /c "echo out& start /b ping -n 30 127.0.0.1"`) : `output_within` rend « out » en moins de 10 s. Rouge vérifié avec `cmd.output()` à la place.
- Une commande qui dure plus que `limit` (limite de 1 s, `sleep 30` / `ping -n 30`) : erreur `TimedOut` en moins de 5 s.
- Une sortie de 5 Mo (boucle d'écriture) est rendue en entier.

- [ ] Tests rouges, `proc.rs`, `git.rs`, helpers des tests
- [ ] Commit `fix(git): une commande git ne dépend plus de la fin de ses tubes et s'arrête au bout de 120 s — sous macOS, un processus lancé au même moment pouvait hériter du tube et bloquer git sans fin`

### Tâche 4 : macOS — les processus longs n'héritent plus des descripteurs de l'app

**Cause :** même course que la tâche 3, vue du côté de l'héritier : `claude` (et un lancement de test) vit longtemps et garde ce dont il a hérité.

**Files:**
- Modify: `src-tauri/src/proc.rs` (helper), `src-tauri/src/claude.rs:47-62` (`ClaudeProcess::spawn`), `src-tauri/src/testlaunch.rs:374`

**Interfaces :**
- Produces: `pub fn no_inherited_fds(cmd: &mut tokio::process::Command)` dans `proc.rs` : sous Unix, un `pre_exec` qui marque `FD_CLOEXEC` (`libc::fcntl(fd, F_SETFD, FD_CLOEXEC)`) sur les descripteurs 3 à `getdtablesize()` (marquer plutôt que fermer : le tube d'erreur d'exec de std reste valable) ; ailleurs, rien. Appelé dans `ClaudeProcess::spawn` et au lancement d'un test (`testlaunch.rs:374`).

**Cas de test (Unix, `proc.rs`) :** créer un tube avec `libc::pipe` (sans CLOEXEC), lancer `sleep 5` avec `no_inherited_fds`, fermer notre extrémité d'écriture : la lecture voit la fin du tube tout de suite (< 1 s). Rouge vérifié sans le helper (la lecture attend la fin de `sleep`). Le test tourne sous Linux et macOS en CI.

- [ ] Test rouge, helper, appels
- [ ] Commit `fix(macos): claude et les lancements de test n'héritent plus des descripteurs ouverts de l'app — ils tenaient les tubes de git ouverts`

### Tâche 5 : le serveur MCP garde son port après un arrêt et une relance rapides

**Cause :** `bind()` (`mcp/mod.rs:524-541`) essaie le port gardé une seule fois, puis en tire un au hasard, que `sync_server` enregistre (`mod.rs:576-579`) : un arrêt suivi d'une relance rapide change le port, ce qui fait aussi re-déclarer le serveur dans chaque compte Claude (`claude mcp remove/add`). Échecs : `mcp::tests::a_stopped_server_refuses_connections…` (tests.rs:620), `the_server_starts_and_stops…`, `mcp::install_tests::turning_it_on_declares_the_server…` (install_tests.rs:536, 6 lancements de claude au lieu de 2).

**Files:**
- Modify: `src-tauri/src/mcp/mod.rs` (`bind`), `src-tauri/src/mcp/tests.rs`

**Interfaces :**
- `fn bind(port: u16) -> Result<(TcpListener, u16)>` devient `bind_within(port, BIND_RETRY)` avec `const BIND_RETRY: Duration = Duration::from_secs(3)` : sur `AddrInUse` (et `PermissionDenied` sous Windows, que renvoie un port tout juste libéré), réessaie le port gardé toutes les 25 ms jusqu'à `BIND_RETRY`, puis tire un autre port comme avant. Un `log::warn!` dit l'erreur et le port tiré.

**Cas de test :** (1) un écouteur tient le port X, un thread le libère au bout de 300 ms : `bind_within(X, 3 s)` rend X. (2) l'écouteur ne le libère jamais : `bind_within(X, 200 ms)` rend un autre port de `PORTS` en moins de 1 s. (3) les tests `a_stopped_server…` et `install_tests` passent 20 fois de suite en local (`cargo test … -- --test-threads 8`, boucle shell).

- [ ] Tests rouges, `bind_within`
- [ ] Commit `fix(mcp): le serveur reprend son port après un arrêt et une relance rapides au lieu d'en tirer un autre — il n'est plus re-déclaré dans chaque compte Claude`

### Tâche 6 : Windows — fermer un terminal tue tout ce qu'il a lancé

**Cause :** les terminaux interactifs n'ont pas de Job Object (`pty.rs:417-420`, `job: command.is_some()`), et `kill` (`pty.rs:524-531`) ne fait que `TerminateProcess` sur le shell ; le `ping` lancé dedans dépend de la fermeture asynchrone de la pseudo-console (~5 s, le budget du test `closing_a_terminal_kills_the_programs_it_started`, `pty.rs:735-740`).

**Files:**
- Modify: `src-tauri/src/job.rs` (Windows : `Job::release`), `src-tauri/src/pty.rs` (`spawn_inner`, `kill`, fil de fin du shell, test)

**Interfaces :**
- Produces: `Job::release(&self)` (Windows : retire `KILL_ON_JOB_CLOSE` par `SetInformationJobObject`, de sorte que lâcher le Job ne tue plus rien ; Unix et autres : rien).
- Tout terminal a un Job (`job: true`). `kill` appelle `job.terminate()` puis `killer.kill()`. Quand le shell se termine de lui-même, le fil qui le voit appelle `job.release()` avant de lâcher le terminal : les programmes détachés par l'utilisateur survivent à un `exit`.
- Réponse à la demande de position du curseur (`\x1b[6n`) : garder les 3 derniers octets d'une lecture pour reconnaître une demande coupée entre deux lectures (`pty.rs:321-327`, et les copies `:703`, `:1224`).

**Cas de test :** le test existant, avec un budget de 20 s et une vérification de vie par `OpenProcess` + `WaitForSingleObject(handle, 0)` au lieu de `tasklist` ; nouveau : un terminal dont le shell fait `start /b ping -n 30 127.0.0.1` puis `exit` → le ping vit encore 2 s après la fin du shell (puis le test le tue). Demande de curseur coupée : test unitaire du détecteur sur `["\x1b[", "6n"]`.

- [ ] Tests rouges, Job des terminaux, détecteur de demande coupée
- [ ] Commit `fix(terminaux): sous Windows, fermer un terminal tue tout ce qu'il a lancé, un exit laisse vivre ce qui a été détaché`

### Tâche 7 : Windows — supprimer un agent attend que ses processus soient morts

**Cause :** `delete_agent` tue l'agent puis attend 300 ms fixes (`core.rs:3852`) avant de supprimer le worktree ; l'arbre `cmd` → `node` du faux claude (dossier courant : le worktree) vit parfois plus longtemps que les 5 s de `remove_dir_retrying` (`git.rs:994-1008`) : « os error 32 ». Échec : `branches_tests::deleting_the_agent_of_an_existing_branch_removes_its_worktree_and_keeps_the_branch` (deux fois en CI, une fois en release).

**Files:**
- Modify: `src-tauri/src/claude.rs` (`ClaudeProcess`), `src-tauri/src/core.rs` (`delete_agent`), `src-tauri/src/git.rs` (`REMOVE_RETRY`)

**Interfaces :**
- Produces: `pub async fn wait_gone(&self, within: Duration) -> bool` sur `ClaudeProcess` : `wait_exit(within)` puis, sous Windows, attend que le Job n'ait plus de processus actifs (`job.usage().processes == 0`), le tout borné par `within`.
- `delete_agent` garde le processus tué et appelle `wait_gone(15 s)` à la place du sommeil de 300 ms ; s'il est encore vivant, la suite continue (le nettoyage dit son échec comme aujourd'hui). `REMOVE_RETRY` passe de 5 à 15 s.

**Cas de test :** un agent dont le tour lance un sous-processus qui dure (le faux claude sait-il lancer un enfant ? voir `tests/fixtures/fake-claude.mjs` ; sinon ajouter une directive de test comme `[child]`), supprimé avec son worktree : le dossier est parti et aucune alerte n'est levée. Le test `branches_tests::deleting_the_agent…` passe 20 fois de suite.

- [ ] Test rouge, `wait_gone`, `delete_agent`
- [ ] Commit `fix(agents): supprimer un agent attend que ses processus soient morts avant d'effacer son worktree`

### Tâche 8 : le nom d'un agent et les erreurs de git dites comme telles

**Cause :** `apply_generated_name` met `named = true` (`core.rs:3670`) avant de renommer la branche du worktree (`core.rs:3676-3686`) ; un commit proposé pendant le renommage voit `git status` échouer, et `git_files` avale l'erreur (`core.rs:4431`, `unwrap_or_default`) : l'utilisateur lit « Plus rien à commiter » au lieu de l'erreur. Échec : `core_tests::an_agent_on_a_second_account_runs_with_its_folder_and_one_on_principal_without` (core_tests.rs:5366).

**Files:**
- Modify: `src-tauri/src/core.rs` (`apply_generated_name`, `git_files` ou son appel dans `commit_propose`/`commit_scope`), `src-tauri/src/core_tests.rs`

**Exigences :**
- `named` et l'événement qui le dit ne passent à vrai qu'après le renommage de la branche (réussi ou non).
- Pour un commit (aperçu, proposition, commit direct), une erreur de `git status` remonte telle quelle ; l'affichage des fichiers (panneau) peut garder sa liste vide.
- Le test `an_agent_on_a_second_account…` attend la fin du renommage (branche changée) avant d'écrire son fichier.

**Cas de test :** (1) une proposition de commit sur un worktree dont `.git` est cassé (fichier `.git` du worktree remplacé par un contenu invalide) rend l'erreur de git, pas « Plus rien à commiter » ; (2) après `named`, la branche du worktree est déjà la nouvelle.

- [ ] Tests rouges, ordre du renommage, erreur remontée
- [ ] Commit `fix(git): une erreur de git n'est plus dite « Plus rien à commiter », et un agent n'est dit nommé qu'une fois sa branche renommée`

### Tâche 9 : les tests de quota et de temps ne dépendent plus de l'ordre ni de l'horloge

**Causes :**
- Le faux CLI envoie un `rate_limit_event` (12 % / 34 %) juste après chaque `result` (`tests/fixtures/fake-claude.mjs:469`) ; `agent_that_worked` (`tickets_tests.rs:162`) rend la main dès que l'agent est terminé, et l'événement tardif écrase le quota que le test injecte ensuite (`usage.rs:404`). Échec : `tickets_tests::nothing_starts_while_a_window_is_used_past_the_threshold_until_it_reads_under_it` (tickets_tests.rs:1358).
- Fenêtres de 60 s à l'horloge réelle (`tickets_tests.rs:1398`, `:1414`) contre une marge de reprise de 30 s (`core.rs:392`) ; pause de 30 min avec 1 min de marge (`:1324-1327`). Échec : `a_window_past_the_threshold_holds_nothing_back_once_it_ends`.
- `job::tests::tells_the_cpu_time_and_memory_of_its_processes` (`job.rs:326-341`) : le script s'arrête sur son propre temps CPU alors que le test lit celui du Job.

**Files:**
- Modify: `src-tauri/src/tickets_tests.rs`, `src-tauri/src/job.rs` (test)

**Exigences :**
- `agent_that_worked` attend aussi que le quota du compte ait été lu (`five_hour` de Principal présent) ; idem avant chaque `record_usage` qui suit un tour (une vingtaine d'appels : les passer par un helper qui attend).
- Fenêtres d'une heure et sauts d'horloge par `clock_ahead` (`3_601_000`, puis `3_600_000 + RESUME_MARGIN_MS + 1_000`) ; la pause de 30 min reçoit une marge confortable.
- Test du Job : le script tourne sans fin (`while($true){}`) et meurt avec le Job à la fin du test.

**Cas de test :** les tests touchés passent 20 fois de suite en local sous charge (`cargo test … -- --test-threads 16`).

- [ ] Helpers d'attente, marges, test du Job
- [ ] Commit `test(board): les tests de quota attendent le quota du faux CLI et ne dépendent plus d'une marge d'horloge de 30 s`

## Fin du chantier

- [ ] Revue finale Opus de tout le chantier (diff depuis le début du lot 1)
- [ ] Push de main ; CI verte sur les trois systèmes ; relancer la CI trois fois par `workflow_dispatch` et relever avec `scripts/ci-flakes.mjs` ce qui reste instable
- [ ] Mettre à jour `docs/TODO-1.8.md` (le blocage macOS noté là passe en fait, avec ce qui reste) et le CHANGELOG (section « Non publié » : port MCP stable, terminaux Windows, erreurs de git)
