import {
    fetch,
} from './Registry/Fetch';
import * as Basic from './Basic';
import * as Runtime from './Runtime/Runtime';


export namespace Task {
    export type File = Basic.File;
    export type TaskID = Basic.TaskID;
    export type Name = Basic.Name;
    export type ProcessId = Basic.ProcessId;
    export type ProcessInfo = Runtime.ProcessInfo;
    export type Uri = Basic.Uri;
    export type UserTask = Basic.UserTask;
    export type Runtime = Runtime.Runtime;
}

export const Task = {
    computeUri: Basic.computeUri,
    fetch,
    fileFromTaskId: Basic.fileFromTaskId,
    idFromTask: Basic.idFromTask,
    idFromUri: Basic.idFromUri,
    isName: Basic.isName,
    jsonPath: Basic.jsonPath,
    Runtime: Runtime.Runtime,
    taskIdToString: Basic.taskIdToString,
};
