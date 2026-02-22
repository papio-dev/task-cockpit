import * as vscode from 'vscode';
import {
    Task
} from './Task';
import {
    DecoratorProvider
} from './DecorationProviders';
import {
    Tree
} from './Tree';
import {
    Checkers,
    TasksFile
} from './TasksFile';
import { Panel } from './Panel';



// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
declare type TableFn = (level: vscode.LogLevel, data: Record<string, unknown> | Record<string, unknown>[], config?: { headers?: string[]; undefinedAsEmpty?: boolean; }) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
let table: TableFn | undefined = undefined;
try {
    ({ logger, assert, table } = require('./Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG



export function activate(context: vscode.ExtensionContext) {

    // #region DEBUG
    {
        logger?.(vscode.LogLevel.Debug, '* * * * *');
        logger?.(vscode.LogLevel.Debug, `Extension "${context.extension.id}" activate`);
        // Среда VS Code
        logger?.(vscode.LogLevel.Debug, `App: ${vscode.env.appName} (${vscode.env.appHost}), version ${vscode.version}`);
        logger?.(vscode.LogLevel.Debug, `Language: ${vscode.env.language}`);
        logger?.(vscode.LogLevel.Debug, `UI Kind: ${vscode.env.uiKind === vscode.UIKind.Desktop ? 'Desktop' : 'Web'}`);

        // Workspace
        logger?.(vscode.LogLevel.Debug, `Workspace file: ${vscode.workspace.workspaceFile?.fsPath ?? 'none'}`);

        dumpFolders();

        dumpConfiguration();
    }
    // #endregion DEBUG

    const configuration = vscode.workspace
        .getConfiguration('taskCockpit');


    { // diagnosticsManager

        const checkers = [];

        if (configuration.get<boolean>('validation.duplicateLabels', false)) {
            checkers.push(Checkers.duplicates);
        }

        if (configuration.get<boolean>('validation.dependencies', false)) {
            checkers.push(Checkers.dependencies);
        }

        if (checkers.length > 0) {
            const diagnosticsManager = new TasksFile.DiagnosticsManager(checkers);
            context.subscriptions.push(diagnosticsManager);
        }

    }

    const panel = new Panel(context, configuration);

    context.subscriptions.push(

        panel,

        // #region DEBUG
        vscode.commands.registerCommand('task-cockpit.DEBUG', async function () {

            const msg = await vscode.window.showInputBox();

            logger?.(vscode.LogLevel.Debug,
                '---DEBUG---');

            if (msg) {
                logger?.(vscode.LogLevel.Debug,
                    msg);
            }

        }),
        // #endregion DEBUG

        // #region DEBUG
        vscode.workspace.onDidChangeWorkspaceFolders((e) => {

            const changes = [
                e.added.length > 0 && `added: ${e.added.length}`,
                e.removed.length > 0 && `removed: ${e.removed.length}`
            ].filter(Boolean).join(', ') || 'renamed only';

            logger?.(
                vscode.LogLevel.Trace,
                `"workspace.onDidChangeWorkspaceFolders" event received (${changes}):`);

            dumpFolders();
        }),
        // #endregion DEBUG


        // #region DEBUG
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {

            logger?.(
                vscode.LogLevel.Trace,
                '"workspace.onDidChangeConfiguration" event received');

            const taskCockpitChanged = event.affectsConfiguration('taskCockpit');

            if (!taskCockpitChanged) {
                logger?.(
                    vscode.LogLevel.Trace,
                    'Configuration change does not affect "taskCockpit", ignoring');

                return;
            }

            logger?.(
                vscode.LogLevel.Trace,
                '"taskCockpit" configuration changed, dumping current settings:');

            dumpConfiguration();
        }),
        // #endregion DEBUG

        // - - - - -

        vscode.commands.registerCommand('_task-cockpit.tasks-file.open-tasks-file', async function (node?: Tree.FolderRoot) {

            // #region DEBUG
            const commandId = '"Opening tasks.json file"';
            logger?.(vscode.LogLevel.Debug,
                'Command invoked', commandId);
            // #endregion DEBUG

            await vscode.commands.executeCommand('task-cockpit.tasks-file.open-file', node);

        }),

        vscode.commands.registerCommand('_task-cockpit.tasks-file.open-workspace-file', async function (node?: Tree.WorkspaceRoot) {

            // #region DEBUG
            const commandId = '"Opening .code-workspace file"';
            logger?.(vscode.LogLevel.Debug,
                'Command invoked', commandId);
            // #endregion DEBUG

            await vscode.commands.executeCommand('task-cockpit.tasks-file.open-file', node);
        }),


        vscode.commands.registerCommand('task-cockpit.tasks-file.open-file', async function (node?: Tree.Node) {

            // #region DEBUG
            const commandId = '"?????????????"';
            logger?.(vscode.LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            // #region DEBUG
            if (!node) {
                // Параметр не передан — запущена через шорт-кат
                logger?.(vscode.LogLevel.Debug, 'No node parameter, falling back to tree selection', commandId);
            }
            // #endregion DEBUG

            node ??= panel.getSelectedNode();

            if (!node) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, 'No DataNode selected, aborting', commandId);
                // #endregion DEBUG
                return;
            }

            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(panel.getNodeScope(node)));
        }),


        vscode.commands.registerCommand('task-cockpit.tasks-file.open-task', async function (node?: Tree.DataNode) {

            // #region DEBUG
            const commandId = '"Opening task for edition"';
            logger?.(vscode.LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            // #region DEBUG
            if (!node) {
                // Параметр не передан — запущена через шорт-кат
                logger?.(vscode.LogLevel.Debug, 'No node parameter, falling back to tree selection', commandId);
            }
            // #endregion DEBUG

            const task = node?.data.vscTask ?? panel.getSelectedDataNode()?.data.vscTask;

            if (!task) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Debug,
                    `No task in ????????`, commandId);
                // #endregion DEBUG
                return;
            }

            try {

                await TasksFile.openTask(task);

                // #region DEBUG
                logger?.(vscode.LogLevel.Debug,
                    'Command completed', commandId);
                // #endregion DEBUG

            } catch (error) {

                // #region DEBUG
                // Любые ошибки - просто ничего не делаем
                logger?.(
                    vscode.LogLevel.Warning,
                    `Command failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`, commandId);
                // #endregion DEBUG

            }
        }),

        // Не доступно для шорт-ката
        // @todo: Rename log messages to clarify command vs task lifecycle:
        //   "Command invoked" → ok
        //   "Execute ..." → "Dispatching task ..."
        //   "Command complete" → "Command handler finished, task is now running"
        vscode.commands.registerCommand('_task-cockpit.task.execute', async function (node?: Tree.DataNode) {

            // #region DEBUG
            const commandId = '"Execute task"';
            logger?.(vscode.LogLevel.Debug,
                'Command invoked', commandId);
            // #endregion DEBUG

            if (!node) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Warning, 'No node provided, aborting', commandId);
                // #endregion DEBUG
                return;
            }

            try {

                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, `Execute "${Task.taskIdToString(Task.idFromTask(node.data.vscTask))}" task`, commandId);
                // #endregion DEBUG

                await executeTask(node.data.vscTask);

                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, `Command complete for "${Task.taskIdToString(Task.idFromTask(node.data.vscTask))}"`, commandId);
                // #endregion DEBUG

            }
            catch (error) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, `Command failed wit message: ${(error as Error).message}`, commandId);
                // #endregion DEBUG
            }

        }),

        // Команда "Запустить новый экземпляр задачи" — это та же "Запустить задачу", просто
        // в другом контексте. Доступно для шорт-ката
        vscode.commands.registerCommand('task-cockpit.task.execute', function (node?: Tree.DataNode) {

            // #region DEBUG
            const commandId = '"Execute task"';
            logger?.(vscode.LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            // #region DEBUG
            if (!node) {
                // Параметр не передан — запущена через шорт-кат
                logger?.(vscode.LogLevel.Debug, 'No node parameter, falling back to tree selection', commandId);
            }
            // #endregion DEBUG

            return vscode.commands.executeCommand('_task-cockpit.task.execute', node ?? panel.getSelectedDataNode());
        }),


        vscode.commands.registerCommand('task-cockpit.task.abort-all', function (node?: Tree.DataNode) {

            // #region DEBUG
            const commandId = '"Abort All Running Instances"';
            logger?.(vscode.LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            // #region DEBUG
            if (!node) {
                // Параметр не передан — запущена через шорт-кат
                logger?.(vscode.LogLevel.Debug, 'No node parameter, falling back to tree selection', commandId);
            }
            // #endregion DEBUG

            node ??= panel.getSelectedDataNode();

            if (!node) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, 'No DataNode selected, aborting', commandId);
                // #endregion DEBUG
                return;
            }

            panel.abortProcesses(node);

        }),


        vscode.commands.registerCommand('task-cockpit.task.show-terminal', async function (node?: Tree.DataNode) {

            // #region DEBUG
            const commandId = '"Show Task Terminal"';
            logger?.(vscode.LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            // #region DEBUG
            if (!node) {
                // Параметр не передан — запущена через шорт-кат
                logger?.(vscode.LogLevel.Debug, 'No node parameter, falling back to tree selection', commandId);
            }
            // #endregion DEBUG

            node ??= panel.getSelectedDataNode();

            if (!node) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, 'No DataNode selected, aborting', commandId);
                // #endregion DEBUG
                return;
            }

            const terminalsMap = await panel.getTerminals(node);

            const title = Tree.parseNodePath(node.nodePath).segments;

            if (!terminalsMap || terminalsMap.size < 1) {
                // #region DEBUG
                logger?.(vscode.LogLevel.Debug, `No terminals for "${title}", aborting`, commandId);
                // #endregion DEBUG

                vscode.window.showInformationMessage(`No terminals found for “${title}”`);
                return;
            }

            await navigateToTerminal(terminalsMap, title);

            // #region DEBUG
            logger?.(vscode.LogLevel.Debug, 'Command complete', commandId);
            // #endregion DEBUG

        }),

        // Обновить дерево
        vscode.commands.registerCommand('task-cockpit.view.refresh', function () {
            panel.refreshTree();
        }),


        vscode.commands.registerCommand('task-cockpit.settings.configure-display', function () {
            return vscode.commands.executeCommand(
                'workbench.action.openWorkspaceSettings',
                { query: '@ext:papio-dev.task-cockpit taskCockpit.display' });
        }),


        vscode.commands.registerCommand('task-cockpit.settings.configure-filtering', function () {
            return vscode.commands.executeCommand(
                'workbench.action.openWorkspaceSettings',
                { query: '@ext:papio-dev.task-cockpit taskCockpit.filtering' });
        }),


        vscode.commands.registerCommand('task-cockpit.open-help-page', function () {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.from({
                scheme: 'https',
                authority: 'github.com',
                path: '/papio-dev/task-cockpit/tree/main',
                query: 'tab=readme-ov-file',
                fragment: 'configuration'
            }));
        }),
    );

    // бейджи и декораторы
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(new DecoratorProvider.Processes()),
        vscode.window.registerFileDecorationProvider(new DecoratorProvider.Color())
    );
}


