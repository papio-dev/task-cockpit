#!/usr/bin/env bash
set -eu

# Перевірка змінних середовища
[[ -n "${SOURCE_DIR:-}" ]] || { echo "[ERROR] Environment variable SOURCE_DIR not set or empty" ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo "[ERROR] Environment variable DEST_DIR not set or empty" ; exit 1 ; }
[[ -n "${FIND_FILTERS:-}" ]] || { echo "[ERROR] Environment variable FIND_FILTERS not set or empty" ; exit 1 ; }

START_MARKER='// #region DEBUG'
END_MARKER='// #endregion DEBUG'

# Фаза 1: Валідація всіх файлів
echo "[INFO] Phase 1: Validating all files..."
VALIDATION_FAILED=0

while IFS= read -r -d '' TS_FILE; do
    awk -v start="${START_MARKER}" -v end="${END_MARKER}" -v file="${TS_FILE}" '
        BEGIN { depth = 0; errors = 0 }
        index($0, start) {
            depth++
            open_lines[depth] = NR
            next
        }
        index($0, end) {
            if (depth == 0) {
                printf "%s:%d: closing marker \"%s\" without opening\n", file, NR, end > "/dev/stderr"
                errors++
            } else {
                delete open_lines[depth]
                depth--
            }
            next
        }
        END {
            if (depth > 0) {
                for (i = 1; i <= depth; i++) {
                    printf "%s:%d: unclosed opening marker \"%s\"\n", file, open_lines[i], start > "/dev/stderr"
                }
                errors++
            }
            exit (errors > 0 ? 1 : 0)
        }
    ' "${TS_FILE}" > /dev/null || VALIDATION_FAILED=1
done < <(eval "find \"${SOURCE_DIR}\" ${FIND_FILTERS} -type f -print0")

if [[ ${VALIDATION_FAILED} -eq 1 ]]; then
    echo "[ERROR] Validation failed. Fix the errors above before filtering." >&2
    exit 1
fi

echo "[INFO] Validation passed. Proceeding to filtering..."

# Фаза 2: Фільтрація
while IFS= read -r -d '' TS_FILE; do
    # Вычисляем относительный путь от SOURCE_DIR
    REL_PATH="${TS_FILE#${SOURCE_DIR}/}"
    DEST_FILE="${DEST_DIR}/${REL_PATH}"

    # Создаём директорию для файла в DEST_DIR
    mkdir -p "$(dirname "${DEST_FILE}")"

    # Фильтруем и сохраняем в целевой файл
    awk -v start="${START_MARKER}" -v end="${END_MARKER}" '
        BEGIN { depth = 0 }
        index($0, start) { depth++; next }
        index($0, end) { depth--; next }
        depth == 0 { print }
    ' "${TS_FILE}" > "${DEST_FILE}"

    echo "[INFO] Filtered: ${REL_PATH}"
done < <(eval "find \"${SOURCE_DIR}\" ${FIND_FILTERS} -type f -print0")

exit 0
