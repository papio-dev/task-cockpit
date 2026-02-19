#!/usr/bin/env bash

set -eu

# DEST_DIR — целевая директория для create

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: \"${DEST_DIR}\" exists and not a directory" ; exit 1 ; }
[[ "$(basename "${DEST_DIR}")" == ~* ]] || { echo "[ERROR] Directory name must start with ~: \"${DEST_DIR}\"" ; exit 1 ; }

echo -e "\e[1m[CREATE] Create empty directory \"${DEST_DIR}\" ...\e[0m"

if [[ -d "${DEST_DIR}" ]]; then
    find "${DEST_DIR}" -mindepth 1 -maxdepth 1 -exec gio trash -- {} +
    echo ' - OK: Cleaned existing'
else
    mkdir "${DEST_DIR}"
    echo ' - OK: Created new'
fi

echo -e "\n\e[32;1m[DONE] Created empty directory \"${DEST_DIR}\"\e[0m\n"