export function deactivate() {

    // #region DEBUG
    logger?.(vscode.LogLevel.Debug, `Extension deactivate`);
    logger?.(vscode.LogLevel.Debug, '* * * * *');
    try {
        require('./Logger').dispose();
    }
    catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
            console.error(error);
        }
    }
    // #endregion DEBUG

}


async function executeTask(task: vscode.Task) {

    try {

        await vscode.tasks.executeTask(task);

        // #region DEBUG
        logger?.(vscode.LogLevel.Debug,
            'Task executed', Task.taskIdToString(Task.idFromTask(task)));
        // #endregion DEBUG
    }
    catch (error) {

        // When running a ShellExecution or a ProcessExecution task in an environment where a
        // new process cannot be started. In such an environment, only CustomExecution tasks
        // can be run.

        // #region DEBUG
        logger?.(vscode.LogLevel.Warning,
            'Task execute failed', Task.taskIdToString(Task.idFromTask(task)));
        // #endregion DEBUG

        // @fixme: vscode сама покажет проблему?
        await vscode.window.showErrorMessage(`Task executed failed "${Task.taskIdToString(Task.idFromTask(task))}": ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }

    return;
}


// #region DEBUG
function dumpConfiguration() {
    const configuration = vscode.workspace.getConfiguration('taskCockpit');

    const windowKeys = [
        'filtering.excludeFolders',
        'filtering.excludeWorkspaceTasks',
        'validation.duplicateLabels',
        'validation.dependencies'
    ];

    const resourceKeys = [
        'display.segmentSeparator',
        'display.defaultIconName',
        'display.useFolderIcon',
        'display.tintLabel',
        'display.useGroupKind',
        'filtering.showHidden',
    ];

    const tableData = [...windowKeys, ...resourceKeys].map(key => {
        const info = configuration.inspect(key);
        return {
            ['Config key']: key,
            Default: info?.defaultValue,
            Global: info?.globalValue,
            Workspace: info?.workspaceValue,
        };
    });

    logger?.(vscode.LogLevel.Trace, 'Extension settings (scope precedence):');
    table?.(vscode.LogLevel.Trace, tableData);

    if (vscode.workspace.workspaceFile) {

        const folders = vscode.workspace.workspaceFolders ?? [];

        if (folders.length > 0) {
            const folderTableData = resourceKeys.map(key => {
                const row: Record<string, unknown> = { key };
                for (const folder of folders) {
                    const folderConfig = vscode.workspace.getConfiguration('taskCockpit', folder.uri);
                    // const info = folderConfig.inspect(key);
                    // overrides
                    // row[folder.uri.fsPath] = info?.workspaceFolderValue;
                    // actual
                    row[folder.uri.fsPath] = folderConfig.get(key);
                }
                return row;
            });

            logger?.(vscode.LogLevel.Trace, 'Folder-level actual settings:');
            table?.(vscode.LogLevel.Trace, folderTableData, { headers: ['Config key', ...folders.map(f => f.name)] });
        }
        else {
            logger?.(vscode.LogLevel.Trace, 'Folder-level settings — no folders in workspace');
        }
    }
}
// #endregion DEBUG


// #region DEBUG
function dumpFolders() {
    const fCount = vscode.workspace.workspaceFolders?.length;
    logger?.(vscode.LogLevel.Debug, `Workspace folders — ${(fCount === undefined) ? 'no workspace has been opened' : (fCount > 0) ? `${fCount}:` : '0'}`);

    if (fCount) {
        table?.(vscode.LogLevel.Debug, vscode.workspace.workspaceFolders!.map((f, i) => ({
            index: i,
            Name: f.name,
            Path: f.uri.fsPath
        })));
    }
}
// #endregion DEBUG


async function navigateToTerminal(
    terminalsMap: ReadonlyMap<vscode.Terminal, Task.ProcessInfo & {
        processId: Task.ProcessId;
    }>,
    title: string
) {

    const items = [];

    for (const [terminal, data] of terminalsMap) {
        items.push(
            {
                label: `Process ID: ${data.processId}`,
                iconPath: new vscode.ThemeIcon('terminal'),
                description: data.running ? 'running' : 'completed',
                detail: new Date(data.timestamp).toLocaleString(vscode.env.language),
                // @todo не работает
                // picked: vscode.window.activeTerminal === terminal,
                terminal: terminal
            }
        );
    }

    if (items.length > 1) {

        const selected = await vscode.window.showQuickPick(items, {
            title,
            placeHolder: 'Select terminal',
            matchOnDescription: true,
            matchOnDetail: true,
        },);

        selected?.terminal.show();
        return;
    }

    if (items.length > 0) {
        items[0].terminal.show();
        return;
    }

    //items.length === 0
    return;


}
