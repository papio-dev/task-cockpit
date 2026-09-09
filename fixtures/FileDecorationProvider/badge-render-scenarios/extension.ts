import * as vscode from 'vscode';
import { SCENARIOS, STEP_INTERVAL_MS } from './SCENARIOS';
import FileDecorationProvider from '../../../src/FileDecorationProvider/FileDecorationProvider';
import WindowSettings from '../../../src/WindowConfiguration/WindowSettings';
import { ProbeTreeProvider } from './Tree';

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

    run(context.subscriptions, logChannel, traceChannel);
}


export function deactivate(): void { }

// ----------------------------------------------

function run(
    subscriptions: { dispose(): unknown; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel,
): void {

    const windowConfiguration = new WindowSettings(traceChannel);

    // --- дерево ---
    const treeProvider = new ProbeTreeProvider();
    const treeView = vscode.window.createTreeView('probe-tree', {
        treeDataProvider: treeProvider,
        showCollapseAll: false,
    });
    subscriptions.push(treeProvider, treeView);

    // --- декорации ---
    const decorationProvider = new FileDecorationProvider(
        { windowConfiguration },
        traceChannel,
    );
    subscriptions.push(
        decorationProvider,
        vscode.window.registerFileDecorationProvider(decorationProvider),
    );

    // --- статус-бар ---
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    subscriptions.push(statusBar);
    statusBar.show();

    // --- авто-прогон ---
    let stepIndex = 0;

    const advance = (): void => {
        const step = SCENARIOS[stepIndex]!;

        logChannel.appendLine(`[step ${stepIndex + 1}/${SCENARIOS.length}] ${step.description}`);
        statusBar.text = `$(beaker) probe [${stepIndex + 1}/${SCENARIOS.length}]: ${step.description}`;

        treeProvider.update(step);

        stepIndex = (stepIndex + 1) % SCENARIOS.length;
    };

    advance(); // первый шаг не ждёт таймера

    const timer = setInterval(advance, STEP_INTERVAL_MS);
    subscriptions.push({ dispose: () => clearInterval(timer) });
}
