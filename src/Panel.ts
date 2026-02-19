
import * as vscode from 'vscode';

import {
    Tree
} from './Tree';
import { Task } from './Task';


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


const POLL_CAP_DEFAULT = 1335;

export class Panel implements vscode.Disposable {

    public readonly treeView: vscode.TreeView<Tree.Node>;
    public readonly dataProvider: Tree.DataProvider;

    constructor(
        _context: vscode.ExtensionContext,
        configuration: vscode.WorkspaceConfiguration
    ) {

        const shellIntegrationTimeout = Math.max(1300,
            vscode.workspace.getConfiguration('terminal.integrated.shellIntegration')
                .get<number>('timeout', 0));

        // @todo: проверь что добавил настройку в package.json
        const polingCap = configuration.get<number>('polingCap', POLL_CAP_DEFAULT);

        this.dataProvider = new Tree.DataProvider(
            shellIntegrationTimeout,
            polingCap
        );

        this.treeView = vscode.window.createTreeView('task-cockpit-view', {
            treeDataProvider: this.dataProvider,
            canSelectMany: false
        });

    }


    public dispose() {

        this.treeView.dispose();
        this.dataProvider.dispose();

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'disposed');
        // #endregion DEBUG
    }


    public getSelectedDataNode(): Tree.DataNode | undefined {

        const node = this.getSelectedNode();

        if (!node) {
            // #region DEBUG
            logger?.(vscode.LogLevel.Debug, 'No node selected in TreeView');
            // #endregion DEBUG
            return undefined;
        }

        if (Tree.isMarker(node) || Tree.isRoot(node) || !Tree.isDataNode(node)) {
            // Маркер, промежуточный узел или корень — не содержит данные
            // #region DEBUG
            const nodeType = Tree.isMarker(node) ? 'MarkerNode' : Tree.isRoot(node) ? 'RootNode' : 'IntermediateNode';
            logger?.(vscode.LogLevel.Debug, `Selected node is ${nodeType}, not a DataNode`);
            // #endregion DEBUG
            return undefined;
        }

        return node;

    }


    public getSelectedNode(): Tree.Node | undefined {
        // #region DEBUG
        assert?.(this.treeView.selection.length < 2, `TreeView should be set to single selection, but ${this.treeView.selection.length} items selected`);
        // #endregion DEBUG

        return this.treeView.selection.at(0);
    }


    public getNodeScope(node: Tree.Node) {
        return this.dataProvider.getRootNode(node).tasksFile;
    }

    public refreshTree() {
        this.dataProvider.refreshAll();
    }


    public async getTerminals(node: Tree.DataNode) {
        const taskId = Task.idFromTask(node.data.vscTask);

        if (!taskId) {
            return undefined;
        }

        return await this.dataProvider.getTerminals(taskId);
    }

    public abortProcesses(node: Tree.DataNode) {

        const taskId = Task.idFromTask(node.data.vscTask);

        if (!taskId) {
            return;
        }

        this.dataProvider.abortProcesses(taskId);
    }

}
