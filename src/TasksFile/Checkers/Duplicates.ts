import * as vscode from 'vscode';
import {
    Task
} from '../../Task';
import {
    locateTask
} from '../LocateTask';


// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
try {
    ({ logger, assert } = require('../../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


export async function duplicates(
    uri: vscode.Uri,
    token: vscode.CancellationToken
): Promise<vscode.Diagnostic[]> {

    try {
        const document = await vscode.workspace.openTextDocument(uri);

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        if (document.isClosed) {
            return [];
        }

        const documentContent = document.getText();

        const tasksMap = locateTask(documentContent, Task.jsonPath(uri), undefined);

        // Отдаём управление после "тяжёлой" работы
        await new Promise(r => setImmediate(r));

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        if (document.isClosed) {
            return [];
        }

        const fileDiagnostics: vscode.Diagnostic[] = [];

        for (const [taskLabel, ranges] of tasksMap) {
            if (ranges.length <= 1) {
                continue;
            }

            for (const range of ranges) {
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(
                        document.positionAt(range.start),
                        document.positionAt(range.end)
                    ),
                    `Task "${taskLabel}" defined ${ranges.length} times. Duplicate labels may cause conflicts`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'task-cockpit';
                diagnostic.code = 'duplicate labels';
                fileDiagnostics.push(diagnostic);
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
