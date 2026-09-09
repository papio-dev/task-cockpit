import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {

    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];

    const logChannel = vscode.window.createOutputChannel(extName);
    const traceChannel = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(logChannel, traceChannel);

    logChannel.appendLine(`extension: ${ext.id} ${ext.packageJSON['version']}`);
    logChannel.appendLine(`mode: ${vscode.ExtensionMode[context.extensionMode]}`);
    logChannel.appendLine(`vscode: ${vscode.version}`);
    logChannel.appendLine(`node: ${process.version} ${process.platform} ${process.arch}`);
    logChannel.appendLine(`log level: ${vscode.LogLevel[traceChannel.logLevel]}`);
    logChannel.appendLine(`workspace: ${vscode.workspace.name ? vscode.workspace.name : vscode.workspace.workspaceFolders?.[0] ? `"${vscode.workspace.workspaceFolders![0]?.name}"` : '(none)'}`);

    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.appendLine('-'.repeat(80));
    logChannel.show();

    await run(context.subscriptions, logChannel, traceChannel);
}


export function deactivate(): void { }

// ----------------------------------------------

async function run(
    subscriptions: { dispose(): any; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {


    subscriptions.push(vscode.tasks.onDidStartTaskProcess((e) => {
        const task = e.execution.task;

        const scope = resolveScopeString(task.scope);
        const execution = task.execution;
        let command = '';
        if (execution instanceof vscode.ShellExecution) {
            command = execution.commandLine ?? 'no command';
        } else if (execution instanceof vscode.ProcessExecution) {
            command = execution.process;
        }
        logChannel.appendLine(' ');
        logChannel.appendLine(
            `  started task: "${task.name}"; scope: ${scope}; source: ${task.source}; command: "${command}"`
        );
    }));

    logChannel.appendLine('Fetched tasks:');
    const tasksList = await vscode.tasks.fetchTasks();
    const header = ['name', 'scope'];
    logChannel.appendLine(`      ${header.map(t => t.padEnd(32)).join('  ')}`);
    logChannel.appendLine(`      ${header.map(t => t.padEnd(32).replaceAll(/./g, '-')).join('  ')}`);
    tasksList.forEach((task, index) => {
        const scope = resolveScopeString(task.scope);
        logChannel.appendLine(`  ${(index + 1).toString().padStart(2)}. ${task.name.padEnd(32)}  ${scope}`);
    });


    logChannel.appendLine(' ');
    logChannel.appendLine('Task guts:');
    tasksList.forEach((task, index) => {

        const proto = Object.getPrototypeOf(task);

        const getters = Object.getOwnPropertyNames(proto).filter(key => {
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            return typeof desc?.get === 'function';
        });

        // Значения
        const snapshot = Object.fromEntries(
            getters.map(k => [k, (task as any)[k]])
        );

        function replacer(this: any, key: string, value: any) {
            if (key === 'scope') {
                const scope = value as vscode.WorkspaceFolder | vscode.TaskScope | undefined;
                return resolveScopeString(scope);
            }

            if (key === 'execution') {
                if (value instanceof vscode.ShellExecution) {
                    return 'ShellExecution';
                }
                else if (value instanceof vscode.ProcessExecution) {
                    return 'ProcessExecution';
                }
                return 'CustomExecution';
            }

            return value;
        }

        logChannel.appendLine(
            `  ${(index + 1).toString().padStart(2)}. ${JSON.stringify(snapshot, replacer, 4)
                .split('\n')
                .map((s, i) => i === 0 ? s : `    ${s}`)
                .join('\n')
            }`
        );

    });

    logChannel.appendLine(' ');
    logChannel.appendLine('.'.repeat(80));


}

function resolveScopeString(scope: vscode.WorkspaceFolder | vscode.TaskScope | undefined): string {
    return scope
        ? typeof scope === 'number'
            ? vscode.TaskScope[scope]
            : scope.name
        : 'undefined';
}
