/** @file TreeViewPanel/TreeView/Element/RunnableElement.ts */

import {
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    Uri
} from 'vscode';
import { UI } from '../../../tokens';
import * as assert from 'node:assert/strict';
import formatTooltip from '../formatTooltip';

import type {
    CancellationToken,
    TreeItem
} from 'vscode';
import type Branch from '../../Branch';
import type ContextValue from '../ContextValue';
import type EligibleTask from '../../../ResourceStateCoordinator/EligibleTask/EligibleTask';
import type Immutable from '../../../utils/Immutable';
import type OriginKey from '../../../OriginKey';
import type ProcessState from '../../../Runtime/ProcessState';
import type TaskBundle from '../../../ResourceStateCoordinator/TaskBundle';
import type TaskDefinition from '../../../ResourceStateCoordinator/TaskDefinition/TaskDefinition';
import type TaskNodeData from '../../TaskNodeData';
import type TaskProcessId from '../../../Runtime/TaskProcessId';
import type UriQuery from '../../../FileDecorationProvider/UriQuery';
import type UriSchema from '../../../FileDecorationProvider/UriSchema';


type RunnableElement = Branch.Element.Data<OriginKey, TaskNodeData>;

interface RuntimeState {

    /** Общее количество процессов у задачи */
    total: number;

    /** Процессы задачи в состоянии выполнения */
    running: number;
}


/** Создаёт {@link TreeItem} для узла содержимого.
 *     */
function createTreeItem(
    element: Immutable<RunnableElement>,
    taskBundle: Immutable<TaskBundle>
): TreeItem {


    // Цвет окраски label:
    // 'list.invalidItemForeground' — если taskDefinition=null или
    // hasEligibleTask=false.
    // Иначе, если conf.tintLabel=true, то из taskDefinition.icon?.color ?? ''.
    // Пустая строка — в остальных случаях.
    const tintColor = taskBundle.taskDefinition == null || taskBundle.eligibleTask == null
        ? UI.COLOR.INVALID
        : taskBundle.nodeConfig?.tintLabel
            ? taskBundle.taskDefinition.icon?.color ?? ''
            : '';

    const treeItem: TreeItem = {
        id: element.id,
        label: element.label,
        collapsibleState: buildCollapsibleState(element),
        description: buildDescription(taskBundle.taskDefinition),
        // статическая часть contextValue
        contextValue: buildContextValue(element.children != null, taskBundle),
        iconPath: buildIconPath(taskBundle.taskDefinition, taskBundle.nodeConfig, Boolean(taskBundle.eligibleTask)),
        // статическая часть resourceUri (только query color, если есть)
        resourceUri: buildResourceURI(tintColor)
    };

    return treeItem;
}


function applyRuntimeState(treeItem: TreeItem, taskState: Immutable<Map<TaskProcessId, ProcessState>> | undefined): TreeItem {

    const runtimeState: RuntimeState | null =
        taskState
            ? {
                total: taskState.size,
                running: countOfRunning(taskState)
            }
            : null;

    updateResourceUriQuery(treeItem, runtimeState);
    updateContextValue(treeItem, runtimeState);
    return treeItem;
}


function countOfRunning(taskState: Immutable<Map<TaskProcessId, ProcessState>>) {
    let running = 0;

    for (const state of taskState.values()) {
        if (state.running) {
            running++;
        }
    }
    return running;
}

function resolveTreeItem(
    item: TreeItem,
    element: Immutable<RunnableElement>,
    taskBundle: Immutable<{ // TaskBundle
        taskDefinition: TaskDefinition | null;
        eligibleTask: EligibleTask | null;
    }>,
    token: CancellationToken
): TreeItem {

    if (token.isCancellationRequested) { return item; }

    const taskLabel = element.data.taskLabel;

    if (!taskBundle.taskDefinition) {
        item.tooltip = formatTooltip(
            'Task',
            taskLabel,
            `$(${UI.ICON.ERROR}) Error: Task definition not found` // @todo
        );
        return item;
    }

    if (!taskBundle.eligibleTask) {
        item.tooltip = formatTooltip(
            'Task',
            taskLabel,
            `$(${UI.ICON.WARNING}) No task matches this definition`
        );
        return item;
    }

    item.tooltip = formatTooltip(
        'Task',
        taskLabel,
        taskBundle.eligibleTask.detail
    );

    return item;
}


