#!/usr/bin/env bash

set -eu

# FILE_TO_CHECK

[[ -n "${FILE_TO_CHECK:-}" ]] || { echo "[ERROR] Environment variable FILE_TO_CHECK not set or empty" ; exit 1 ; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

echo -e "\e[1m[LINT] Scan \"./${FILE_TO_CHECK}\" for hidden Unicode ...\e[0m\n"

[[ -f "${FILE_TO_CHECK}" ]] || { echo "[ERROR] File not found: ${FILE_TO_CHECK}"; exit 1; }

GREMLINS='[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{00A0}\x{00AD}\x{200B}-\x{200F}\x{2028}-\x{202F}\x{2060}-\x{206F}\x{FEFF}]'

if ! grep -Pq "${GREMLINS}" "${FILE_TO_CHECK}"; then
    echo -e "\e[32;1m[PASS] No hidden Unicode characters\e[0m\n"
    exit 0
fi

grep -Pn "${GREMLINS}" "${FILE_TO_CHECK}" | while IFS=: read -r LINE_NO CONTENT; do
COUNT=0
    echo "${CONTENT}" | grep -Pbo "${GREMLINS}" | while IFS=: read -r POS CHAR; do
        CODEPOINT=$(printf '%d' "'${CHAR}")
        printf "%s:%s.%s; byte offset %s: U+%04X\n" "${FILE_TO_CHECK}" "${LINE_NO}" $((++COUNT)) "${POS}" "${CODEPOINT}"
    done
done

echo -e "\n\e[31;1m[FAIL] Hidden Unicode characters found\e[0m\n"
exit 1
