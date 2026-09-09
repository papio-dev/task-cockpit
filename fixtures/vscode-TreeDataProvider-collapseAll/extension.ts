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
        constructor(
            label: string,
            public readonly children: Item[] = []
        ) {
            super(label, children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
            );
            this.id = label;
        }
    }

    const emitter = new vscode.EventEmitter<void>();
    subscriptions.push(emitter);

    let roots: Item[] = [];

    const buildTree = () => {
        roots = [
            new Item('scope-a', [new Item('a-task-1'), new Item('a-task-2'), new Item('a-task-3')]),
            new Item('scope-b', [new Item('b-task-1'), new Item('b-task-2')]),
            new Item('scope-c', [new Item('c-task-1')]),
        ];
    };

    const provider: vscode.TreeDataProvider<Item> = {
        onDidChangeTreeData: emitter.event,
        getTreeItem: (e) => e,
        getChildren: (e) => e ? e.children : roots,
        getParent: (e) => roots.find(r => r.children.includes(e)) ?? null,
    };

    const treeView = vscode.window.createTreeView('sandbox_view', { treeDataProvider: provider });
    subscriptions.push(treeView);

    const doExpand = (label: string, midFlightRefresh: boolean) => {
        logChannel.appendLine(`\n[${label}]`);
        const snapshot = [...roots];

        snapshot.forEach(e => {
            void treeView.reveal(e, { expand: 3, focus: false, select: false })
                .then(
                    () => logChannel.appendLine(`  resolved: ${e.label}`),
                    (err) => {
                        traceChannel.trace(`[TreeView]#expandAll: reveal skipped: ${err}.`);
                        logChannel.appendLine(`  skipped (→ trace): ${e.label}`);
                    }
                );
        });

        if (midFlightRefresh) {
            logChannel.appendLine('  → refresh fired mid-flight');
            buildTree();
            emitter.fire();
        }
    };

    buildTree();
    emitter.fire();

    subscriptions.push(

        vscode.commands.registerCommand('sandbox.expandAllMidFlight', () => {
            doExpand('expandAll — mid-flight refresh', true);
        }),
        vscode.commands.registerCommand('sandbox.collapseAll', () => {
            logChannel.appendLine('\n[collapseAll]');
            void vscode.commands.executeCommand('workbench.actions.treeView.sandbox_view.collapseAll');
            logChannel.appendLine('  command fired');
        }),

        vscode.commands.registerCommand('sandbox.expandAll', () => {
            logChannel.appendLine('\n[collapseAll]');
            void vscode.commands.executeCommand('sandbox_view.expandAll');
            logChannel.appendLine('  command fired');
        }),
        // vscode.commands.registerCommand('sandbox.expandAll', () => {
        //     doExpand('expandAll — normal', false);
        // }),
    );

    logChannel.appendLine('ready. commands:');
    logChannel.appendLine('  sandbox.expandAll');
    logChannel.appendLine('  sandbox.expandAllMidFlight');
    logChannel.appendLine('  sandbox.collapseAll');

    void vscode.commands.executeCommand("sandbox_view.focus");
}
