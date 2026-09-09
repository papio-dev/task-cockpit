#!/usr/bin/env bash

# Проверяет наличие и корректность @file/@module JSDoc-заголовков
# в каждом .ts файле в директории src/.
#
# Обходит файлы через git ls-files — учитывает .gitignore,
# включает tracked и untracked (но не ignored) файлы.
#
# - `.d.ts` файлы исключаются из обхода.
# - `extension.ts` исключаются из обхода.
#
# Ожидаемый формат первых двух строк каждого файла:
#
#   /** @file Panel/Tree/Builder.ts */   ← путь относительно src/
#   /** @module Builder */               ← имя файла без расширения;
#                                          для index.* — имя каталога
#
# Вывод:
#   OK     src/...   — заголовок корректен
#   FAIL   src/...:N — строка N не совпадает с ожидаемой (кликабельно в VS Code)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

echo -e "\e[1m[CHECK] Checking @file headers ...\e[0m\n" >&2

while IFS= read -r TS_FILE; do

    [[ -f "$TS_FILE" ]] || continue

    REL="${TS_FILE#src/}"
    BASENAME=$(basename "$TS_FILE")
    NO_EXT="${BASENAME%.*}"

    if [[ "$NO_EXT" == "index" ]]; then
        MODULE=$(basename "$(dirname "$TS_FILE")")
    else
        MODULE="$NO_EXT"
    fi

    EXPECTED_FILE="/** @file ${REL} */"

    LINE1=$(sed -n '1p' "$TS_FILE")

    if [[ "$LINE1" == "$EXPECTED_FILE" ]]; then
        echo -e "  \e[32m  OK\e[0m  ${TS_FILE}"
    else
        [[ "$LINE1" != "$EXPECTED_FILE"   ]] && echo -e "  \e[31mFAIL\e[0m  ${TS_FILE}:1  expected: ${EXPECTED_FILE}"
    fi

done < <(git ls-files --cached --others --exclude-standard src/ | grep -v '^src/extension\.ts$' | grep '\.ts$' | grep -v '\.d\.ts$' | sort)

echo -e "\n\e[32;1m[DONE] Completed\e[0m\n" >&2
