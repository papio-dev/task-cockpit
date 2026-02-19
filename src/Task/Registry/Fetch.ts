import * as vscode from 'vscode';
import {
    File,
    Name,
    Uri,
    UserTask,
    TaskID,
    idFromTask,
    idFromFile,
    taskIdToString
} from '../Basic';
import {
    fetchDefinitions,
} from './Definitions2';


// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
declare type TableFn = (level: vscode.LogLevel, data: Record<string, unknown> | Record<string, unknown>[], config?: { headers?: string[]; undefinedAsEmpty?: boolean; }) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
let table: TableFn | undefined = undefined;
try {
    ({ logger, assert, table } = require('../../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


/** Возвращает UserTask'и ("обогащенные" vscode.Task'и), сгруппированные и упорядоченные
 * в соответствии со структурой исходных файлов задач.
 *
 * Возвращает именно "задачи": definitions без соответствующей vscode.Task в результат не попадают —
 * если VS Code отклонил definition (синтаксическая ошибка,
 * неизвестный тип, проблема провайдера). Такие записи — не задачи.
 *
 * @param uris URI файлов задач (не обязаны существовать физически).
 * */
export async function fetch(uris: ReadonlyArray<Uri>): Promise<ReadonlyMap<File, Map<Name, Readonly<UserTask>>>> {


    const vTasksMap = new Map<TaskID, vscode.Task>();

    const fetchedTasks = await vscode.tasks.fetchTasks();

    // #region DEBUG
    logger?.(vscode.LogLevel.Debug,
        `${vscode.env.appName} reports ${fetchedTasks.length} task(s)`);
    // #endregion DEBUG

    for (const task of fetchedTasks) {

        const taskId = idFromTask(task);

        if (taskId) {
            vTasksMap.set(taskId, task);
        }
        // #region DEBUG
        else {
            logger?.(vscode.LogLevel.Debug, `Task filtered out: name — "${task.name || '<unlabeled>'}", scope — "${task.scope?.toString() ?? 'undefined'}"`);
        }
        // #endregion DEBUG
    }

    const result = new Map<File, Map<Name, Readonly<UserTask>>>(uris.map(uri => [uri.fsPath, new Map<Name, Readonly<UserTask>>()]));


    const definitions = await Promise.all(uris.map(uri => fetchDefinitions(uri)));

    // #region DEBUG
    logger?.(vscode.LogLevel.Debug,
        `Fetched ${definitions.reduce((sum, [, map]) => sum + map.size, 0)} user task definition(s) for ${uris.length} uris`);
    // #endregion DEBUG

    for (const [file, definitionMap] of definitions) {

        const fileMap = result.get(file);

        // #region DEBUG
        // result.get(file) всегда найдёт ключ — это тот же fsPath что использовался при создании Map.
        // fileMap! безопасен, assert для документации инварианта, не для реальной защиты.
        assert?.(fileMap, `fetchDefinitions() returned file not in uris: ${file}`);
        // #endregion DEBUG


        for (const [name, definition] of definitionMap) {

            const vTask = vTasksMap.get(idFromFile(file, name));

            if (vTask) {
                fileMap!.set(name, {
                    file,
                    vscTask: vTask,
                    ...definition
                });

            }
            // #region DEBUG
            else {
                logger?.(vscode.LogLevel.Warning, 'No vscode.Task for definition — VS Code rejected or not yet loaded', taskIdToString(idFromFile(file, name)));
            }
            // #endregion DEBUG
        }
    }

    // #region DEBUG
    logger?.(vscode.LogLevel.Trace, 'Fetched result:');
    table?.(
        vscode.LogLevel.Trace,
        [...result.entries()].map(([f, m]) => ({ File: f, ['UserTask(s)']: m.size, Rejected: (new Map(definitions).get(f)!.size - m.size) || undefined })),
        { undefinedAsEmpty: true }
    );
    // #endregion DEBUG

    return result;
}
