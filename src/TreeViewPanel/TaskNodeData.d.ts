/** @file TreeViewPanel/TaskNodeData.d.ts */

import TaskName from '../TaskName';

/** Данные узла-задачи в иерархии. */
interface TaskNodeData {
    [k: string]: unknown;
    taskLabel: string;
    taskName: TaskName;
}

export default TaskNodeData;
