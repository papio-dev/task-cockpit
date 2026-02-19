#!/usr/bin/env bash

set -eu

# TSCONFIG
# DEST_DIR

[[ -n "${TSCONFIG:-}" ]] || { echo "[ERROR] Environment variable TSCONFIG not set or empty" ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

echo -e "\e[1m[DEV] Building (${TSCONFIG}) ...\e[0m\n"

npx tsc -p "${TSCONFIG}" --outDir "${DEST_DIR}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Build failed\e[0m\n' ; exit $rc ;}

echo -e '\e[32;1m[DONE] Build complete\e[0m\n'
