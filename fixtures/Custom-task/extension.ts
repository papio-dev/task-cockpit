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

        const scope = resolveScopeString(task);
        const execution = task.execution;
        let command = '';
        if (execution instanceof vscode.ShellExecution) {
            command = execution.commandLine ?? 'no command';
        } else if (execution instanceof vscode.ProcessExecution) {
            command = execution.process;
        }
        logChannel.appendLine(' ');
        logChannel.appendLine(
            `  started task: "${task.name}" scope: ${scope} source: ${task.source} command: "${command}"`
        );
    }));

    const def: vscode.TaskDefinition = { type: 'shell' };

    const globalTask = new vscode.Task(
        def,
        vscode.TaskScope.Global,
        'test-global',
        'task-cockpit',
        new vscode.ShellExecution('echo hello-global')
    );

    const workspaceTask = new vscode.Task(
        def,
        vscode.TaskScope.Workspace,
        'test-workspace',
        'task-cockpit',
        new vscode.ShellExecution('echo hello-workspace')
    );

    await vscode.tasks.executeTask(globalTask);
    await vscode.tasks.executeTask(workspaceTask);

}

function resolveScopeString(task: vscode.Task): string {
    return task.scope
        ? typeof task.scope === 'number'
            ? vscode.TaskScope[task.scope]
            : task.scope.name
        : 'undefined';
}
