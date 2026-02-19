#!/usr/bin/env bash

set -eu
shopt -s nullglob

# SOURCE_DIR — откуда копировать
# DEST_DIR   — куда копировать
# INCLUDES   — паттерны включения через пробел (обязательно)
# EXCLUDES   — паттерны исключений через пробел (опционально)

[[ -n "${SOURCE_DIR:-}" ]] || { echo "[ERROR] Environment variable SOURCE_DIR not set or empty" ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ -n "${INCLUDES:-}" ]] || { echo "[ERROR] Environment variable INCLUDES not set or empty" ; exit 1 ; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

echo -e "\e[1m[COPY] From \"${SOURCE_DIR}/\" to \"${DEST_DIR}/\"\e[0m"

[[ -d "${SOURCE_DIR}" ]] || { echo "[ERROR] SOURCE_DIR \"${SOURCE_DIR}\" is not a directory or does not exist" ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR \"${DEST_DIR}\" is not a directory or does not exist" ; exit 1 ; }


# Сборка include-аргументов
include_args=()
echo ' - [INCLUDES]:'
read -ra patterns <<< "$INCLUDES"
for pattern in "${patterns[@]}"; do
    echo "   - ${pattern}"
    include_args+=(--include="$pattern")
done

# Сборка exclude-аргументов
exclude_args=()
if [[ -n "${EXCLUDES:-}" ]]; then
    echo ' - [EXCLUDES]:'
    read -ra patterns <<< "$EXCLUDES"
    for pattern in "${patterns[@]}"; do
        echo "   - ${pattern}"
        exclude_args+=(--exclude="$pattern")
    done
fi

rsync -am "${exclude_args[@]}" "${include_args[@]}" --exclude='*' "${SOURCE_DIR}/" "${DEST_DIR}/" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Copying failed\e[0m\n' ; exit $rc ;}

echo -e '\n\e[32;1m[DONE] Copying complete\e[0m\n'
