/** @file extension/CommandHandlers.ts */

import {
    commands,
    Task,
    tasks,
    Uri,
    window
} from 'vscode';
import {
    EXTENSION,
    PROJECT_TREE,
    SETTING,
    USER_TREE
} from '../tokens';
import AsyncQueue from '../utils/AsyncQueue';
import Element from '../TreeViewPanel/TreeView/Element/Element';
import openTaskDefinitionInEditor from '../TasksSource/openTaskDefinitionInEditor';
import showPickTerminal from './showPickTerminal';

import type {
    ExtensionContext
} from 'vscode';
import type {
    CommandKey
} from '../tokens';
import type EligibleTask from '../ResourceStateCoordinator/EligibleTask/EligibleTask';
import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type LogOutputChannel from './LogOutputChannel';
import type Services from './Services';
import type TreeView from '../TreeViewPanel/TreeView/TreeView';


function createTaskLaunchQueue(logOutputChannel: LogOutputChannel) {

    const asyncQueue = AsyncQueue.create(logOutputChannel);

    return {
        async runTask(eligibleTask: Immutable<EligibleTask>): Promise<void> {
            await asyncQueue.enqueue(async () => {
                try {
                    await tasks.executeTask(eligibleTask as unknown as Task);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }

            });
        }
    };
}


function resolveRunnableElement(
    arg: Immutable<Element> | undefined,
    treeView: LifecycleOmitted<TreeView>
): Immutable<Element.Runnable> | undefined {

    const element =
        arg
            ? arg
            : treeView.getSelection();

    if (!element) { return undefined; }// если нет выделения
    if (Element.isSynthetic(element)) { return undefined; }
    if (!Element.isRunnable(element)) { return undefined; }

    return element;
}


function resolveRunnableElementWithGuard(
    arg: Immutable<Element> | undefined,
    treeView: LifecycleOmitted<TreeView> | null,
    guard: (status: TreeView.RunnableItemStatus) => boolean
): Immutable<Element.Runnable> | undefined {
    if (!treeView) { return undefined; }
    const element = resolveRunnableElement(arg, treeView);
    if (!element) { return undefined; }
    const status = treeView.getRunnableItemStatus(element);
    if (!status) { return undefined; }
    if (!guard(status)) { return undefined; }
    return element;
}


function create(
    context: ExtensionContext,
    services: Readonly<Services>,
    logOutputChannel: LogOutputChannel
): Readonly<Record<
    CommandKey,
    (...args: never[]) => unknown
