/** @file TreeViewPanel/TreeView/TaskTreeDataProvider.ts */

import {
    CancellationError,
    EventEmitter
} from 'vscode';
import * as assert from 'node:assert/strict';
import Element from './Element/Element';
import EmptyElement from './Element/EmptyElement';
import IntermediateElement from './Element/IntermediateElement';
import ResourceStateCoordinator from '../../ResourceStateCoordinator/ResourceStateCoordinator';
import RunnableElement from './Element/RunnableElement';
import TopElement from './Element/TopElement';

import type {
    CancellationToken,
    Event,
    ProviderResult,
    TreeDataProvider,
    TreeItem,
    Disposable
} from 'vscode';
import type Immutable from '../../utils/Immutable';
import type LifecycleOmitted from '../../utils/LifecycleOmitted';
import type LogOutputChannel from '../../extension/LogOutputChannel';
import type OriginKey from '../../OriginKey';
import type OriginNode from '../OriginNode';
import type TaskName from '../../TaskName';
import type TaskProcessLifecycle from '../../Runtime/TaskProcessLifecycle';


type ReadonlyTreeDataProvider<T> =
    Omit<TreeDataProvider<T>, 'getChildren'> & {
        // Сужение getChildren до ReadonlyArray: внутри элементы Immutable<T>,
        // что несовместимо с ковариантным Array<T> стандартного интерфейса.
        getChildren(element?: T): ProviderResult<ReadonlyArray<Readonly<T>>>;
    };


/** Реализация {@linkcode VscTreeDataProvider} для дерева задач.
 *
 * Кешует {@linkcode TreeItem} по элементам (WeakMap) и индексирует
 * {@linkcode RunnableElement} по `(originKey, taskName)` для точечных обновлений.
 *
 * Два режима обновления дерева:
 * - {@linkcode rebuild} — полный сброс кешей и перестройка
 * - {@linkcode notifyRunnableChanged} — точечный fire для уже рендеренного узла
 *
 * При `dispose()` уведомляет VS Code о перестройке в пустое состояние,
 * чтобы исключить вызовы `getTreeItem`.
 */
class TaskTreeDataProvider implements ReadonlyTreeDataProvider<Immutable<Element>> {

    readonly #onDidChangeTreeData: EventEmitter<Immutable<Element> | void>;
    readonly onDidChangeTreeData: Event<Immutable<Element> | void>;

    readonly #onWillRefreshTopElements: EventEmitter<void>;
    readonly onWillRefreshTopElements: Event<void>;

    readonly #onDidRefreshTopElements: EventEmitter<void>;
    readonly onDidRefreshTopElements: Event<void>;

    // ----------------------------------------------------
    #treeItemByRunnableElement: WeakMap<Immutable<RunnableElement>, TreeItem>;
    #runnableElementIndex: Map<OriginKey, Map<TaskName, Immutable<RunnableElement>>>;
    #originNodes: Immutable<Array<OriginNode>>;
    // null - не строилось, требует обновления
    #cachedTopElements: Immutable<Array<TopElement>> | null;
    // ----------------------------------------------------

