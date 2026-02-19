#!/usr/bin/env bash

set -eu

[[ -n "${REQUIRED_CMDS:-}" ]] || { echo "[ERROR] Environment variable REQUIRED_CMDS not set or empty"; exit 1 ; }

echo -e '\e[1m[DEV] Checking required utilities ...\e[0m'

read -ra required_cmds <<< "$REQUIRED_CMDS"

missing=0
for cmd in "${required_cmds[@]}"; do
    if command -v "$cmd" > /dev/null 2>&1; then
        echo -e "  \e[32mOK\e[0m     $cmd"
    else
        echo -e "  \e[31mFAIL\e[0m   $cmd"
        missing=1
    fi
done

if (( missing )); then
    echo -e '\n\e[1;31m[FAIL] Missing dependencies\e[0m\n'
else
    echo -e '\n\e[1;32m[OK] All dependencies found\e[0m\n'
fi
exit $missing
