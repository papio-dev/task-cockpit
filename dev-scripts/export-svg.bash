#!/usr/bin/env bash

set -eu

# SRC_SVG
# TARGET_DIR
# TARGET_TYPE

[[ -n "${SRC_SVG:-}" ]] || { echo "[ERROR] Environment variable SRC_SVG not set or empty" ; exit 1 ; }
[[ -n "${TARGET_DIR:-}" ]] || { echo "[ERROR] Environment variable TARGET_DIR not set or empty" ; exit 1 ; }
[[ -n "${TARGET_TYPE:-}" ]] || { echo "[ERROR] Environment variable TARGET_TYPE not set or empty" ; exit 1 ; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" ; exit 1' TERM INT

echo -e "\e[1m[SVG] Export \"${SRC_SVG}\" ...\e[0m\n"

[[ -f "${SRC_SVG}" ]] || { echo "[ERROR] SRC_SVG \"${SRC_SVG}\" is not a file or does not exist" ; exit 1 ; }
[[ "${SRC_SVG}" == *.svg ]] || { echo "[ERROR] SRC_SVG \"${SRC_SVG}\" must have .svg extension" ; exit 1 ; }
[[ -d "${TARGET_DIR}" ]] || { echo "[ERROR] TARGET_DIR \"${TARGET_DIR}\" is not a directory or does not exist" ; exit 1 ; }

TARGET_FILE="${TARGET_DIR}/$(basename "${SRC_SVG}" .svg).${TARGET_TYPE}"

inkscape --export-type="${TARGET_TYPE}" --export-filename="${TARGET_FILE}" "${SRC_SVG}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Export failed\e[0m\n' ; exit $rc ;}

echo -e "\e[32;1m[DONE] Saved at ${TARGET_FILE}\e[0m\n"
