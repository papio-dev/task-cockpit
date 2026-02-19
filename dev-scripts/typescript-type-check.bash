#!/usr/bin/env bash

set -eu

# TSCONFIG

[[ -n "${TSCONFIG:-}" ]] || { echo "[ERROR] Environment variable TSCONFIG not set or empty" ; exit 1 ; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

echo -e "\e[1m[LINT] Typescript type chek (\"./${TSCONFIG}\") ...\e[0m\n"

npx tsc --noEmit -p "./${TSCONFIG}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Type chek failed\e[0m\n' ; exit $rc ;}

echo -e '\e[32;1m[DONE] No type errors\e[0m\n'
