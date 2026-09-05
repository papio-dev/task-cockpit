#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(dirname "$(realpath "$0")")

TARGET_W=1280
TARGET_H=720
OUTPUT="${SCRIPT_DIR}/~vscode-screenshot.png"

# Find VS Code window
eval "$(xdotool search --shell --name "Task Cockpit Demo")"

# Проверяем, что массив существует и содержит ровно один элемент
if [[ ${#WINDOWS[@]} -ne 1 ]]; then
    echo "Найдено ${#WINDOWS[@]} окон (ожидалось ровно 1)"
    exit 1
fi

readonly WID=${WINDOWS[0]}
echo "Найдено ровно одно окно, его ID: ${WINDOWS[0]}"

xdotool windowsize --sync "$WID" "$TARGET_W" "$TARGET_H"
xdotool windowactivate --sync "$WID"

# Скриншот активного окна
gnome-screenshot --window --include-pointer --delay=5 --file="${OUTPUT}"
composite -gravity NorthWest "${SCRIPT_DIR}/-vscode-frame.png" "${OUTPUT}" "${OUTPUT}"

exit 0
