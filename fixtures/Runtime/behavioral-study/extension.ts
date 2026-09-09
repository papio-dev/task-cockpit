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
    logChannel.show();

    logChannel.appendLine('-'.repeat(80));


    await run(context.subscriptions, logChannel, traceChannel);
}

export function deactivate(): void { }


// ----------------------------------------------

const startedExecutions = new Set<vscode.TaskExecution>();

async function run(
    subscriptions: { dispose(): any; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {

    const pidMap = new Map<vscode.TaskExecution, number>();

    const snap = vscode.tasks.taskExecutions;

    logChannel.appendLine(`[init] running tasks: ${snap.length}`);
    for (const ex of snap) {
        logChannel.appendLine(`  » ${printTask(ex.task)}`);
    }
    logChannel.appendLine('-'.repeat(40));



    subscriptions.push(

        vscode.tasks.onDidStartTask(e => {
            startedExecutionsAdd(e.execution, logChannel);
            logChannel.appendLine(
                `[startTask]    set.size=${startedExecutions.size}  taskExecutions.length=${vscode.tasks.taskExecutions.length}  ${printTask(e.execution.task)}`
            );
        }),

        vscode.tasks.onDidEndTask(e => {
            startedExecutions.delete(e.execution);
            logChannel.appendLine(
                `[endTask]      set.size=${startedExecutions.size}  taskExecutions.length=${vscode.tasks.taskExecutions.length}  ${printTask(e.execution.task)}`
            );
        }),

        vscode.tasks.onDidStartTaskProcess(e => {
            pidMap.set(e.execution, e.processId);
            logChannel.appendLine(`[startProcess] pid=${e.processId}  ${printTask(e.execution.task)}`);
        }),

        vscode.tasks.onDidEndTaskProcess(e => {
            const pid = pidMap.get(e.execution);
            pidMap.delete(e.execution);
            logChannel.appendLine(`[endProcess]   pid=${pid ?? '?'}  exitCode=${e.exitCode}  ${printTask(e.execution.task)}`);
        }),


    );


}


function startedExecutionsAdd(execution: vscode.TaskExecution, logChannel: vscode.OutputChannel,) {

    if (startedExecutions.has(execution)) {
        logChannel.appendLine(`execution для ${execution.task.name} уже есть`);
    }

    startedExecutions.add(execution);

}


function printTask(task: vscode.Task): string {
    const scope =
        task.scope === vscode.TaskScope.Global ? 'Global'
            : task.scope === vscode.TaskScope.Workspace ? 'Workspace'
                : (task.scope as vscode.WorkspaceFolder).name;

    const command =
        task.execution instanceof vscode.ShellExecution
            ? (task.execution.commandLine ?? String(task.execution.command))
            : task.execution instanceof vscode.ProcessExecution
                ? task.execution.process
                : task.execution instanceof vscode.CustomExecution
                    ? '(custom)'
                    : '(none)';

    return `name=${JSON.stringify(task.name)}  scope=${scope}  type=${task.definition.type}  cmd=${command}`;
}
