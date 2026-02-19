import * as JSONC from 'jsonc-parser';
import {
    Task
} from '../Task';


interface Range { start: number, end: number; }
type TasksLocations = ReadonlyMap<Task.Name, ReadonlyArray<Range>>;


/** Определяет позиции задач в JSON-документе по их меткам.
 *
 * Используется для навигации к задаче и подсветки дубликатов через diagnostics.
 * Задачи без label пропускаются.
 *
 * @param targetLabel — если указан, возвращает только позиции этой задачи
 *   (включая дубликаты), причём границы охватывают весь объект задачи.
 *   Если не указан — возвращает все задачи, а границы указывают только на label.
 *
 * @returns Карта: Метка→Массив_Границ. Будет пустая, если задачи не найдены или JSON невалиден.
 *
 * @throws Никогда не выбрасывает исключения — результат
 *   пустой/частичный. Если JSON битый - VSCode это уже показал. Нет смысла
 *   ронять extension или шуметь еще раз.
 *  */
export function locateTask(
    content: string,
    jsonPath: JSONC.JSONPath,
    targetLabel?: string | undefined
): TasksLocations {


    // Строим JSON-дерево для навигации по структуре документа и получения позиций узлов
    const jsoncTree = JSONC.parseTree(content, undefined, {
        allowEmptyContent: true,
        allowTrailingComma: true,
    });

    const result = new Map<Task.Name, Array<Range>>();

    if (!jsoncTree) {
        return result;
    }

    const tasksArrayNode = JSONC.findNodeAtLocation(jsoncTree, jsonPath);

    if (!tasksArrayNode?.children) {
        return result;
    }

    for (const taskNode of tasksArrayNode.children) {

        // Обрабатываем каждую задачу и собираем позиции для совпадающих меток
        // Даже если указан targetLabel — все равно придется проверить все
        // из-за возможных дубликатов

        const labelNode = JSONC.findNodeAtLocation(taskNode, ['label']);

        if (!labelNode) {
            // Задача без метки, пропускаем
            continue;
        }

        const label = labelNode.value;

        if (!Task.isName(label)) {
            // Метка не валидна - пропуск
            continue;
        }

        if (targetLabel === undefined || label === targetLabel) {

            // targetLabel задан → границы всей задачи, иначе → только label
            const range =
                targetLabel
                    ? {
                        start: taskNode.offset,
                        end: taskNode.offset + taskNode.length
                    }
                    : {
                        start: labelNode.offset,
                        end: labelNode.offset + labelNode.length
                    };

            // Накапливаем: одна метка может встречаться несколько раз (дубликаты)
            const ranges = result.get(label);

            if (ranges) {
                ranges.push(range);
            } else {
                result.set(label, [range]);
            }

        }
    }

    return result;
}
