/** @file TreeViewPanel/TreeView/TreeView.ts */

import {
    commands,
    window
} from 'vscode';
import AsyncQueue from '../../utils/AsyncQueue';
import Element from './Element/Element';
import TaskTreeDataProvider from './TaskTreeDataProvider';
import {
    USER_TREE,
    PROJECT_TREE
} from '../../tokens';

import type {
    Disposable,
    TreeDataProvider,
    TreeViewSelectionChangeEvent,
    TreeView as VscTreeView
} from 'vscode';
import {
    type SelectedNodeTag
} from '../../tokens';
import type Immutable from '../../utils/Immutable';
import type LifecycleOmitted from '../../utils/LifecycleOmitted';
import type LogOutputChannel from '../../extension/LogOutputChannel';
import type OriginKey from '../../OriginKey';
import type OriginNode from '../OriginNode';
import type ResourceStateCoordinator from '../../ResourceStateCoordinator/ResourceStateCoordinator';
import type TaskName from '../../TaskName';
import type TaskProcessLifecycle from '../../Runtime/TaskProcessLifecycle';


type WhenHasItems =
    | typeof USER_TREE.WHEN.HAS_ITEMS
    | typeof PROJECT_TREE.WHEN.HAS_ITEMS;

type WhenSelectedNodeType =
    | typeof USER_TREE.WHEN.SELECTED_NODE_TYPE
    | typeof PROJECT_TREE.WHEN.SELECTED_NODE_TYPE;

type ViewId =
    | typeof USER_TREE.ID
    | typeof PROJECT_TREE.ID;

type RunnableItemStatus = TreeView.RunnableItemStatus;

declare namespace TreeView {

    interface RunnableItemStatus {
        isRunning: boolean;
        isBroken: boolean;
        hasTerminals: boolean;
    }
}


class TreeView implements Disposable {

    readonly #treeDataProvider: TaskTreeDataProvider;
    readonly #treeView: VscTreeView<Immutable<Element>>;

    readonly #viewId: ViewId;

    #excludedScopesCount: number | null;

    #disposed: boolean;
    readonly #disposables: Disposable[];

    readonly #asyncQueue: AsyncQueue;
    #logOutputChannel: LifecycleOmitted<LogOutputChannel>;