    readonly #resourceProps: Readonly<{
        resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
    }>;

    readonly #taskProcessRegistry: TaskProcessLifecycle.TaskProcessRegistryView;

    #disposed: boolean;

    readonly #disposables: Disposable[];

    #logOutputChannel: LifecycleOmitted<LogOutputChannel>;

    public constructor(
        resourceProps: Readonly<{
            resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
        }>,
        taskProcessRegistry: TaskProcessLifecycle.TaskProcessRegistryView,
        logOutputChannel: LifecycleOmitted<LogOutputChannel>
    ) {

        this.#disposed = false;

        this.#resourceProps = resourceProps;
        this.#taskProcessRegistry = taskProcessRegistry;
        this.#logOutputChannel = logOutputChannel;

        // кеш/состояние
        // --------------------------------------------------------
        this.#treeItemByRunnableElement = new WeakMap();
        this.#runnableElementIndex = new Map();
        this.#originNodes = [];
        this.#cachedTopElements = null;
        // --------------------------------------------------------

        this.#onDidChangeTreeData = new EventEmitter();
        this.onDidChangeTreeData = this.#onDidChangeTreeData.event;

        this.#onWillRefreshTopElements = new EventEmitter();
        this.onWillRefreshTopElements = this.#onWillRefreshTopElements.event;

        this.#onDidRefreshTopElements = new EventEmitter();

        /** Срабатывает когда провайдер вернул актуальный список top-элементов
         * в ответ на запрос VS Code `getChildren(undefined)`.
         *
         * Сигнал для обновления UI-состояния, зависящего от набора видимых "корней":
         * описания (`description`) TreeView, контекста и т.п. */;
        this.onDidRefreshTopElements = this.#onDidRefreshTopElements.event;

        this.#disposables = [
            this.#onDidRefreshTopElements,
            this.#onWillRefreshTopElements,
            this.#onDidChangeTreeData
        ];

    }


    public dispose(): void {

        if (this.#disposed) {
            return;
        }
        this.#disposed = true;

        this.#runnableElementIndex.clear();
        this.#cachedTopElements = null;
        this.#originNodes = [];

        // try {
        //     // @fixme  this.#onDidChangeTreeData WTF?
        //     // Exception has occurred: Canceled: Canceled
        //     //   at new f (/home/lumen/Projects/Task Cockpit/.vscode-test/vscode-linux-x64-1.86.2/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:140:45069)
        //     //     at d.U (/home/lumen/Projects/Task Cockpit/.vscode-test/vscode-linux-x64-1.86.2/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:147:5557)
        //     //     at Proxy.T.<computed>.O.charCodeAt.T.<computed> (/home/lumen/Projects/Task Cockpit/.vscode-test/vscode-linux-x64-1.86.2/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:147:3008)
        //     //     at r.$ (/home/lumen/Projects/Task Cockpit/.vscode-test/vscode-linux-x64-
        //     this.#onDidChangeTreeData.fire(); // сигнал: перестрой дерево в "пустое" состояние
        // }
        // catch { /* no-op */ }

        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel.trace(`[${this.constructor.name}] disposed`);

    }


    /** Полный сброс состояния с последующей перестройкой дерева.
     *
     * Инвалидирует кеши и устанавливает `#topElements = null`
     * (ленивое перестроение при следующем `getChildren`).
     * Уведомляет VS Code через `onDidChangeTreeData.fire()`. */
    public rebuild(originNodes: Immutable<Array<OriginNode>>): void {

        if (this.isInoperable) { return; }

        this.#treeItemByRunnableElement = new WeakMap();
        this.#runnableElementIndex = new Map();
        this.#originNodes = originNodes;
        this.#cachedTopElements = null;

        this.#onDidChangeTreeData.fire();
    }

    /** Точечное обновление уже рендеренного {@linkcode RunnableElement}.
     * Элемент обновит свое состояние на основе текущего runtime stats.
     *
     * Уведомляет VS Code через `onDidChangeTreeData.fire(element)` —
     * VS Code перезапросит `getTreeItem` только для этого узла.
     *
     * Если `getTreeItem` ещё не вызывался для `(originKey, taskName)`,
     * то элемент не зарегистрирован в индексе — вызов игнорируется. */
    public notifyRunnableChanged(originKey: OriginKey, taskName: TaskName): void {

        if (this.isInoperable) { return; }

        const runnableElement = this.#runnableElementIndex.get(originKey)?.get(taskName);
        if (!runnableElement) { return; }

        this.#onDidChangeTreeData.fire(runnableElement);
    }


    public getRunnableItemStatus(element: Immutable<RunnableElement>) {
        const treeItem = this.#treeItemByRunnableElement.get(element);
        if (!treeItem) {
            return undefined;
        }
        return {
            isRunning: treeItem.contextValue?.includes(':Running') ?? false,
            isBroken: treeItem.contextValue?.includes(':Broken') ?? false,
            hasTerminals: treeItem.contextValue?.includes(':Terminals') ?? false
        };
    }


    /**
     * @throws { CancellationError }
     * */
    public async getTreeItem(element: Immutable<Element>): Promise<TreeItem> {

        this.#cancelIfInoperable();

        // Синтетические узлы
        if (Element.isSynthetic(element)) {

            if (Element.isTopElement(element)) {
                return TopElement.createTreeItem(element);
            }

            if (Element.isEmptyElement(element)) {
                return EmptyElement.createTreeItem(element);
            }
        }

        if (Element.isRunnable(element)) {
            // runnable node -- узел несущий задачу
            return this.#getTreeItemForRunnableElement(element);
        }

        // чистый промежуточный узел
        return this.#getTreeItemForIntermediateElement(element);

    }


    /**
     * @throws { CancellationError }
     * */
    async #getTreeItemForRunnableElement(element: Immutable<RunnableElement>): Promise<TreeItem> {

        const taskOrigin = element.branchKey;
        const taskName = element.data.taskName;

        this.#registerRunnableElement(element, taskOrigin, taskName);

        // Для оптимизации при частом обновлении runtime-состояния — кеширую treeItem
        const cachedTreeItem = await this.#getOrCreateCachedTreeItem(element, taskOrigin, taskName);

        this.#cancelIfInoperable();

        // Обновить cachedTreeItem на основе runtime stats
        RunnableElement.applyRuntimeState(
            cachedTreeItem,
            this.#taskProcessRegistry.getTaskProcessStates(taskOrigin, taskName)
        );

        return cachedTreeItem;
    }

    // регистрация runnable-элемента по идентификатору,
    // если еще не зарегистрирован.
    #registerRunnableElement(element: Immutable<RunnableElement>, originKey: OriginKey, taskName: TaskName): void {

        let elementsByTask = this.#runnableElementIndex.get(originKey);

        if (!elementsByTask) {
            elementsByTask = new Map();
            this.#runnableElementIndex.set(originKey, elementsByTask);
        }

        // один и тот же объект element для одного ключа в пределах одного цикла rebuild
        if (!elementsByTask.has(taskName)) {
            elementsByTask.set(taskName, element);
        }
    }

    /**
     * @throws { CancellationError }
     * */
    async #getOrCreateCachedTreeItem(element: Immutable<RunnableElement>, originKey: OriginKey, taskName: TaskName): Promise<TreeItem> {

        let cachedTreeItem = this.#treeItemByRunnableElement.get(element);
        if (cachedTreeItem) {
            return cachedTreeItem;
        }

        const runnableElementToTreeItem = this.#treeItemByRunnableElement;
        // Не зарегистрированный TreeItem — первый вызов getTreeItem()
        // для этого element.

        // может быть falsy для X? -- нет:
        // Х вне валидных origins не должны попадать в дерево.

        try {
            // resourceStateCoordinator отклонит getTaskBundle если будет диспознут в процессе
            const taskBundle = await this.#resourceProps.resourceStateCoordinator.getTaskBundle(originKey, taskName);

            this.#cancelIfInoperable();

            // Stale-check. rebuild() мог вызваться во время await и заменить WeakMap —
            // если так, не кешируем: элемент уже не актуален.
            if (runnableElementToTreeItem !== this.#treeItemByRunnableElement) {
                this.#logOutputChannel.trace('Stale cache detected; cancelling getTreeItem.');
                throw new CancellationError();
            }

            cachedTreeItem = RunnableElement.createTreeItem(
                element,
                taskBundle
            );

            runnableElementToTreeItem.set(element, cachedTreeItem);

            return cachedTreeItem;
        }
        catch (err) {
            if (err instanceof CancellationError) { throw err; }
            this.#handleErrorAndCancel('Failed; cancelling getTreeItem.', err);
        }
    }

    /**
     * @throws { CancellationError }
     * */
    async #getTreeItemForIntermediateElement(element: Immutable<IntermediateElement>): Promise<TreeItem> {
        try {
            // resourceStateCoordinator отклонит getResourceConfig если будет диспознут в процессе
            const nodeConfig = (await this.#resourceProps.resourceStateCoordinator.getResourceConfig(element.branchKey));

            this.#cancelIfInoperable();

            return IntermediateElement.createTreeItem(element, nodeConfig);
        }
        catch (err) {
            if (err instanceof CancellationError) { throw err; }
            this.#handleErrorAndCancel('Failed; cancelling getTreeItem.', err);
        }
    }


    getChildren(element?: Immutable<Element>): Immutable<Array<Element>> | null {

        if (this.isInoperable) { return null; }

        if (!element) { // сначала дерево заполняется "top-узлами"

            this.#onWillRefreshTopElements.fire();
            if (this.isInoperable) { return null; }

            const topElements = this.#rebuildTopElements();

            this.#onDidRefreshTopElements.fire();
            if (this.isInoperable) { return null; }

            return topElements;
        }

        if (Element.isSynthetic(element)) {

            if (Element.isTopElement(element)) {
                if (element.children.length > 0) {
                    return element.children;
                }
                return [
                    EmptyElement.create(
                        element.branchKey,
                            /*id*/ element.branchKey + '_empty_node', // безопасно поскольку всегда единственный в секции
                        element.tasksSummary
                    )
                ];
            }

            if (Element.isEmptyElement(element)) {
                assert.fail('EmptyNode is a leaf, getChildren should not be called');
            }
        }

        return element.children;
    }

    #rebuildTopElements(): Immutable<Array<Element>> {

        if (this.#cachedTopElements) {
            // "это" дерево уже строилось
            return this.#cachedTopElements;
        }

        const topElements: Array<Immutable<TopElement>> = [];

        if (this.#originNodes.length > 0) {
            // если есть что строить
            for (const scopeData of this.#originNodes) { // @fixme scopeData -> originNode
                topElements.push(TopElement.create(scopeData));
            }
        }

        this.#cachedTopElements = topElements;
        return topElements;
    }


    public async resolveTreeItem(item: TreeItem, element: Immutable<Element>, token: CancellationToken): Promise<TreeItem> {

        this.#cancelIfInoperable();

        if (Element.isSynthetic(element)) {

            if (Element.isTopElement(element)) {
                return TopElement.resolveTreeItem(item, element, token);
            }

            if (Element.isEmptyElement(element)) {
                return EmptyElement.resolveTreeItem(item, element, token);
            }

        }

        if (Element.isRunnable(element)) {

            try {
                const taskBundle = await this.#resourceProps.resourceStateCoordinator.getTaskBundle(element.branchKey, element.data.taskName);

                this.#cancelIfInoperable();

                return RunnableElement.resolveTreeItem(
                    item,
                    element,
                    taskBundle,
                    token
                );
            }
            catch (err) {
                this.#handleErrorAndCancel('Failed; cancelling resolveTreeItem.', err);
            }
        }

        return IntermediateElement.resolveTreeItem(item, element, token);

    }


    // заглушка
    public getParent(_element: Immutable<Element>) {
        return null;
    };

    // ---------------------------------------------------------------------------

    /** Текущий список top-элементов дерева, или `null` если:
     * - провайдер (или одна из зависимостей) disposed
     * - после `fullUpdate()` VS Code ещё не запросил `getChildren(undefined)` */
    // @todo стоит сделать асинхронным и ждать onDidUpdateTopElements?
    // да! -? 8(
    public get topElements(): Immutable<Array<TopElement>> | null {

        if (this.isInoperable) { return null; }

        return this.#cachedTopElements;
    }


    // ---------------------------------------------------------------------------
    get isInoperable(): boolean {

        if (this.#disposed) {
            return true;
        }

        const dependenciesDisposed =
            this.#resourceProps.resourceStateCoordinator.disposed ||
            this.#taskProcessRegistry.disposed;

        if (dependenciesDisposed) {
            this.#logOutputChannel.warn(`[${this.constructor.name}] External dependencies are disposed`);
            return true;
        }

        return false;
    }

    /**
     * @throws { CancellationError }
     * */
    #cancelIfInoperable(): void {
        if (this.isInoperable) {
            this.#logOutputChannel.trace(`${this.constructor.name} or its dependencies are disposed; cancelling operation`);
            throw new CancellationError();
        }
    }


    /**
     * @throws { CancellationError }
     * */
    #handleErrorAndCancel(message: string, error: unknown): never {
        this.#logOutputChannel.error(message, error);
        throw new CancellationError();
    }

}

export default TaskTreeDataProvider;
