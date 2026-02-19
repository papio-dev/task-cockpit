#!/usr/bin/env bash

set -eu

# DEST_DIR — целевая директория для create

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: \"${DEST_DIR}\" exist and not a directory" ; exit 1 ; }

echo "[CREATE] Create directory \"${DEST_DIR}\" ..."

[[ -d "${DEST_DIR}" ]] || mkdir "${DEST_DIR}"

echo -e "\n[DONE] Directory \"${DEST_DIR}\" created\n"
