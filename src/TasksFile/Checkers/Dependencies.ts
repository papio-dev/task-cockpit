import * as vscode from 'vscode';
import * as JSONC from 'jsonc-parser';
import { Task } from '../../Task';

// #region DEBUG
/** Опциональный логгер — подгружается динамически, отсутствие модуля не является ошибкой. */
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
let logger: LoggerFn | undefined = undefined;
try {
    logger = require('../../Logger').get(module.filename);
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


/** Валидация dependsOn в tasks-файле — проверяет существование задач-зависимостей.
 *
 * Собирает labels задач из того же scope и проверяет, что каждая
 * зависимость в `dependsOn` ссылается на существующую задачу.
 * Зависимости с переменными (`${...}`) пропускаются — они резолвятся динамически.
 *
 * @param uri Uri tasks-файла для проверки
 * @param token Токен отмены операции
 * @returns Диагностики для несуществующих зависимостей (Warning, code: `missing dependency`)
 * @throws {vscode.CancellationError} При отмене операции */
export async function dependencies(
    uri: vscode.Uri,
    token: vscode.CancellationToken
): Promise<vscode.Diagnostic[]> {
    try {

        // @bug и глобальные и ws задачи имеют task.scope = 2
        if (uri.toString().endsWith('.code-workspace')) {
            // @fixme: заглушка. проверка для .code-workspace пропускается
            return [];
        }

        const document = await vscode.workspace.openTextDocument(uri);

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        if (document.isClosed) {
            return [];
        }

        const fetched = await vscode.tasks.fetchTasks();

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // выбираем стратегию резолвинга
        // multi-root определяется наличием .code-workspace файла
        const isMultiRoot = vscode.workspace.workspaceFile !== undefined;

        // Коллекция labels задач из того же scope
        const availableLabels = new Set<string>();

        for (const task of fetched) {

            const taskUri = Task.computeUri(task.scope);

            // Для НЕ isMultiRoot Включаем задачи из всех скоп (т.е папка и глобальные)
            // Для isMultiRoot -- только из указанной
            if (isMultiRoot) {
                if (taskUri) {
                    if (taskUri.toString() === uri.toString()) {

                        // префикс для спец. задач ('npm: lint' и т.п.)
                        const taskName = (task.source === 'Workspace') ? task.name : `${task.source}: ${task.name}`;
                        availableLabels.add(taskName);
                    }
                }
            }
            else {
                const taskName = (task.source === 'Workspace') ? task.name : `${task.source}: ${task.name}`;
                availableLabels.add(taskName);
            }

        }

        const content = document.getText();
        const jsoncTree = JSONC.parseTree(content, undefined, {
            allowEmptyContent: true,
            allowTrailingComma: true,
        });

        if (!jsoncTree) {
            return [];
        }

        const tasksArrayNode = JSONC.findNodeAtLocation(jsoncTree, Task.jsonPath(uri));
        if (!tasksArrayNode?.children) {
            return [];
        }

        const fileDiagnostics: vscode.Diagnostic[] = [];

        for (const taskNode of tasksArrayNode.children) {

            const dependsOnNode = JSONC.findNodeAtLocation(taskNode, ['dependsOn']);
            if (!dependsOnNode) {
                continue;
            }

            // dependsOn может быть string или string[]
            const depNodes = dependsOnNode.type === 'array'
                ? dependsOnNode.children ?? []
                : [dependsOnNode];

            for (const depNode of depNodes) {

                if (depNode.type !== 'string' || typeof depNode.value !== 'string') {
                    continue;
                }

                const depLabel = depNode.value;

                // Пропускаем зависимости с переменными — они резолвятся динамически
                if (/\$\{[^}]+\}/.test(depLabel)) {
                    continue;
                }

                if (!availableLabels.has(depLabel)) {

                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(
                            document.positionAt(depNode.offset),
                            document.positionAt(depNode.offset + depNode.length)
                        ),
                        `Task "${depLabel}" not found. It may be missing or failed to load.`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'task-cockpit';
                    diagnostic.code = 'missing dependency';//'dependencies lost'
                    fileDiagnostics.push(diagnostic);

                }
            }
        }

        return fileDiagnostics;
    }
    catch (error) {
        if (error instanceof vscode.CancellationError) {
            throw error;
        }

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Warning,
            `Failed: ${error instanceof Error ? error.message : String(error)}`,
            uri.toString());
        // #endregion DEBUG

        return [];
    }
}


// async function breacker(token: vscode.CancellationToken) {
//     // Отдаём управление после "тяжёлой" работы
//     await new Promise(r => setImmediate(r));
//     // проверяем отмену
//     if (token.isCancellationRequested) {
//         throw new vscode.CancellationError();
//     }
// }
