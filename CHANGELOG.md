# Changelog

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
