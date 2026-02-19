#!/usr/bin/env bash

set -eu

# DEST_DIR — целевая директория для выходного package.json

echo -e "\e[1m[PKG] Preparing package.json ...\e[0m"

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: not a directory or does not exist" ; exit 1 ; }

CODICONS_MAP_JSON='node_modules/@vscode/codicons/src/template/mapping.json'

# Версия из последнего git тега (Vn.n.n -> n.n.n)
VERSION=$(git tag -l 'v[0-9]*' --sort=-committerdate | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 | sed 's/^v//')
[[ -z "${VERSION}" ]] && { echo 'ERROR: No version tag found (expected Vn.n.n format)' ; exit 1  ; }

# Иконки из mapping.json: извлекаем все имена из всех массивов,
# убираем дубликаты,
# исключаем folder
# и сортируем
ICONS=$(jq '[.[] | .[]] | unique - ["folder"]' "${CODICONS_MAP_JSON}")
ICONS_COUNT=$(echo "${ICONS}" | jq 'length')

jq --arg ver "${VERSION}" --argjson icons "${ICONS}" '
  del(.scripts, .devDependencies) |
  .main = "extension.js" |
  .version = $ver |
  (.contributes.commands) |= map(select(.command != "task-cockpit.DEBUG")) |
  (.contributes.configuration[] | select(.title == "Display") | .properties["taskCockpit.display.defaultIconName"].enum) = $icons |
  (.contributes.configuration[] | select(.title == "Display") | .properties["taskCockpit.display.defaultIconName"].markdownEnumDescriptions) = ($icons | map("$(\(.))")) |
  walk(if type == "object" and (.icon | type) == "string" then .icon |= sub("^icons/"; "") else . end)
' package.json > "${DEST_DIR}/package.json"

echo ' - removed: .scripts, .devDependencies'
echo ' - set .main: "extension.js"'
echo " - set .version: \"${VERSION}\""
echo ' - removed: command "task-cockpit.DEBUG"'
echo " - set .contributes.configuration[Display].properties[\"taskCockpit.display.defaultIconName\"].enum: ${ICONS_COUNT} icon names"
echo ' - added icon preview descriptions'
echo ' - normalized .icon fields: removed "icons/" prefix'

echo -e "\n\e[32;1m[Done] Saved at \"${DEST_DIR}/package.json\"\e[0m\n"
