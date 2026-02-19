#!/usr/bin/env bash

set -eu

# TARGET — директория, или файл для проверки

[[ -n "${TARGET:-}" ]] || { echo "[ERROR] Environment variable TARGET not set or empty" ; exit 1 ; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

if [[ -d "${TARGET}" ]]; then
    entity="directory"
elif [[ -f "${TARGET}" ]]; then
    entity="file"
else
    echo "[ERROR] Target \"${TARGET}\" does not exist"
    exit 1
fi

echo -e "\e[1m[LINT] ESLint checking ${entity} \"${TARGET}\" ...\e[0m"

npx eslint --max-warnings 0 "${TARGET}" || { cr=$? ; echo -e '\e[31;1m[DONE] Completed\e[0m\n' ; exit $cr ; }

echo -e "\n\e[32;1m[DONE] Completed\e[0m\n"
