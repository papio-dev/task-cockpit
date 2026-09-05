import * as vscode from 'vscode';
import openTaskDefinitionInEditor from '../../src/TasksSource/openTaskDefinitionInEditor';
import TaskName from '../../src/TaskName';


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


    run(context.subscriptions, logChannel, traceChannel);
}

export function deactivate(): void { }


// ----------------------------------------------


function run(
    subscriptions: { dispose(): any; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {


    vscode.commands.registerCommand('sandbox.my-command', (a) => {
        logChannel.appendLine(JSON.stringify(a, null, 4));
    });
}
