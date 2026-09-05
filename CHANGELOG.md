# Changelog

## [1.2.0] - 2026-??-??

> ⚠️ This release contains breaking changes.
> Several setting keys and command IDs have been renamed or removed —
> check your `settings.json` and `keybindings.json` if you customized these.

### Added
- **Global Tasks view** — new panel showing user-scope tasks;
  can be hidden via `taskCockpit.filtering.showUserLevelTasks`
- `taskCockpit.filtering.excludeFolders` now accepts the workspace scope name
  (e.g. `"my-project (Workspace)"`) to exclude workspace-level tasks from the tree
- Warning indicator on tasks whose definition cannot be matched at runtime

### Changed
- `taskCockpit.diagnostics.unreachableDependencies` is now enabled by default
  (previously experimental and opt-in)
- When folders are excluded, the panel header now shows a visibility counter
  (e.g. `3/5 folders`), replacing the tooltip on the workspace item
- `taskCockpit.filtering.excludeFolders` now takes effect in single-folder workspaces
- Replaced the Task Cockpit panel icon
- Various UI and UX improvements

### Renamed ⚠️
- Setting `taskCockpit.display.useGroupKind` → `taskCockpit.display.groupByTaskGroup`
- Settings namespace `taskCockpit.validation.*` → `taskCockpit.diagnostics.*`
  - `validation.duplicateLabels` → `diagnostics.shadowedTasks`
  - `validation.dependencies` → `diagnostics.unreachableDependencies`
- Command IDs follow a new view-scoped naming convention; e.g.
  `task-cockpit.view.refresh` → `task-cockpit.full-refresh`,
  `task-cockpit.tasks-file.open-task` → `task-cockpit_project-tasks.task-go-to-definition`

### Removed
- `taskCockpit.filtering.excludeWorkspaceTasks` — deprecated since 1.1.0;
  use `taskCockpit.filtering.excludeFolders` instead

### Fixed
- Cursor is now placed at the start of the task definition when jumping to it

### Known Issues
- Tasks list may show stale data when the user-scope `tasks.json` has unsaved
  changes at the moment a task is launched — this appears to be a VS Code
  limitation (VS Code's own task list exhibits the same behavior)


## [1.1.1] - 2026-06-15

### Added

- "Collapse All"/"Expand All" button in the Task Explorer panel (issue #6)
- "Find Task" button — quick search and filtering in the task tree (list.find)

## [1.1.0] - 2025-03-20

### Changes

- Help page now opens documentation matching the installed extension version
- `excludeWorkspaceTasks` setting is deprecated and will be removed in a future version

## [1.0.0] - 2025-02-23

### Initial public release

- Hierarchical tree view for tasks from `.vscode/tasks.json`
- Label-based hierarchy via configurable segment separator
- Grouping by `group` property (`useGroupKind`)
- Task icons with custom id/color support, color propagation to labels
- Running task status badges
- Filtering: exclude folders, workspace-scope tasks, individual tasks (`hide`)
- Context menu: run, abort, show terminal, jump to definition
- Open or create task files from panel
- Validation: duplicate label detection
- Validation: missing `dependsOn` references (experimental)
- Markdown tooltips via `detail` field
- Keyboard shortcut support: commands operate on the selected tree item
- Task order preserved from file definition (no automatic sorting)
