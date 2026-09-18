import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export default interface IFixture {
    // clearMarker(taskName: string): void;
    // readMarker(taskName: string): string;
    // runTaskManual(taskName: string, message: string): Promise<void>;
    // runTask(taskName: string): Promise<void>;
    runFromPicker(taskName: string, label: string): Promise<string>;
    runByName(taskName: string): Promise<string>;
};

let markerDir: string;

export function activate(context: vscode.ExtensionContext): IFixture {

    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) {
        throw new Error('No workspace folder — cannot resolve marker directory.');
    }
    markerDir = path.join(wf.uri.fsPath, '~vscode-task-markers');
    fs.mkdirSync(markerDir, { recursive: true });


    return {
        runFromPicker: runTest,
        runByName: runTest,
    };

}

export function deactivate(): void { }


// --------------------------------------------------------------------------------


async function runTest(taskName: string, label?: string) {
    clearMarker(taskName);
    await runTask(taskName, label);
    return readMarker(taskName);
}


function markerPath(taskName: string): string {
    return path.join(markerDir, `${taskName}.marker`);
}

function clearMarker(taskName: string): void {
    const filePath = markerPath(taskName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function readMarker(taskName: string): string {
    const filePath = markerPath(taskName);
    return fs.readFileSync(filePath, 'utf8').trim();
}


export async function runTask(taskName: string, label?: string): Promise<void> {

    const timeoutMs = 180_000;

    if (label != null) {
        await vscode.window.showInformationMessage(`Запускай ${taskName} (${label})`, { modal: false }, 'OK');
    }

    let ran: string | undefined;

    const async_ran = waitForAnyTask(timeoutMs);
    await vscode.commands.executeCommand('workbench.action.tasks.runTask', label != null ? undefined : taskName);
    ran = await async_ran;

    if (ran === taskName) return;

    throw new Error(`Expected task "${taskName}", but "${ran}" finished instead.`);

}

async function waitForAnyTask(timeoutMs: number): Promise<string> {

    const sub: vscode.Disposable[] = [];

    const waiter = new Promise<string>((resolve, reject) => {

        const timer = setTimeout(() => {
            reject(new Error(`Timeout: no task completed in ${timeoutMs}ms`));
        }, timeoutMs);

        sub.push({
            dispose() {
                clearTimeout(timer);
            },
        });

        vscode.tasks.onDidEndTask(e => {
            resolve(e.execution.task.name);
        }, undefined, sub);

    });

    try {
        return await waiter;
    }
    finally {
        sub.forEach((d) => void d.dispose());
    }
}
