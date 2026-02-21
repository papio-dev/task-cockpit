# Multiroot-HappyPath

Test fixture for multi-root workspace scenarios.

## Purpose

Happy path testing: valid tasks.json files across multiple workspace folders.

## Structure

- **frontend** — 5 tasks (build, test, lint)
- **backend** — 6 tasks (build, server, db)
- **shared** — 4 tasks (types, utils)

## Coverage

- Multi-root workspace detection
- Per-folder task discovery
- Duplicate labels across folders (Build, Test)
- Task dependencies (dependsOn)
- Background tasks (isBackground)
- Task icons and details
