/** @file extension/Services.ts */

import {
    commands,
    Disposable,
    window
} from 'vscode';
import AsyncQueue from '../utils/AsyncQueue';
import DiagnosticsManager from '../TasksSource/Diagnostics/DiagnosticsManager';
import FileDecorationProvider from '../FileDecorationProvider/FileDecorationProvider';
import IdleTracker from './IdleTracker';
import OriginNode from '../TreeViewPanel/OriginNode';
import ResourceStateCoordinator from '../ResourceStateCoordinator/ResourceStateCoordinator';
import TaskProcessLifecycle from '../Runtime/TaskProcessLifecycle';
import TreeView from '../TreeViewPanel/TreeView/TreeView';
import WindowSettings from '../WindowSettings/WindowSettings';
import {
    EXTENSION,
    PROJECT_TREE,
    USER_TREE
} from '../tokens';

import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type OriginEntriesSnapshot from '../ResourceStateCoordinator/OriginEntriesSnapshot';
import type OriginEntry from '../ResourceStateCoordinator/OriginEntry';
import type LogOutputChannel from './LogOutputChannel';


class Services {

    // (не)тротлинг между onDidChange’сами
    static readonly #DEBOUNCE_MS: number = 25;

    // ------------------------------------------------------------------
    readonly #diagnosticsManager: DiagnosticsManager;
    readonly #fileDecorationProvider: FileDecorationProvider;
    readonly #globalTreeView: TreeView;
    readonly #projectTreeView: TreeView;
    readonly #resourceStateCoordinator: ResourceStateCoordinator;
    readonly #taskProcessLifecycle: TaskProcessLifecycle;
    readonly #windowSettings: WindowSettings;
    // ------------------------------------------------------------------

    #logOutputChannel: LifecycleOmitted<LogOutputChannel>;

    #disposed: boolean;
    #disposables: Disposable[];

    readonly #asyncQueue: AsyncQueue;

    #debounceTimer: NodeJS.Timeout | null;
    #idleTracker: IdleTracker<'resourceStateCoordinator' | 'windowSettings' | 'updateTrees'>;

