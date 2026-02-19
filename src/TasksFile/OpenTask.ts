import * as vscode from 'vscode';
import {
    Task
} from '../Task';
import {
    locateTask
} from './LocateTask';


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


// Если есть дубликаты - открываю последнюю: повторяю поведение vscode
export async function openTask(task: vscode.Task): Promise<void> {

    // #region DEBUG
    const taskIdStr = Task.taskIdToString(Task.idFromTask(task));
    logger?.(vscode.LogLevel.Debug, 'Open task in file ...', taskIdStr);
    // #endregion DEBUG

    const uri = Task.computeUri(task.scope);

    if (!uri) {
        throw new Error(`The task "${Task.taskIdToString(Task.idFromTask(task))}" has an invalid scope URI`);
    }

    if (!Task.isName(task.name)) {
        throw new Error(`The task "${Task.taskIdToString(Task.idFromTask(task))}" has an invalid name`);
    }

    const document = await vscode.workspace.openTextDocument(uri);

    // Открываем в редакторе
    const editor = await vscode.window.showTextDocument(document, {
        preserveFocus: false,
        preview: false
    });

    if (document.isClosed) {
        throw new Error(`Document "${uri.fsPath}" was closed during processing`);
    }

    const documentContent = document.getText();

    const locations = locateTask(documentContent, Task.jsonPath(uri), task.name);

    if (locations.size < 1) {
        throw new Error(`Task "${task.name}" not found in "${uri.fsPath}"`);
    }

    // #region DEBUG
    // Ожидаем локации (возможно несколько), НО для ОДНОЙ задачи
    assert?.(locations.size === 1, `Expected exactly one match for "${task.name}", found ${locations.size}`);
    // #endregion DEBUG

    // Берем последнюю локацию, если локаций у задачи несколько
    const range = locations.get(task.name)!.at(-1);

    if (!range) {
        throw new Error(`Task "${task.name}" found but has no location data in "${uri.fsPath}"`);
    }

    // Выделяем задачу и центрируем в редакторе
    editor.selection = new vscode.Selection(
        document.positionAt(range.start),
        document.positionAt(range.end)
    );

    editor.revealRange(
        new vscode.Range(editor.selection.start, editor.selection.end),
        vscode.TextEditorRevealType.InCenter
    );

    // #region DEBUG
    logger?.(
        vscode.LogLevel.Debug,
        'Task located and selected in file', taskIdStr);
    // #endregion DEBUG


}
