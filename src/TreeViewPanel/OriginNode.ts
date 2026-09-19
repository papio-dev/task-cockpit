/** @file TreeViewPanel/OriginNode.ts */
/** @internal */

import { UI } from '../tokens';
import Branch from './Branch';
import Splitter from '../Splitter';

import type { Uri } from 'vscode';
import type OriginKey from '../OriginKey';
import type Immutable from '../utils/Immutable';
import type OriginEntry from '../ResourceStateCoordinator/OriginEntry';
import type TaskNodeData from './TaskNodeData';


/** Срез данных одной области происхождения (Origin), готовый для рендеринга в TreeView.
 *
 * `OriginNode` — корневой узел поддерева из одного Origin.
 *
 * ## OriginNode
 *
 * ### Поля:
 * - `originKey` — ключ области происхождения
 * - `displayName` — отображаемое имя области
 * - `taskSourceUri` — URI файла-источника задач (null для Origin.User)
 * - `taskSummary` — счётчики задач: total / hiddenCount / shadowedCount
 * - `hierarchy` — дерево задач для рендеринга в TreeView
 *
 * ### Типы
 * - `TaskNodeData` — Данные узла-задачи в иерархии
 *
 * ### Фабрика:
 * - `OriginNode.build(originEntry)` — строит OriginNode из OriginEntry */
interface OriginNode {

    /** Отображаемое имя области */
    displayName: string;

    /** Ветка задач данной области, готовое к рендерингу в TreeView.
      *
      * Результат группировки плоского списка эффективных определений задач по сегментам
      * (taskName и, опционально, group.kind) для последующего отображения. */
    branch: Branch<OriginKey, TaskNodeData>;

    /** Ключ области */
    originKey: OriginKey;

    /** URI файла-источника задач ассоциированного с данной областью (может не существовать физически).
     *
     * Для Origin.User всегда null. */
    taskSourceUri: Uri | null;

    /** Счётчики задач области. */
    taskCounts: {
        /** Число задач, включённых в иерархию. */
        totalCount: number;
        /** Число скрытых задач, отфильтрованных при `showHidden = false`. */
        hiddenCount: number;
        /** Суммарное число затенённых определений задач в области. */
        shadowedCount: number;
    };
}


const OriginNode = {

    /** Строит {@linkcode OriginNode} из {@linkcode OriginEntry}.
     *
     * Фильтрует и группирует определения задач в иерархию согласно настройкам
     * {@linkcode OriginEntry.hierarchyConfig}: сепаратор сегментов, группировка по group.kind,
     * видимость скрытых задач.
     *
     * @param originEntry Запись области происхождения с определениями и конфигурацией
     * @returns Иммутабельный {@linkcode OriginNode} с иерархией и счётчиками задач */
    build(originEntry: Immutable<OriginEntry>): Immutable<OriginNode> {

        const { segmentSeparator, groupByTaskGroup: useGroupKind, showHidden } = originEntry.hierarchyConfig;

        const splitter = Splitter.create(segmentSeparator);

        let totalCount = 0;
        let hiddenCount = 0;
        let shadowedCount = 0;

        const hierarchy = Branch.build({
            branchKey: originEntry.originKey,
            nodes:
                [...originEntry.definitionEntries].reduce((acc, [taskName, definitionEntry]) => {

                    const shadowedLength = definitionEntry.shadowed?.length ?? 0;
                    shadowedCount += shadowedLength;
                    const effective = definitionEntry.effective;
                    totalCount += shadowedLength + (effective ? 1 : 0);

                    if (!effective) {
                        return acc;
                    }

                    if (!showHidden && effective.hidden) {
                        ++hiddenCount;
                        return acc;
                    }

                    const groupKind = useGroupKind
                        ? effective.group?.kind
                        : undefined;

                    const path =
                        groupKind
                            ? [groupKind, ...splitter.split(taskName)]
                            : splitter.split(taskName);

                    const taskLabel = path.join(UI.DISPLAY_SEGMENT_SEPARATOR);

                    acc.push({
                        path, data: {
                            taskLabel,
                            taskName,
                            taskOrigin: originEntry.originKey,
                            taskSource: originEntry.taskSource
                        }
                    });

                    return acc;

                }, [] as Branch.Spec.Node<Immutable<TaskNodeData>>[])
        }, makeId);

        return {
            originKey: originEntry.originKey,
            displayName: originEntry.name,
            taskSourceUri: originEntry.taskSource?.uri ?? null,
            taskCounts: { totalCount, hiddenCount, shadowedCount },
            branch: hierarchy
        };

    }
};

const SEP = '\x00\xf1\x00';

function makeId(branchKey: string, parent: Branch.ElementBase<string> | undefined, segment: string): string {
    return parent ? `${parent.id}${SEP}${segment}` : `${branchKey}${SEP}${segment}`;
}

export default OriginNode;
