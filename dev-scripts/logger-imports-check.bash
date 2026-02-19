#!/usr/bin/env bash

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

echo -e "\e[1m[START] Checking Logger import paths ...\e[0m\n"

find src/ -name '*.ts' | while IFS= read -r TS_FILE; do

    dir=$(dirname "${TS_FILE}")

    grep -noP "require\(['\"]\K[^'\"]*Logger(?=['\"]\\)\.get)" "${TS_FILE}" | while IFS=: read -r LINE_NO req_path; do

        resolved=$(realpath -m "${dir}/${req_path}")

        if [[ -f "${resolved}.ts" ]]; then
            echo -e "  \e[32mOK\e[0m     ${TS_FILE}"
        else
            echo -e "  \e[31mBROKEN\e[0m ${TS_FILE}:${LINE_NO} \"Logger.ts\" not reachable from this location"
        fi

    done
done

echo -e "\n\e[1m[DONE] Completed\e[0m\n"
