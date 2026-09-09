# VS Code Task Label Collision: Resolution Behavior

> Source references: [microsoft/vscode](https://github.com/microsoft/vscode), `main` branch (`taskConfiguration.ts`, `abstractTaskService.ts`).

---

## Terminology

**Origin** — logical source of a task definition: `User`, `Workspace`, or `Folder`.

**Execution scope** — what `vscode.Task.scope` describes: the context in which a runtime task executes. Unrelated to Origin. `TaskScope.Global` exists in the API enum but is documented as unsupported and is never assigned in practice. User and Workspace origin tasks have `task.scope` = `TaskScope.Workspace` — not `TaskScope.Global`. Mapping scope values to Origins is unreliable.

**Primary Workspace Folder** — `workspaceFolders[0]`: the first (or only) folder in the workspace. VS Code uses it as a synthetic context when parsing User and Workspace task definitions. This gives it distinct resolution behavior compared to other folders.

**Non-primary folders** — all workspace folders with index ≥ 1. Resolution behavior is uniform across all of them.

**DirectRunResolution** — resolution mode when a user explicitly runs a task (e.g., via the task picker).

**DependencyResolution** — resolution mode when a task is launched as a dependency via `dependsOn`.

---

## Task Origins

| Origin | Definition location |
|---|---|
| **User** | User profile task source file |
| **Workspace** | `.code-workspace` file, `tasks` section |
| **Folder** | Folder-level `.vscode/tasks.json` |

In a multi-root workspace, the Folder origin covers both the Primary Workspace Folder and all non-primary folders. Their resolution behavior differs.

---

## DirectRunResolution

When a task is selected from the task picker, VS Code does **not** execute the specific definition that was selected. The runtime task is re-resolved before execution.

**Mechanism:** `saveBeforeRun` defaults to `"always"`, which causes `_executeTask` to call `_updateWorkspaceTasks()` followed by `getTask(task.getWorkspaceFolder(), identifier)`. For User, Workspace, and Primary Workspace Folder task definitions, `task.getWorkspaceFolder()` returns the Primary Workspace Folder (all three are parsed with it as their workspace folder context). All three end up in the same `matchedTasks` candidate set and compete under Cross-Origin Resolution Order.

### Cross-Origin Resolution Order: User › Workspace › Primary Workspace Folder

Applies when the selected task belongs to the User, Workspace, or Primary Workspace Folder origin. The label shown in the picker — e.g., `My Task (project.code-workspace)` — does not determine which definition executes.

| Picker entry  | User has `My Task` | Workspace has `My Task` | Primary folder has `My Task` | Executes |
|---------------|--------------------|-------------------------|------------------------------|----------|
| Any of: U/W/P | ✓                  | any                     | any                          | **U**    |
| Any of: U/W/P | ✗                  | ✓                       | any                          | **W**    |
| Any of: U/W/P | ✗                  | ✗                       | ✓                            | **P**    |

`U` = User, `W` = Workspace, `P` = Primary Workspace Folder

**Implementation note:** The ordering `User > Workspace > Primary Workspace Folder` results from a sort comparator `task => -1` in `abstractTaskService.ts:970–978`. The comparator takes one argument instead of the expected two `(a, b)`, causing insertion sort to reverse the candidate array. Whether this is intentional is not documented.

### Strict Origin Resolution: non-primary folders

Non-primary folders always execute their own local task definition. User and Workspace definitions with the same label are not considered. If no local definition exists, no picker entry is shown for that folder.

### Summary Table — DirectRunResolution

~~~
 My Task defined in   | Clicked entry → executes
                      | User    Workspace  Primary  folder2
----------------------|-------- ---------- -------- --------
 U + W + P + NP       |  U         U         U       NP
 U + W                |  U         U         —        —
 U + P + NP           |  U         —         U       NP
 U only               |  U         —         —        —
 W + P + NP           |  —         W         W       NP
 W only               |  —         W         —        —
 P + NP               |  —         —         P       NP
~~~

`—` = no picker entry for that origin (no definition exists there).
`U` = User, `W` = Workspace, `P` = Primary Workspace Folder, `NP` = non Primary Folder.

---

## DependencyResolution

The resolution scope for a `dependsOn` entry is determined by the **origin of the parent task definition**.

### Per-Origin Rules

| Parent origin          | Strategy             | Search scope               |
|------------------------|----------------------|----------------------------|
| **U**                  | Strict               | User only                  |
| **W**                  | Strict               | Workspace only             |
| **NP**                 | Strict               | That folder only           |
| **P**                  | Cascading (Fallback) | Primary → Workspace → User |

If no match is found within the allowed scope: `Couldn't resolve dependent task '<label>' in workspace folder '<uri>'`.

### Why the Primary Workspace Folder Has Cascading Resolution

User and Workspace task definitions are parsed with `workspaceFolder = _getAFolder() = workspaceFolders[0]` (Primary Workspace Folder). As a result, `_source.config.workspaceFolder` for User, Workspace, and Primary Workspace Folder definitions all point to the same URI.

When the Primary Workspace Folder's `dependsOn` resolves via `quickResolve(primary_folder_uri, identifier)`, it matches all task definitions where `_source.config.workspaceFolder.uri === primary_folder_uri` — which includes definitions from all three origins. `_findWorkspaceTasks` iterates in insertion order (`folder1 → folder2 → workspace_config → USER_TASKS_GROUP_KEY`) and returns the first match, yielding the effective cascade: **Primary → Workspace → User**.

This is a consequence of VS Code using the Primary Workspace Folder as a synthetic context for origins that lack their own workspace folder — not an intentional fallback design.

### Summary Table — DependencyResolution

~~~
 My Task defined in   | Parent origin → resolves to
                      | User    Workspace  Primary  folder2
----------------------|-------- ---------- -------- --------
 U + W + P + NP       |  U         W         P       NP
 U + W                |  U         W         W       err
 U + P + NP           |  U        err        P       NP
 U only               |  U        err        U       err
 W + P + NP           | err        W         P       NP
 W only               | err        W         W       err
 P + NP               | err       err        P       NP
~~~

`err` = `Couldn't resolve dependent task 'My Task' in workspace folder '<uri>'`

---

## Label Collision Within a Single Origin

When multiple task definitions share the same `label` within a single task source file:

| Resolution mode      | Effective definition               |
|----------------------|------------------------------------|
| DirectRunResolution  | **Last** definition in file order  |
| DependencyResolution | **First** definition in file order |

This behavior is consistent regardless of which origin the file belongs to. The asymmetry indicates that the two resolution modes follow separate code paths.

---

## `dependsOn` Addressing Limitations

`dependsOn` accepts only `string | string[]`. There is no syntax for targeting a task definition by origin.

The object form — `{ type: "...", ... }` — is an `ITaskIdentifier`: a structural matcher against a task's `definition` block. It identifies tasks by type and properties (*what* a task is), not by origin (*where* it is defined). It cannot express "task `build` from `folder3`".

---

## Source References

| Behavior | File | Lines | Mechanism |
|---|---|---|---|
| Strict Origin Resolution for `dependsOn` | `taskConfiguration.ts` | 1325–1330 | `uriFromSource()` encodes the dependency search URI at parse time |
| Primary Workspace Folder = `workspaceFolders[0]` | `abstractTaskService.ts` | 2579–2586 | `_getAFolder()` unconditionally returns the first folder |
| Cascading Resolution for Primary Workspace Folder | `abstractTaskService.ts` | 1971–1993 | `quickResolve()` matches by `_source.config.workspaceFolder` URI |
| Re-resolution on direct run | `abstractTaskService.ts` | 2075–2087 | `saveBeforeRun=always` triggers `getTask(primary_folder_uri, identifier)` |
| Cross-Origin Resolution Order | `abstractTaskService.ts` | 970–978 | Incorrect sort comparator (1 arg instead of 2) reverses `matchedTasks` |
