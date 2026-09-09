import lookupTaskOrigin from './lookupTaskOrigin';

import type OriginKey from '../../OriginKey';
import type TaskName from '../../TaskName';
import type Immutable from '../../utils/Immutable';
import type TaskDefinitionMap from '../TaskDefinition/TaskDefinitionMap';
import type EligibleTask from './EligibleTask';
import type EligibleTasksMap from './EligibleTasksMap';

/** Группирует рантайм-задачи по источникам их определений через resolveTaskOrigin()
 * и строит Map<OriginKey, Map<TaskName, EligibleTask>>.
 *
 * Последняя задача с тем же именем перезаписывает предыдущую, что
 * соответствует поведению VS Code.
 * */
function groupEligibleTasks(
    eligibleTasks: Immutable<Array<EligibleTask>>,
    taskDefinitions: Immutable<Map<OriginKey, TaskDefinitionMap>>
): Immutable<Map<OriginKey, EligibleTasksMap>> {

    const map = new Map<OriginKey, Map<TaskName, Immutable<EligibleTask>>>();

    for (const eligibleTask of eligibleTasks) {

        const originKey = lookupTaskOrigin(eligibleTask, taskDefinitions);

        if (!originKey) {
            continue;
        }

        let taskMap = map.get(originKey);
        if (!taskMap) {
            taskMap = new Map();
            map.set(originKey, taskMap);
        }
        taskMap.set(eligibleTask.name, eligibleTask);

    }

    return map;
}


export default groupEligibleTasks;
