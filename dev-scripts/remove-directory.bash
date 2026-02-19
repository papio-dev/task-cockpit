#!/usr/bin/env bash

set -eu

# DEST_DIR — целевая директория для удаления

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: \"${DEST_DIR}\" is not a directory" ; exit 1 ; }

echo "[RM] Removing directory \"./${DEST_DIR}\" ..."

[[ -d "${DEST_DIR}" ]] && gio trash -- "${DEST_DIR}"

echo -e "\n[DONE] Directory \"./${DEST_DIR}\" removed\n"
