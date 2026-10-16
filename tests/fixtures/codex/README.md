# Flux réels de Codex 0.163.0 (ESC-22)

Enregistrés le 2026-10-16 sous Windows 11, avec le binaire natif `codex.exe` du paquet npm `@openai/codex@0.163.0`, un compte ChatGPT (offre gratuite) et le modèle `gpt-6-luna`. Réponses et conséquences : `docs/TODO-1.8.md`, point 0, « Codex ».

Anonymisés : adresse, identifiants du compte et de l'installation, nom de la machine, chemins (`C:\Users\user\AppData\Local\Temp\essai\proj`, un dépôt jetable avec ses worktrees dans `.claude/worktrees/agent1` et `agent2`).

## Flux de l'app-server

Une ligne par message JSON-RPC, dans l'ordre : `{"dir": "c2s" | "s2c", "t": <ms depuis le lancement>, "msg": {…}}`. `c2s` va du client (l'essai, à la place d'Escouade) vers `codex app-server`, `s2c` dans l'autre sens. Un fichier peut contenir plusieurs process : chaque `initialize` en ouvre un, et les `id` repartent à 1.

| Fichier | Contenu |
|---|---|
| `account.jsonl` | `account/read`, `account/rateLimits/read` sans tour (fenêtre de 43 200 min de l'offre gratuite), `model/list`, `collaborationMode/list` |
| `full-turn.jsonl` | `-c tools.update_plan.enabled=true`, `developerInstructions`, `workspace-write` + `writable_roots` sur `.git`. Un tour : texte, raisonnement (deltas et résumés), `turn/plan/updated`, `fileChange`, `git add` refusé par le bac à sable puis redemandé (`item/commandExecution/requestApproval`, accepté), commit, réseau refusé puis accepté, sous-agent (`subAgentActivity`, son propre `turn/started`/`turn/completed` sur un autre `threadId`, `collabAgentToolCall` `wait`). Puis un tour interrompu (`turn/interrupt` pendant une commande), une compaction (`thread/compact/start`) et `thread/fork` refusé (éphémère sans `excludeTurns`) |
| `resume.jsonl` | `thread/resume` sans redonner `developerInstructions` : la consigne vaut toujours |
| `plan-mode.jsonl` | `collaborationMode: plan` (expérimental) : `item/tool/requestUserInput` (options, « Autre »), réponse, élément `plan` |
| `failed-turn.jsonl` | tour en échec (`status: failed`, `codexErrorInfo: other`) : modèle refusé avec un compte ChatGPT |
| `hooks-appserver.jsonl` | hooks déclarés par `-c hooks.*` et approuvés par `-c hooks.state=…` : `hook/started`, `hook/completed` |

## Vue terminal

| Fichier | Contenu |
|---|---|
| `hooks-payloads.jsonl` | `{"event", "payload"}` : ce que reçoit la commande d'un hook sur son entrée (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`), relevé pendant le tour de `hooks-appserver.jsonl` (fil éphémère, d'où `transcript_path: null`). L'interface envoie les mêmes événements, plus `Interrupt` sur Échap |
| `tui-rollout.jsonl` | le `rollout-*.jsonl` d'un fil créé par l'app-server puis repris par `codex resume <id>` : un tour fini (app-server), un tour interrompu par Échap (interface). Les consignes propres au compte de l'essai sont remplacées par un repère |
