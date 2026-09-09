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
    class Item extends vscode.TreeItem {
        constructor(label: string) {
            super(label, vscode.TreeItemCollapsibleState.None);
            this.id = label;
        }
    }

    const emitter = new vscode.EventEmitter<void>();
    subscriptions.push(emitter);

    let items: Item[] = [];

    const provider: vscode.TreeDataProvider<Item> = {
        onDidChangeTreeData: emitter.event,
        getTreeItem: (e) => e,
        getChildren: () => [...items],
        getParent: () => null,
    };

    // ← сюда вставь свой viewId из package.json
    const treeView = vscode.window.createTreeView('sandbox.view', {
        treeDataProvider: provider,
    });
    subscriptions.push(treeView);

    const target = new Item('ghost');

    const reveal = async (label: string) => {
        logChannel.appendLine(`\n[${label}]`);
        logChannel.appendLine(`  items in tree: [${items.map(i => i.label).join(', ') || 'empty'}]`);
        try {
            await treeView.reveal(target, { select: false, expand: false });
            logChannel.appendLine('  reveal → resolved');
        } catch (e) {
            logChannel.appendLine(`  reveal → rejected: ${e}`);
        }
    };

    const refresh = async (label: string) => {
        emitter.fire();
        // даём VS Code переварить refresh
        await delay(300);
        logChannel.appendLine(`  [refreshed: ${label}]`);
    };

    // --- тесты ---

    // 1. элемент есть — baseline
    items = [target];
    await refresh('add target');
    await reveal('item present');

    // 2. убрали из массива, refresh НЕ делали
    items = [];
    await reveal('removed, no refresh');

    // 3. убрали + refresh
    await refresh('refresh after remove');
    await reveal('removed + refreshed');

    // 4. элемент никогда не был в дереве (новый инстанс)
    items = [];
    await refresh('empty tree');
    const stranger = new Item('stranger');
    logChannel.appendLine('\n[item never in tree]');
    try {
        await treeView.reveal(stranger, { select: false, expand: false });
        logChannel.appendLine('  reveal → resolved');
    } catch (e) {
        logChannel.appendLine(`  reveal → rejected: ${e}`);
    }

    logChannel.appendLine('\n--- done ---');
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
