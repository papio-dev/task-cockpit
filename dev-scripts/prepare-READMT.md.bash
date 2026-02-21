#!/usr/bin/env bash

set -eu

# SOURCE — входной .md файл
# DEST_DIR — целевая директория для результата

echo -e "\e[1m[MD] Converting GitHub alert blockquote ...\e[0m"

[[ -n "${SOURCE:-}" ]] || { echo "[ERROR] Environment variable SOURCE not set or empty" ; exit 1 ; }
[[ -f "${SOURCE}" ]] || { echo "[ERROR] SOURCE: not a file or does not exist" ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: not a directory or does not exist" ; exit 1 ; }

REL_PATH="${SOURCE}"
mkdir -p "${DEST_DIR}/$(dirname "${REL_PATH}")"

ALERT_COUNT=$(grep -cE '\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]' "${SOURCE}" || true)
REGION_COUNT=$(grep -c '<!-- #region GITHUB -->' "${SOURCE}" || true)

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
echo -e "\n\e[32;1m[Done] Saved at \"${DEST_DIR}/${REL_PATH}\"\e[0m\n"
