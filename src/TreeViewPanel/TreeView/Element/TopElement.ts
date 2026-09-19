/** @file TreeViewPanel/TreeView/Element/TopElement.ts */

import {
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import type ContextValue from '../ContextValue';
import RunnableElement from './RunnableElement';
import IntermediateElement from './IntermediateElement';
import OriginKey from '../../../OriginKey';
import Immutable from '../../../utils/Immutable';
import type OriginNode from '../../OriginNode';
import { UI } from '../../../tokens';


interface TopElement {
    kind: 'TopNode';
    label: string;
    resourceUri: Uri;
    branchKey: OriginKey;
    originTag: 'User' | 'Workspace' | 'Folder';
    tasksSummary: {
        totalCount: number;
        hiddenCount: number;
        shadowedCount: number;
    };
    children: ReadonlyArray<RunnableElement | IntermediateElement>;
};


function create(originData: Immutable<OriginNode>): Immutable<TopElement> {
    return {
        kind: 'TopNode',
        label: originData.displayName,
        resourceUri: originData.taskSourceUri ?? Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: ''
        }),
        branchKey: originData.originKey,
        originTag:
            originData.originKey === OriginKey.USER
                ? 'User'
                : originData.originKey === OriginKey.WORKSPACE
                    ? 'Workspace'
                    : 'Folder',
        tasksSummary: originData.taskCounts,
        children: originData.branch
    };
}

/** Создаёт {@linkcode TreeItem} для корневого узла области рабочего пространства.
 *
 * Иконка:
 * - `layers` — рабочее пространство
 * - `root-folder` — папка
 *
 * Состояние: всегда развёрнут // @todo
 *
 * `resourceUri` — файл-источник задач (не обязан существовать)
 *
 * `contextValue`: `task-cockpit:Section:Scope:(Global|Workspace|Folder)` */
function createTreeItem(element: Immutable<TopElement>): TreeItem {

    return {
        collapsibleState: TreeItemCollapsibleState.Expanded, // @todo
        contextValue: buildContextValue(element.branchKey),
        description: false,
        iconPath: getIcon(element.branchKey),
        id: element.branchKey,
        label: element.label,
        resourceUri: element.resourceUri
    } as const;
};


/** Дополняет элемент-секцию всплывающей подсказкой.
 *
 * Вызывается средой лениво.
 *
 * Если операция отменена, возвращает элемент без изменений. */
function resolveTreeItem(
    item: TreeItem,
    element: Immutable<TopElement>,
    token: CancellationToken
): TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    item.tooltip = formatTooltip(
        'Origin',
        element.label || '«unnamed»',
        element.tasksSummary ? `$(${UI.ICON.TASK_DEFAULT}) Tasks: ${formatTasksSummary(element.tasksSummary)}` : undefined
    );

    return item;
};


/** Форматирует краткую сводку по видимости задач
 * для отображения во всплывающей подсказке.
 *
 * Обрабатываются четыре ситуации:
 * - В области нет задач
 * - Все задачи скрыты
 * - Часть задач скрыта (отображается количество видимых и скрытых)
 * - Нет скрытых задач (отображается общее количество) */
function formatTasksSummary(detail: TopElement['tasksSummary']): string {

    if (detail.totalCount === 0) {
        return '*None in this scope*';
    }

    const displayed = detail.totalCount - detail.hiddenCount - detail.shadowedCount;

    const qualifiers: string[] = [];
    if (detail.hiddenCount > 0) {
        qualifiers.push(`hidden: \`${detail.hiddenCount}\``);
    }
    if (detail.shadowedCount > 0) {
        qualifiers.push(`shadowed: \`${detail.shadowedCount}\``);
    }
    const suffix = qualifiers.length > 0 ? ` (${qualifiers.join(', ')})` : '';

    if (displayed === 0) {
        return `*All hidden*${suffix}`;
    }

    return `\`${displayed}\`${suffix}`;
}

function buildContextValue(originKey: OriginKey): ContextValue.Section {

    if (originKey === OriginKey.USER) {
        return ':Section:Global:Group' satisfies ContextValue.Section;
    }
    else if (originKey === OriginKey.WORKSPACE) {
        return ':Section:Workspace:Group' satisfies ContextValue.Section;
    }

    return ':Section:Folder:Group' satisfies ContextValue.Section;
}


function getIcon(originKey: OriginKey): ThemeIcon {

    if (originKey === OriginKey.USER) {
        return new ThemeIcon(UI.ICON.USER_ORIGIN);
    }
    else if (originKey === OriginKey.WORKSPACE) {
        return new ThemeIcon(UI.ICON.WORKSPACE_ORIGIN);
    }

    return new ThemeIcon(UI.ICON.FOLDER_ORIGIN);

}


const TopElement = {
    create,
    resolveTreeItem,
    createTreeItem
} as const;


export default TopElement;
