#!/usr/bin/env bash

set -eu

# Скрипт сканирует test-fixtures/, и для каждой поддиректории создаёт launch-конфигурацию.
# Это избавляет от ручного редактирования launch.json при добавлении/удалении тестовых фикстур.

FIXTURES_DIR='test-fixtures'
LAUNCH_FILE='.vscode/launch.json'

echo '[DEV] Generate launch.json ...'

# Базовая конфигурация
base_config='[{
    "name": "Run Extension",
    "type": "extensionHost",
    "request": "launch",
    "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--profile=Clean",
        "--locale=en"
    ],
    "outFiles": ["${workspaceFolder}/~out/**/*.js"],
    "preLaunchTask": "${defaultBuildTask}",
    "env": {
        "USER_TASK_DEBUG": "true",
        "USER_TASK_CONSOLE_LOG": "true"
    }
}]'

# Собираем фикстуры: has_workspace = true если есть {name}.code-workspace
fixtures='[]'
for dir in "$FIXTURES_DIR"/*/; do
    name=$(basename "$dir")
    has_ws=$([[ -f "$dir$name.code-workspace" ]] && echo true || echo false)
    fixtures=$(echo "$fixtures" | jq --arg n "$name" --argjson ws "$has_ws" '. + [{name: $n, has_workspace: $ws}]')
done

jq -n --argjson base "$base_config" --argjson fixtures "$fixtures" '
{
    version: "0.2.0",
    configurations: ($base + ($fixtures | map(
        (if .has_workspace then "\(.name)/\(.name).code-workspace" else .name end) as $target |
        {
            name: "Run Extension (\(.name))",
            type: "extensionHost",
            request: "launch",
            args: [
                "${workspaceFolder}/test-fixtures/\($target)",
                "--extensionDevelopmentPath=${workspaceFolder}",
                "--profile=Clean",
                "--locale=en"
            ],
            cwd: "${workspaceFolder}/test-fixtures/\(.name)",
            outFiles: ["${workspaceFolder}/~out/**/*.js"],
            env: {
                "USER_TASK_DEBUG": "true",
                "USER_TASK_CONSOLE_LOG": "true"
            },
            preLaunchTask: "${defaultBuildTask}"
        }
    )))
}' > "$LAUNCH_FILE"

echo -e "\n[DONE] Generated: $(jq '.configurations | length' "$LAUNCH_FILE") configs\n"