    readonly #resourceProps: Readonly<{
        resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
    }>;

    readonly #taskProcessRegistry: TaskProcessLifecycle.TaskProcessRegistryView;


    constructor(
        viewId: ViewId,
        title: string,
        resourceProps: Readonly<{
            resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
        }>,
        taskProcessRegistry: TaskProcessLifecycle.TaskProcessRegistryView,
        logOutputChannel: LifecycleOmitted<LogOutputChannel>
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;
        this.#asyncQueue = AsyncQueue.create('setContext', this.#logOutputChannel);

        this.#resourceProps = resourceProps;
        this.#taskProcessRegistry = taskProcessRegistry;

        this.#treeDataProvider = new TaskTreeDataProvider(
            this.#resourceProps,
            this.#taskProcessRegistry,
            this.#logOutputChannel
        );

        this.#viewId = viewId;

        this.#treeView = window.createTreeView(
            this.#viewId,
            {
                treeDataProvider: this.#treeDataProvider as TreeDataProvider<Immutable<Element>>,
                canSelectMany: false,
                dragAndDropController: undefined,
                manageCheckboxStateManually: undefined
            }
        );


        this.#treeView.title = title;
        this.#treeView.description = undefined;

        this.#excludedScopesCount = null;

        this.#disposables = [
            this.#treeView,
            this.#treeDataProvider
        ];

        this.#treeView.onDidChangeSelection(this.#changeSelectionHandler, this, this.#disposables);

        this.#treeDataProvider.onDidRefreshTopElements(this.#updateTopElementsHandler, this, this.#disposables);

        this.#taskProcessRegistry.onDidChangeTaskProcesses(this.#changeTaskProcessesHandler, this, this.#disposables);
    }

    public dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        void this.#asyncQueue.enqueue(
            async () => {
                await commands.executeCommand('setContext', `${this.#viewId}.hasItems` satisfies WhenHasItems, undefined);
                await commands.executeCommand('setContext', `${this.#viewId}.selectedNode` satisfies WhenSelectedNodeType, undefined);
            }
        );

        this.#logOutputChannel.trace(`[${this.constructor.name}] disposed`);
    }


    // #region Handlers

    // @todo внимательно проверить
    #updateTopElementsHandler() {

        if (this.#disposed) { return; }

        this.#treeView.description = buildViewDescription(this.#treeDataProvider.topElements?.length, this.#excludedScopesCount);

        const itemsCount = this.#treeDataProvider.topElements?.reduce((acc, entry) => {
            return acc + entry.children.length;
        }, 0);

        void this.#asyncQueue.enqueue(
            async () => {
                await commands.executeCommand<void>('setContext', `${this.#viewId}.hasItems` satisfies WhenHasItems, Boolean(itemsCount));
            }
        );
    }


    #changeTaskProcessesHandler(affectedTasks: Immutable<Map<OriginKey, Set<TaskName>>>) {

        if (this.#disposed) { return; }

        // @todo - знать originKeys содержимого, и отбрасывать сразу не валидное?
        // не делать for, не вызывать updateRunnable - если все равно будет промах
        for (const [originKey, taskNames] of affectedTasks) {
            for (const taskName of taskNames) {
                this.#treeDataProvider.notifyRunnableChanged(originKey, taskName);
            }
        }
    }


    #changeSelectionHandler(event: TreeViewSelectionChangeEvent<Immutable<Element>>) {

        const selected = event.selection.at(0);

        void this.#asyncQueue.enqueue(
            async () => {
                const nodeTag = getNodeTag(selected) satisfies SelectedNodeTag | undefined;

                this.#logOutputChannel.trace(`[${this.constructor.name}#${this.#viewId}#changeSelectionHandler] selectedNode = ${nodeTag}`);
                await commands.executeCommand<void>(
                    'setContext',
                    `${this.#viewId}.selectedNode` satisfies WhenSelectedNodeType,
                    nodeTag
                );
            });
    }

    // #endregion

    public rebuild(originTree: Immutable<Array<OriginNode>>, excludedScopesCount: number | null = null): void {
        if (this.isInoperable) { return; }

        this.#excludedScopesCount = excludedScopesCount;
        this.#treeDataProvider.rebuild(originTree);
    }


    public expandAll() {

        if (this.isInoperable) { return; }

        const topElements = this.#treeDataProvider.topElements;
        if (!topElements || topElements.length < 1) {
            return;
        }

        for (const element of topElements) {
            void this.#treeView.reveal(element, {
                expand: 3,
                focus: false,
                select: false
            })
                .then(undefined, (err) => {
                    this.#logOutputChannel.trace(`[${this.constructor.name}#expandAll] reveal skipped: ${err}.`);
                });
        }

    }


    public collapseAll() {

        if (this.isInoperable) { return; }

        // не документирована. проверено работает 1.86.2-1.131.0
        void commands.executeCommand(
            `workbench.actions.treeView.${this.#viewId}.collapseAll` // @remark так вот почему в ID запрещена точка?
        )
            .then(undefined, (err) => {
                this.#logOutputChannel.trace(`[${this.constructor.name}#collapseAll] collapse skipped: ${err}.`);
            });
    }


    public getSelection(): Immutable<Element> | undefined {
        return this.#treeView.selection.at(0);
    }


    public getRunnableItemStatus(element: Immutable<Element.Runnable>): Immutable<RunnableItemStatus> | undefined {
        return this.#treeDataProvider.getRunnableItemStatus(element);
    }


    public get isInoperable(): boolean {

        if (this.#disposed) { return true; }

        const dependenciesDisposed =
            this.#resourceProps.resourceStateCoordinator.disposed ||
            this.#taskProcessRegistry.disposed;

        if (dependenciesDisposed) {
            // warn намеренно: сигнал о нарушении порядка dispose.
            this.#logOutputChannel.warn(`[${this.constructor.name}] External dependencies are disposed`);
            return true;
        }

        return false;
    }
}

// есть если нет исключённых источников, описание не показывается
// вовсе — тек задумано: ничего не сообщаем, если сообщать нечего.
// viewsWelcome из package.json уже объясняет
// "все скрыты" — "0/5" в description избыточно.
function buildViewDescription(visibleScopesCount: number | undefined, excludedScopesCount: number | null): string | undefined {

    if (!visibleScopesCount || !excludedScopesCount) {
        return undefined;
    }
    const total = visibleScopesCount + excludedScopesCount;
    return `${visibleScopesCount}/${total}`;
}


function getNodeTag(element: Immutable<Element> | undefined): SelectedNodeTag | undefined {

    if (element == null) { return undefined; }

    if (Element.isSynthetic(element)) {
        if (element.kind === 'TopNode') {
            return `${element.kind}:${element.originTag}`;
        }
        return 'UnknownNode';
    }

    return element.data ? 'RunnableNode' : 'IntermediateNode';

}

export default TreeView;