    private constructor(
        diagnosticsManager: DiagnosticsManager,
        fileDecorationProvider: FileDecorationProvider,
        globalTreeView: TreeView,
        projectTreeView: TreeView,
        resourceStateCoordinator: ResourceStateCoordinator,
        taskProcessLifecycle: TaskProcessLifecycle,
        windowSettings: WindowSettings,
        logOutputChannel: LogOutputChannel
    ) {

        this.#disposed = false;
        this.#disposables = [];

        this.#logOutputChannel = logOutputChannel;

        this.#diagnosticsManager = diagnosticsManager;
        this.#fileDecorationProvider = fileDecorationProvider;
        this.#globalTreeView = globalTreeView;
        this.#projectTreeView = projectTreeView;
        this.#resourceStateCoordinator = resourceStateCoordinator;
        this.#taskProcessLifecycle = taskProcessLifecycle;
        this.#windowSettings = windowSettings;

        this.#asyncQueue = AsyncQueue.create(logOutputChannel);

        const fdpSubscription = window.registerFileDecorationProvider(this.#fileDecorationProvider);


        this.#resourceStateCoordinator.onDidScheduleUpdate(this.#resourceStateCoordinatorScheduleUpdateHandler, this, this.#disposables);

        this.#resourceStateCoordinator.onDidCompleteUpdate(this.#resourceStateCoordinatorCompleteUpdateHandler, this, this.#disposables);

        this.#windowSettings.onDidScheduleUpdate(this.#windowSettingsScheduleUpdateHandler, this, this.#disposables);

        this.#windowSettings.onDidCompleteUpdate(this.#windowSettingsCompleteUpdateHandler, this, this.#disposables);

        this.#debounceTimer = null;

        this.#idleTracker = new IdleTracker(['resourceStateCoordinator', 'windowSettings', 'updateTrees'], true);

        this.#idleTracker.onDidIdleChange((isIdle) => {
            void this.#asyncQueue.enqueue(async () => {
                await commands.executeCommand('setContext', EXTENSION.WHEN.IS_IDLE, isIdle);
            });
        }, undefined, this.#disposables);

        this.#disposables.push(
            // - подписки уже тут -
            fdpSubscription,
            this.#idleTracker,
            // Зависимые — раньше базовых
            this.#globalTreeView,
            this.#projectTreeView,
            this.#diagnosticsManager,
            this.#fileDecorationProvider,
            this.#taskProcessLifecycle,
            this.#windowSettings,
            // Базовый — последним
            this.#resourceStateCoordinator
        );

    }


    public dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        if (this.#debounceTimer !== null) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#disposables.forEach((d) => void d.dispose());

        void this.#asyncQueue.enqueue(async () => {
            await commands.executeCommand('setContext', EXTENSION.WHEN.IS_IDLE, undefined);
            await commands.executeCommand('setContext', EXTENSION.WHEN.ALL_FOLDERS_EXCLUDED, undefined);
        });

        this.#logOutputChannel.trace('services disposed');
    }

    /**
 * @throws { Error } Выбрасывает наверх ошибки {@linkcode ResourceStateCoordinator.create}
 * */
    static async create(displayName: string, timeoutMs: number, logOutputChannel: LogOutputChannel): Promise<Services> {

        const windowSettings = new WindowSettings(logOutputChannel);
        const resourceStateCoordinator = await ResourceStateCoordinator.create(timeoutMs, logOutputChannel);
        const resourceProps = { windowSettings, resourceStateCoordinator };
        const taskProcessLifecycle = new TaskProcessLifecycle(resourceProps, logOutputChannel);
        const fileDecorationProvider = new FileDecorationProvider(resourceProps, logOutputChannel);
        const diagnosticsManager = new DiagnosticsManager(displayName, resourceProps, logOutputChannel);

        const globalTreeView = new TreeView(
            USER_TREE.ID,
            USER_TREE.NAME,
            resourceProps,
            taskProcessLifecycle.taskProcessRegistry,
            logOutputChannel
        );

        const projectTreeView = new TreeView(
            PROJECT_TREE.ID,
            PROJECT_TREE.NAME,
            resourceProps,
            taskProcessLifecycle.taskProcessRegistry,
            logOutputChannel
        );

        return new Services(
            diagnosticsManager,
            fileDecorationProvider,
            globalTreeView,
            projectTreeView,
            resourceStateCoordinator,
            taskProcessLifecycle,
            windowSettings,
            logOutputChannel
        );

    }

    // #region


    public get diagnosticsManager(): LifecycleOmitted<DiagnosticsManager> | null {
        if (this.#diagnosticsManager.isInoperable) { return null; }
        return this.#diagnosticsManager;
    }

    public get fileDecorationProvider(): LifecycleOmitted<FileDecorationProvider> | null {
        if (this.#fileDecorationProvider.disposed) { return null; }
        return this.#fileDecorationProvider;
    }

    public get globalTreeView(): LifecycleOmitted<TreeView> | null {
        if (this.#globalTreeView.isInoperable) { return null; }
        return this.#globalTreeView;
    }

    public get projectTreeView(): LifecycleOmitted<TreeView> | null {
        if (this.#projectTreeView.isInoperable) { return null; }
        return this.#projectTreeView;
    }

    public get resourceStateCoordinator(): LifecycleOmitted<ResourceStateCoordinator> | null {
        if (this.#resourceStateCoordinator.disposed) { return null; }
        return this.#resourceStateCoordinator;
    }

    public get taskProcessLifecycle(): LifecycleOmitted<TaskProcessLifecycle> | null {
        if (this.#taskProcessLifecycle.isInoperable) { return null; }
        return this.#taskProcessLifecycle;
    }

    public get windowSettings(): LifecycleOmitted<WindowSettings> | null {
        if (this.#windowSettings.disposed) { return null; }
        return this.#windowSettings;
    }

    // #endregion

    // #region Handlers

    #resourceStateCoordinatorScheduleUpdateHandler() {

        if (this.#disposed) { return; }

        this.#idleTracker.markBusy('resourceStateCoordinator');
    }

    #resourceStateCoordinatorCompleteUpdateHandler() {

        if (this.#disposed) { return; }

        this.#idleTracker.markBusy('updateTrees');
        this.#idleTracker.markIdle('resourceStateCoordinator');

        this.#scheduleUpdate();
    }

    #windowSettingsScheduleUpdateHandler() {

        if (this.#disposed) { return; }

        this.#idleTracker.markBusy('windowSettings');
    }

    #windowSettingsCompleteUpdateHandler(affectedKeys: Immutable<WindowSettings.AffectedKeys>) {

        if (this.#disposed) { return; }

        const hasFiltering = affectedKeys.has('Filtering');

        if (hasFiltering) {
            this.#idleTracker.markBusy('updateTrees');
        }

        this.#idleTracker.markIdle('windowSettings');

        if (hasFiltering) {
            this.#scheduleUpdate();
        }
    }

    // #endregion


    // Coalesce: в очереди не больше одного pending-update одновременно.
    // #updatePending сбрасывается до getScopeEntries — чтобы новый onDidChange
    // мог вытеснить текущий цикл: #updateFromProjectState увидит флаг и выйдет досрочно.
    #scheduleUpdate(): void {

        if (this.#disposed) { return; }

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        let debounceTimer: NodeJS.Timeout;

        this.#debounceTimer = debounceTimer = setTimeout(() => {
            void this.#runScheduledUpdate(debounceTimer);
        }, Services.#DEBOUNCE_MS);

    }

    async #runScheduledUpdate(debounceTimer: NodeJS.Timeout): Promise<void> {

        if (this.#disposed) { return; }
        if (debounceTimer !== this.#debounceTimer) { return; }

        try {
            const originEntries = await this.#resourceStateCoordinator.getOriginEntries();

            if (this.#disposed) { return; }
            if (debounceTimer !== this.#debounceTimer) { return; }

            this.#debounceTimer = null;

            this.#updateTrees(originEntries);
            this.#idleTracker.markIdle('updateTrees');

        }
        catch (err) {
            // координатор disposed или стал inoperable — no-op
            if (this.#resourceStateCoordinator.disposed) { return; }
            this.#logOutputChannel.error(String(err));
            // idleTracker навсегда останется в busy
        }

    }


    #updateTrees(originEntries: Immutable<OriginEntriesSnapshot>) {

        this.#globalTreeView.rebuild([OriginNode.build(originEntries.User)]);

        const excluded = this.#windowSettings.getConfiguration('Filtering').excludeFolders;
        let excludedScopesCount = 0;

        const projectOrigins =
            originEntries.Workspace
                ? [originEntries.Workspace, ...originEntries.folders]
                : originEntries.folders;

        const filteredOrigins =
            excluded.size < 1
                ? projectOrigins
                : projectOrigins.reduce((acc, originEntry) => {
                    if (excluded.has(originEntry.name)) {
                        ++excludedScopesCount;
                    }
                    else {
                        acc.push(originEntry);
                    }
                    return acc;
                }, [] as Immutable<OriginEntry>[]);

        // отличаем "всё скрыто фильтром" от "папок вообще нет".
        const allFoldersExcluded = projectOrigins.length > 0 && filteredOrigins.length === 0;
        void this.#asyncQueue.enqueue(async () => {
            await commands.executeCommand('setContext', EXTENSION.WHEN.ALL_FOLDERS_EXCLUDED, allFoldersExcluded);
        });

        this.#projectTreeView.rebuild(
            filteredOrigins.map((originEntry) => OriginNode.build(originEntry)),
            excludedScopesCount
        );
    }

}


export default Services;
