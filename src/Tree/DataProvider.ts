import * as vscode from 'vscode';

import {
    Task
} from '../Task';
import {
    Renderers
} from './Renderers';
import {
    Resolvers
} from './Resolvers';
import {
    FolderRoot,
    isFolderRoot,
    isMarker,
    isRoot,
    isWorkspaceRoot,
    Node,
    WorkspaceRoot,
} from './Basic';
import { Roots } from './Roots';
import { Branch } from './Branch';



// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
declare type FailFn = (condition: unknown, text: string, fail?: boolean) => asserts condition;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
let fail: FailFn | undefined = undefined;
try {
    ({ logger, assert } = require('../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


export class DataProvider implements vscode.TreeDataProvider<Node>, vscode.Disposable {

    // private static instance: DataProvider | undefined;


    private onDidChangeEmitter: vscode.EventEmitter<Node | undefined | void> =
        new vscode.EventEmitter<Node | undefined | void>();

    public readonly onDidChangeTreeData: vscode.Event<Node | undefined | void> = this.onDidChangeEmitter.event;


    /** кэш ссылок на leaf-узлы задач, организованный по scope файлам. */
    private leafsMap: Map<Readonly<Task.TaskID>, Branch.DataNode<Task.UserTask>> | undefined;

    private rootsMap: Map<Task.File, FolderRoot | WorkspaceRoot> | undefined;


    private readonly runtime: Task.Runtime;

    private disposables: vscode.Disposable;

    constructor(shellIntegrationTimeout: number, polingCap: number) {



        this.runtime = new Task.Runtime(shellIntegrationTimeout, polingCap);

        this.disposables = vscode.Disposable.from(

            this.runtime.onDidChange((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"runtime.onDidChange" event received');
                // #endregion DEBUG

                this.refreshDataNode(e);
            }),

            vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"workspace.onDidChangeConfiguration" event received');
                // #endregion DEBUG

                const tasksChanged = e.affectsConfiguration('tasks');
                const taskCockpitChanged = e.affectsConfiguration('taskCockpit');

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Debug,
                    `Configuration change. Affects: tasks — "${tasksChanged}", taskCockpit — "${taskCockpitChanged}"`);

                // #endregion DEBUG

                if (!tasksChanged && !taskCockpitChanged) {

                    // #region DEBUG
                    logger?.(
                        vscode.LogLevel.Debug,
                        ' - No relevant config changes, skipping');
                    // #endregion DEBUG

                    return;
                }

                this.refreshAll();

            }),

            vscode.workspace.onDidChangeWorkspaceFolders((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"workspace.onDidChangeWorkspaceFolders" event received');
                // #endregion DEBUG

                this.refreshAll();
            }),

            this.onDidChangeEmitter,

            this.runtime,

        );
    }


    dispose() {

        this.disposables.dispose();
        this.leafsMap?.clear();
        this.leafsMap = undefined;

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'disposed');
        // #endregion DEBUG
    }


    public refreshAll() {
        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'Refreshing entire tree view ...');
        // #endregion DEBUG
        this.onDidChangeEmitter.fire();
    }


    public refreshDataNode(id: Task.TaskID) {
        const leaf = this.leafsMap?.get(id);
        if (leaf) {
            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                'Refreshing tree view item ...', Task.taskIdToString(id));
            // #endregion DEBUG
            this.onDidChangeEmitter.fire(leaf);
        }
        // #region DEBUG
        else {
            logger?.(
                vscode.LogLevel.Debug,
                'Refreshing tree view item skipped (unmapped leaf node)', Task.taskIdToString(id));
        }
        // #endregion DEBUG
    }


    /** Возвращает детей указанной ноды
     *
     * @implements vscode.TreeDataProvider.getChildren */
    public async getChildren(node?: Node | undefined): Promise<Node[] | undefined> {

        // Если нода не передана - подготовить, и вернуть корни
        if (!node) {
            // сброс карты зарегистрированных узлов-листьев
            this.leafsMap = new Map();
            //
            this.rootsMap = new Map();

            const roots = await Roots.grow();

            // новая карта с ссылками на
            this.rootsMap = new Map(roots.map(r => [r.tasksFile, r]));

            return roots;
        }

        // Для маркеров вообще не должно запрашиваться
        if (isMarker(node)) {
            throw new Error('Internal error: "getChildren()" should never be called on "Marker" nodes');
        }

        if (isRoot(node)) {

            if (node.children.length < 1) {
                return [{
                    marker: 'empty' as const,
                    tasksFile: node.tasksFile
                }];
            }

            return node.children;
        }

        return node.children;
    }


    public getTreeItem(node: Node): vscode.TreeItem {

        if (isMarker(node)) {
            return Renderers.emptyMarker(node);
        }

        if (isRoot(node)) {
            if (isWorkspaceRoot(node)) {
                return Renderers.workspaceRoot(node);
            }

            if (isFolderRoot(node)) {
                return Renderers.folderRoot(node);
            }
        }

        const scopeFile = Branch.parseNodePath(node.nodePath).scope as Task.File;

        const scopedConfigs = this.rootsMap!.get(scopeFile)?.childrenConfigs;

        if (!scopedConfigs) {
            throw new Error('Internal error ...');
        }

        if (Branch.isDataNode(node)) {
            const taskId = Task.idFromTask(node.data.vscTask)!;
            this.leafsMap!.set(taskId, node);

            return Renderers.leaf(node, scopedConfigs, this.runtime.state(taskId));
        }

        return Renderers.inner(node, scopedConfigs);

    }


    public getParent(node: Node): Node | undefined {

        if (isRoot(node)) {
            return undefined;
        }

        return this.getRootNode(node);
    }


    public getRootNode(node: Node): FolderRoot | WorkspaceRoot {

        if (isRoot(node)) {
            return node;
        }

        if (isMarker(node)) {
            return this.rootsMap!.get(node.tasksFile)!;
        }

        const { scope } = Branch.parseNodePath(node.nodePath);

        // @todo тип
        return this.rootsMap!.get(scope as Task.File)!;
    }


    public resolveTreeItem(item: vscode.TreeItem, node: Node, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {

        if (isMarker(node)) {
            return item;
        }

        if (isRoot(node)) {
            if (isWorkspaceRoot(node)) {
                return Resolvers.workspaceRoot(item, node, token);
            }

            if (isFolderRoot(node)) {
                return Resolvers.folderRoot(item, node, token);
            }
        }

        if (Branch.isDataNode(node)) {
            return item;
        }

        return item;
    }


    public abortProcesses(taskId: Task.TaskID) {

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'Aborting all task processes', Task.taskIdToString(taskId));
        // #endregion DEBUG
        this.runtime.abortAll(taskId);

    }

    public async getTerminals(taskId: Task.TaskID) {
        return await this.runtime.getTerminals(taskId);
    }

}
