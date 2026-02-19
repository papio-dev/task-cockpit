#!/usr/bin/env bash

set -eu

# SOURCE_DIR
# DEST_DIR — целевая директория

[[ -n "${SOURCE_DIR:-}" ]] || { echo "[ERROR] Environment variable SOURCE_DIR not set or empty" ; exit 1 ; }
[[ ! -e "${SOURCE_DIR}" || -d "${SOURCE_DIR}" ]] || { echo "[ERROR] SOURCE_DIR: \"${SOURCE_DIR}\" exist and not a directory" ; exit 1 ; }

[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo "[ERROR] DEST_DIR: \"${DEST_DIR}\" exist and not a directory" ; exit 1 ; }

echo -e "\e[1m[VSCE] Packaging extension from \"${SOURCE_DIR}\" files ...\e[0m"

DEST_DIR="${PWD}/${DEST_DIR}"

cd "${SOURCE_DIR}" &>/dev/null

VERSION=$(jq -r '.version' package.json)

# версия либо точная. либо диапазон без simple штук
VSCODE_VERSION_RANGE=$(jq -r '.engines.vscode' package.json)
_min=$(npx semver -c --ltr "${VSCODE_VERSION_RANGE}")
_max=$(npx semver -c --rtl "${VSCODE_VERSION_RANGE}")
VSCODE_VERSION=$( [[ "$_min" != "$_max" ]] && echo "${_min}-${_max}" || echo "$_min" )


if [[ -n "${RELEASE:-}" ]]; then
    FILE_NAME="${DEST_DIR}/${VERSION}+vscode${VSCODE_VERSION}.vsix"
    RELEASE_FLAG=""
else
    TIMESTAMP=$(date -u +%Y%m%d.%H%M%S)
    FILE_NAME="${DEST_DIR}/${VERSION}-pre.${TIMESTAMP}+vscode${VSCODE_VERSION}.vsix"
    RELEASE_FLAG="--pre-release"
fi

npx vsce package --dependencies ${RELEASE_FLAG} --out "${FILE_NAME}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Vsce failed\e[0m\n' ; exit $rc ;}

echo -e "\n\e[32;1m[Done] VSIX save at \"${FILE_NAME}\"\e[0m\n"
