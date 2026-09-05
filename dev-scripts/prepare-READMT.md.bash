#!/usr/bin/env bash

# Конвертирует GitHub-алёрты ([!NOTE], [!TIP] и др.) в markdown-эмодзи,
# и удаляет блоки <!-- #region GITHUB --> из исходного .md файла.
#
# Переменные окружения:
#   SOURCE   — входной .md файл (обязательна)
#   DEST_DIR — целевая директория для результата (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${SOURCE:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -f "${SOURCE}" ]] || { echo -e "\e[31m[ERROR] SOURCE: not a file or does not exist\e[0m" >&2 ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: not a directory or does not exist\e[0m" >&2 ; exit 1 ; }
readonly SOURCE
readonly DEST_DIR

echo -e "\e[1m[MD] Converting GitHub alert blockquote ...\e[0m\n" >&2

REL_PATH="${SOURCE}" && readonly REL_PATH
mkdir -p "${DEST_DIR}/$(dirname "${REL_PATH}")"

ALERT_COUNT=$(grep -cE '\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]' "${SOURCE}" || true) && readonly ALERT_COUNT
REGION_COUNT=$(grep -c '<!-- #region GITHUB -->' "${SOURCE}" || true) && readonly REGION_COUNT

sed -E \
  -e '/<!-- #region GITHUB -->/,/<!-- #endregion GITHUB -->/d' \
  -e 's/\[!NOTE\]/ℹ️ **Note**  /' \
  -e 's/\[!TIP\]/💡 **Tip**  /' \
  -e 's/\[!IMPORTANT\]/⚠️ **Important**  /' \
  -e 's/\[!WARNING\]/⚡ **Warning**  /' \
  -e 's/\[!CAUTION\]/🔴 **Caution**  /' \
  "${SOURCE}" > "${DEST_DIR}/${REL_PATH}"

echo " - source: ${SOURCE}"
echo " - alerts converted: ${ALERT_COUNT}"
echo " - GitHub regions removed: ${REGION_COUNT}"

echo -e "\n\e[32;1m[DONE] Saved at \"${DEST_DIR}/${REL_PATH}\"\e[0m\n" >&2