// @todo from UserState
function buildCollapsibleState(element: Immutable<RunnableElement>) {
    return element.children == null ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed/* @todo */;
}


/** Формирует description-строку "(T1, T2, ..., Tn)" -
 * Где теги описывают саму "задачу" . свойства не состояние:
 * - Default — если у задачи поднят флаг "по умолчанию в своей группе"
 * - Background — если у задачи поднят флаг "isBackground"
 * - Hidden — если у задачи поднят флаг "hide" (увидят только если отключена фильтрация скрытых)
 *
 * По поводу Broken -- это скорее состояния самого узла "я показываю черти-что, а НЕ задачу".
 * А состояние задачи "такой задачи нет" выглядит слегка неправильно.
 *
 * Порядок тегов стабильный.
 * Description есть только у runnable-узлов сопоставленного задаче.
 * */
function buildDescription(
    definition: Immutable<TaskDefinition> | null
): string | false {

    if (!definition) {
        return false;
    }

    const strFlags: string[] = [];

    if (definition.group?.isDefault) {
        strFlags.push('Default');
    }

    if (definition.isBackground) {
        strFlags.push('Background');
    }

    if (definition.hidden) {
        strFlags.push('Hidden');
    }

    if (strFlags.length < 1) {
        return false;
    }

    return `(${strFlags.join(', ')})`;
}


// статическая часть contextValue
function buildContextValue(
    hasChildren: boolean,
    taskBundle: Immutable<{
        taskDefinition: TaskDefinition | null;
        eligibleTask: EligibleTask | null;
    }>
): ContextValue.Node.Runnable {

    return `:Node${hasChildren ? ':Group' : ''
        }:Runnable${taskBundle.taskDefinition === null
            ? ':Broken-NoDefinition'
            : taskBundle.eligibleTask === null
                ? ':Broken-NotExecutable'
                : ''
        }`;
}


function updateContextValue(
    treeItem: TreeItem,
    runtimeState: Immutable<RuntimeState> | null
): void {

    // изменяет contextValue на основе runtimeState.
    // Добавляет / удаляет флаги
    // `:Running` — если runtimeState.running (> / ==) 0
    // `:Terminals` — если runtimeState.total (> / ==) 0

    assert.ok(treeItem.contextValue, 'contextValue expected');

    let contextValue = treeItem.contextValue
        .replace(/:Running\b/g, '')
        .replace(/:Terminals\b/g, '');

    if (runtimeState && runtimeState.running > 0) {
        contextValue += ':Running';
    }
    if (runtimeState && runtimeState.total > 0) {
        contextValue += ':Terminals';
    }

    treeItem.contextValue = contextValue;
}


function buildIconPath(
    definition: Immutable<TaskDefinition> | null,
    nodeConfig: Immutable<TaskBundle['nodeConfig']> | null,
    hasEligibleTask: boolean
): ThemeIcon {

    if (!definition) {
        return new ThemeIcon(UI.ICON.ERROR, new ThemeColor(UI.COLOR.INVALID)); // @todo
    }

    // if (!hasEligibleTask) {
    //     return new ThemeIcon(UI.ICON.WARNING, new ThemeColor(UI.COLOR.INVALID));
    // }

    const iconId = definition.icon?.id ?? nodeConfig?.defaultIconName ?? UI.ICON.TASK_DEFAULT;
    const colorId =
        (hasEligibleTask)
            ? definition.icon?.color
            : UI.COLOR.INVALID;

    return new ThemeIcon(iconId, colorId ? new ThemeColor(colorId) : undefined);
}


function buildResourceURI(
    tintColor: string
): Uri {
    return Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: (new URLSearchParams({
            available: '0',
            running: '0',
            tintColor
        } satisfies UriQuery)).toString()
    } satisfies UriSchema);
}


function updateResourceUriQuery(
    treeItem: TreeItem,
    runtimeState: Immutable<RuntimeState> | null
) {

    const resourceUri = treeItem.resourceUri;
    assert.ok(resourceUri);

    const params = new URLSearchParams(resourceUri.query);
    params.set('available', runtimeState?.total.toString() ?? '0');
    params.set('running', runtimeState?.running.toString() ?? '0');

    treeItem.resourceUri = resourceUri.with({ query: params.toString() });

}

const RunnableElement = {
    resolveTreeItem,
    createTreeItem,
    applyRuntimeState
} as const;


export default RunnableElement;
