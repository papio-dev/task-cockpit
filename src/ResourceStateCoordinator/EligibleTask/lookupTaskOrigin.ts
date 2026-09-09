/** @file ResourceStateCoordinator/EligibleTask/lookupTaskOrigin.ts */

import { TaskScope } from 'vscode';
import OriginKey from '../../OriginKey';

import type EligibleTask from './EligibleTask';
import type Immutable from '../../utils/Immutable';
import type TaskDefinitionMap from '../TaskDefinition/TaskDefinitionMap';


/**  Восстанавливает происхождение рантайм-задачи (OriginKey) по контексту её выполнения
 * и карте доступных определений.
 *
 * @remarks
 * Поле `scope` (`vscode.Task.scope`, `EligibleTask.scope`) — это *контекст выполнения* рантайм-задачи, а не её происхождение.
 * VS Code не поддерживает виртуальный или глобальный контекст: каждая задача
 * выполняется либо в контексте рабочего пространства, либо в контексте
 * конкретной папки проекта. В VS Code API нет концепции "область-происхождения".
 * @remarks
 * Поле `source` — это *механизм, породивший задачу*. Тоже не про "откуда".
 * @remarks
 * Рантайм-задачи порожденные из User-настроек и из code-workspace-файлов получают одинаковый
 * `scope === TaskScope.Workspace` — обе привязываются к *первой папке проекта*
 * как к synthetic execution context. Поэтому значение поля `scope` само по себе не раскрывает происхождение задачи;
 * оно восстанавливается через `taskDefinitions` по эмпирически подтверждённому порядку затенения: USER → WORKSPACE.
 * @remarks
 * `TaskScope.Global` (= 1) зарезервирован в API, но реально не используется —
 * задач с таким execution scope VS Code не порождает (расширения могут — но нам не интересно).
 * @remarks
 * Для folder-задач контекст выполнения совпадает с происхождением:
 * поле `scope` содержит `WorkspaceFolder`, URI которой и является OriginKey.
 *
 * @returns
 * `OriginKey` если задачу удалось сопоставить определению.
 *  null — не удалось установить происхождение.
 * */
function lookupTaskOrigin(
    eligibleTask: Immutable<EligibleTask>,
    taskDefinitions: Immutable<Map<OriginKey, TaskDefinitionMap>>
): OriginKey | null {

    const scope = eligibleTask.scope;

    if (scope === TaskScope.Global) { return null; }

    if (scope === TaskScope.Workspace) {

        if (taskDefinitions.get(OriginKey.USER)?.get(eligibleTask.name)?.effective) {
            return OriginKey.USER;
        }
        else if (taskDefinitions.get(OriginKey.WORKSPACE)?.get(eligibleTask.name)?.effective) {
            return OriginKey.WORKSPACE;
        }

        return null;
    }

    const folderKey = scope.uri.toString() as OriginKey.Folder;

    if (taskDefinitions.get(folderKey)?.get(eligibleTask.name)?.effective) {
        return folderKey;
    }

    return null;
}


export default lookupTaskOrigin;
