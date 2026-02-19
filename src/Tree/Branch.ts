import * as vscode from 'vscode';

// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
try {
    ({ logger, assert } = require('../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG

declare const __NodePath: unique symbol;

export namespace Branch {

    /** Спецификация ветки: путь (сегменты) + данные на конце. */
    export type Spec<T> = Readonly<{ segments: readonly string[], data: T; }>;

    export type NodePath = string & { [__NodePath]: never; };

    /** Узел дерева. */
    export type Node<T> = {
        /** Имя узла (его часть пути). */
        segment: string;
        /** Дочерние узлы (если есть). */
        children?: Node<T>[];
        /** Данные (только у "листьев" — узлов-с-данными). */
        data?: T;
        /** Уникальный идентификатор узла (не задачи) в пределах дерева.
         * Формируется из полного пути: `scope\0seg1\0seg2`.
         * */
        nodePath: NodePath;
    };

    /** Узел с гарантированно присутствующими данными — "листом". */
    export type DataNode<T> = Omit<Node<T>, 'data'> & { data: T; };
}


/** Разделитель для формирования nodeId.
 * NUL-символ исключает коллизии с именами сегментов. */
const SEPARATOR = '\0' as const;


/**  Построить дерево из списка спецификаций.
 *
 * Алгоритм: для каждой спецификации проходим по сегментам,
 * создавая узлы по мере необходимости (или пере используя существующие).
 * Данные записываются в последний сегмент пути.
 *
 * @param scope уникальный идентификатор корня (используется как префикс nodeId)
 * @param specs массив спецификаций (путь + данные)
 * @returns корневые узлы построенного дерева
 * @throws Error если scope пустой или сегменты некорректны */
function build<T>(scope: string, specs: readonly Branch.Spec<T>[]): Branch.Node<T>[] {

    // #region DEBUG
    assert?.(scope, 'The "scope" not falsy');
    // #endregion DEBUG


    // Карта для поиска node по полному пути на ветке
    // Внутрення структура, используется при построении дерева)
    const nodeMap = new Map<Branch.NodePath, Branch.Node<T>>([
        [scope as Branch.NodePath, { segment: '/', children: [], nodePath: '' as Branch.NodePath }]
    ]);

    // Обрабатываем каждую ветку
    for (const { segments, data } of specs) {

        // #region DEBUG
        assert?.(segments.length > 0, 'The count of "segments" is at least one');
        // #endregion DEBUG

        segments.reduce<{ path: Branch.NodePath; remaining: number; }>(
            ({ path, remaining }, segment) => {

                // #region DEBUG
                assert?.(segment.length > 0, 'The count of "segment" is at least one char');
                // #endregion DEBUG

                const nodePath = concatNodePath(path, segment);
                let node = nodeMap.get(nodePath);

                if (!node) {
                    node = { segment, nodePath };
                    nodeMap.set(nodePath, node);
                    (nodeMap.get(path)!.children ??= []).push(node);
                }

                // Последний сегмент — записываем в него данные.
                // Теперь он — "лист"
                if (remaining === 0) {
                    // #region DEBUG
                    if (node.data) {
                        logger?.(
                            vscode.LogLevel.Warning,
                            `Path "${segments.join('→')}" collision at "${segment}" will be overwritten`);
                    }
                    // #endregion DEBUG

                    node.data = data;
                }

                return { path: nodePath, remaining: remaining - 1 };
            },
            { path: scope as Branch.NodePath, remaining: segments.length - 1 }
        );
    }

    return nodeMap.get(scope as Branch.NodePath)!.children!;
}


/** Type guard: узел содержит данные ("лист"). */
function isDataNode<T>(node: Branch.Node<T>): node is Branch.DataNode<T> {
    return node.data !== undefined;
}


/** Проверка наличия дочерних узлов у DataNode.
 * "Лист", который еще и промежуточный сегмент */
function hasChildren<T>(node: Branch.DataNode<T>): boolean {
    return 'children' in node;
}


function parseNodePath(nodePath: Branch.NodePath): { scope: string, segments: string; } {
    const [scope, ...path] = nodePath.split(SEPARATOR);
    return { scope, segments: path.join(' → ') };
}


function concatNodePath(path: string, segment: string): Branch.NodePath {
    return `${path}${SEPARATOR}${segment}` as Branch.NodePath;
}


/**
 * Модуль построения дерева из плоских путей.
 *
 * Принимает массив "спецификаций" — путей вида `['a', 'b', 'c']` с данными —
 * и строит из них дерево с общими префиксами.
 *
 * Порядок спецификаций не влияет на структуру дерева:
 * `[a,b,c], [a,b]` и `[a,b], [a,b,c]` дадут идентичный результат.
 *
 * Дубликаты путей создают коллизию —
 * данные перезаписываются с предупреждением в лог.
 *
 * @example
 * // Вход:
 * [
 *   { segments: ['build', 'dev'],  data: task1 },
 *   { segments: ['build', 'prod'], data: task2 },
 *   { segments: ['test'],          data: task3 }
 * ]
 * // Выход (дерево):
 * // ├─ build
 * // │  ├─ dev  [task1]
 * // │  └─ prod [task2]
 * // └─ test [task3]
 *
 * @example
 * // Узел может быть одновременно промежуточным и содержать данные:
 * [
 *   { segments: ['build'],        data: taskAll },
 *   { segments: ['build', 'dev'], data: taskDev }
 * ]
 * // Выход:
 * // └─ build [taskAll]
 * //    └─ dev [taskDev]
 *
 * */
export const Branch = {
    build,
    isDataNode,
    hasChildren,
    parseNodePath
};
