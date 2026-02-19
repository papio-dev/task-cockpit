#!/usr/bin/env bash

set -eu

# DEST_DIR — директория, содержимое которой удаляется

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty"; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: \"${DEST_DIR}\" not a directory"; exit 1 ; }

echo -e "\e[1m[CLEAN] Removing contents of \"${DEST_DIR}\" ...\e[0m"

[[ -d "${DEST_DIR}" ]] || { echo -e "\n\e[32;1m[DONE] Directory \"${DEST_DIR}\" not exists\e[0m\n" ; exit 0 ; }

find "${DEST_DIR}" -mindepth 1 -maxdepth 1 -exec gio trash -- {} +

echo -e "\n\e[32;1m[DONE] Directory \"${DEST_DIR}\" cleaned\e[0m\n"