>> {


    const taskLaunchQueue = createTaskLaunchQueue(logOutputChannel);


    async function runTaskForElement(element: Immutable<Element.Runnable>) {
        try {
            const taskBundle = await services.resourceStateCoordinator?.getTaskBundle(
                element.branchKey, element.data.taskName
            );
            const eligibleTask = taskBundle?.eligibleTask ?? null;
            if (!eligibleTask) { return; }
            await taskLaunchQueue.runTask(eligibleTask);
        }
        catch {
            /* no-op */
        }
    }


    async function navigateToTerminal(element: Immutable<Element.Runnable>): Promise<void> {
        try {
            const taskProcesses = await services.taskProcessLifecycle?.getTaskProcessRecords(
                element.branchKey, element.data.taskName
            );
            if (!taskProcesses || taskProcesses.length < 1) { return; }
            if (taskProcesses.length === 1) {
                taskProcesses.at(0)!.terminalRef.deref()?.show();
                return;
            }
            const terminalRef = await showPickTerminal(element.data.taskLabel, taskProcesses);
            terminalRef?.deref()?.show();
        }
        catch {
            /* no-op */
        }
    }


    function abortAllInstances(element: Immutable<Element.Runnable>): void {
        services.taskProcessLifecycle?.terminateTaskProcesses(element.branchKey, element.data.taskName);
    }


    return {

        async [USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.globalTreeView, (s) => s.hasTerminals);
            if (!element) { return; }
            await navigateToTerminal(element);
        },

        async [PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.projectTreeView, (s) => s.hasTerminals);
            if (!element) { return; }
            await navigateToTerminal(element);
        },

        async [PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID](arg: Immutable<Element> | undefined) {
            const projectTreeView = services.projectTreeView;
            if (!projectTreeView) { return; };
            const element = resolveRunnableElement(arg, projectTreeView);
            if (!element) { return; };

            try {

                const taskSource = await services.resourceStateCoordinator?.resolveTaskSource(element.branchKey);

                if (!taskSource) { return; };

                try {
                    await openTaskDefinitionInEditor(taskSource, element.data.taskName);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }

            }
            catch { /* no-op */ }
        },

        async [PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID](arg: Immutable<Element> | undefined) {
            const element =
                arg
                    ? arg
                    : services.projectTreeView?.getSelection();

            if (!element) { return; } // если нет выделения

            try {

                const taskSource = await services.resourceStateCoordinator?.resolveTaskSource(element.branchKey);

                if (!taskSource) { return; };

                try {
                    return await commands.executeCommand('vscode.open', taskSource.uri);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }
            }
            catch { /* no-op */ }
        },

        async [USER_TREE.COMMAND.TASK_RUN.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.globalTreeView, (s) => !s.isBroken && !s.isRunning);
            if (!element) { return; }
            await runTaskForElement(element);
        },

        async [PROJECT_TREE.COMMAND.TASK_RUN.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.projectTreeView, (s) => !s.isBroken && !s.isRunning);
            if (!element) { return; }
            await runTaskForElement(element);
        },

        async [USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.globalTreeView, (s) => !s.isBroken && s.isRunning);
            if (!element) { return; }
            await runTaskForElement(element);
        },

        async [PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.projectTreeView, (s) => !s.isBroken && s.isRunning);
            if (!element) { return; }
            await runTaskForElement(element);
        },

        [USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.globalTreeView, (s) => s.isRunning);
            if (!element) { return; }
            abortAllInstances(element);
        },

        [PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID](arg: Immutable<Element> | undefined) {

            const element = resolveRunnableElementWithGuard(arg, services.projectTreeView, (s) => s.isRunning);
            if (!element) { return; }
            abortAllInstances(element);
        },

        async [EXTENSION.COMMAND.FULL_REFRESH.ID]() {
            try {
                await services.resourceStateCoordinator?.forceFullRefresh();
            }
            catch (err) {
                window.showErrorMessage(String(err));
            }
        },

        async [EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.ID]() {
            try {
                await commands.executeCommand(
                    'workbench.action.openGlobalSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.FILTERING).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch {
                /* no-op */
            }
        },

        async [EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.ID]() {
            try {
                await commands.executeCommand(
                    'workbench.action.openWorkspaceSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.FILTERING).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch {
                /* no-op */
            }
        },

        async [EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.ID]() {
            try {
                await commands.executeCommand(
                    'workbench.action.openGlobalSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.DISPLAY).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch {
                /* no-op */
            }
        },

        async [EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.ID]() {
            try {
                await commands.executeCommand(
                    'workbench.action.openWorkspaceSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.DISPLAY).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch {
                /* no-op */
            }
        },

        async [EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.ID]() {
            try {
                await commands.executeCommand(
                    'workbench.action.openWorkspaceSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} @id:${SETTING.FILTERING.EXCLUDE_FOLDERS}`
                });
            }
            catch {
                /* no-op */
            }
        },

        async [USER_TREE.COMMAND.LIST_FIND.ID]() {
            try {
                await commands.executeCommand(`${USER_TREE.ID}.focus`);
                await commands.executeCommand('list.find');
            }
            catch {
                /* no-op */
            }
        },

        async [PROJECT_TREE.COMMAND.LIST_FIND.ID]() {
            try {
                await commands.executeCommand(`${PROJECT_TREE.ID}.focus`);
                await commands.executeCommand('list.find');
            }
            catch {
                /* no-op */
            }
        },

        async [EXTENSION.COMMAND.FULL_REFRESH__NAVIGATION.ID]() {
            await commands.executeCommand(EXTENSION.COMMAND.FULL_REFRESH.ID);
        },

        [PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID]() {
            services.projectTreeView?.expandAll();
        },

        [USER_TREE.COMMAND.LIST_EXPAND_ALL.ID]() {
            services.globalTreeView?.expandAll();
        },

        [USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID]() {
            services.globalTreeView?.collapseAll();
        },

        [PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID]() {
            services.projectTreeView?.collapseAll();
        },

        async [USER_TREE.COMMAND.OPEN_USER_TASKS.ID]() {
            try {
                await commands.executeCommand('workbench.action.tasks.openUserTasks');
            }
            catch {
                /* no-op */
            }
        },

        [EXTENSION.COMMAND.FULL_REFRESH__SPINNER.ID]() { },

        async [USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.ID]() {
            await commands.executeCommand(USER_TREE.COMMAND.OPEN_USER_TASKS.ID);
        },

        async [PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.ID](arg: Immutable<Element> | undefined) {
            await commands.executeCommand(PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID, arg);
        },

        async [EXTENSION.COMMAND.OPEN_HELP_PAGE.ID]() {
            const { version } = context.extension.packageJSON as { version?: string; };
            try {
                await commands.executeCommand('vscode.open', Uri.from({
                    scheme: 'https',
                    authority: 'github.com',
                    path: `/papio-dev/task-cockpit/tree/${version ? `v${version}` : 'main'}`,
                    query: 'tab=readme-ov-file',
                    fragment: 'configuration'
                }));
            }
            catch {
                /* no-op */
            }
        }

    };

}


const CommandHandlers = {
    create
};

type CommandHandlers = ReturnType<typeof create>;

export default CommandHandlers;
