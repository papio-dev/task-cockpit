#!/usr/bin/env bash

set -eu

# DEST_DIR —

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: \"${DEST_DIR}\" not a directory" ; exit 1 ; }

echo -e "\e[1m[NPM] Installing project dependencies in \"${DEST_DIR}\" ...\e[0m"

cd "${DEST_DIR}" &>/dev/null

[[ -f 'package.json' ]] || { echo '[ERROR] package.json not found' ; exit 1 ; }

npm install || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Npm failed\e[0m\n' ; exit $rc ; }

echo -e "\n\e[32;1m[DONE] Project dependencies installed\e[0m\n"
