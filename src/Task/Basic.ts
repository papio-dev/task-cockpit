import * as vscode from 'vscode';

declare const __TasksFile: unique symbol;
declare const __TasksFileUri: unique symbol;
declare const __TaskLabel: unique symbol;
declare const __Identity: unique symbol;


// export interface UserTask {
//     icon: string;
//     color?: string,
//     /** Флаг скрытия задачи из палитры задач */
//     hide?: boolean;
//     identity: ID;
// }


/** Номинальный тип для путей к файлам tasks.json.
 *
 * Обязательная часть "пути к задаче".
 *
 * Является строковым URI к файлу задач в области действия
 * задачи.
 * Так для задачи из области действия vscode.TaskScope.Workspace
 * это будет файл рабочей области: file://.../....code-workspace.
 * Для задач из каталога проекта это будет файл tasks.json из
 * file://.../.vscode/tasks.json.
 *
 * Это просто идентификатор, позволяющий однозначно определить путь к задаче.
 * Физической связи ScopeTasksFile->файл_в_наличии нет.
 *
 * Используется для type safety при работе с коллекциями:
 * `Map<ScopeTasksFile, T>` вместо `Map<string, T>` предотвращает
 * случайное использование произвольных строк как ключей.*/
export type File = string & { readonly [__TasksFile]: never; };


export type Uri = vscode.Uri & {
    readonly [__TasksFileUri]: never;
    fsPath: File;
};


export type Name = string & { readonly [__TaskLabel]: never; };


// Идентификатор задачи
export type TaskID = string & { readonly [__Identity]: never; };


declare const __ProcessId: unique symbol;
export type ProcessId = number & { readonly [__ProcessId]: never; };


const SEP = '<\0>' as const;


export function idFromTask(task: vscode.Task): TaskID | undefined {

    const uri = computeUri(task.scope);

    if (!uri) {
        return undefined;
    }

    if (!isName(task.name)) {
        return undefined;
    }

    return idFromUri(uri, task.name);
}

export function idFromUri(uri: Uri, name: Name): TaskID {
    return idFromFile(uri.fsPath, name);
}

export function idFromFile(file: File, name: Name): TaskID {
    return `${file}${SEP}${name}` as TaskID;
}

export function taskIdToString(taskId: TaskID | undefined): string {

    if (!taskId) {
        return '<NO-ID>';
    }

    const { file, name } = parseTaskId(taskId);

    return `${file} • ${name}`;

}

export function isName(label: string | undefined): label is Name {
    return label !== undefined && typeof label === 'string' && label.length > 0;
}


export function parseTaskId(taskId: TaskID): Readonly<{ file: File, name: Name; }> {
    const [file, ...name] = taskId.split(SEP);
    return {
        file: file as File,
        name: name.join(SEP) as Name
    };
}


export function fileFromTaskId(taskId: TaskID): File {
    return taskId.split(SEP)[0] as File;
}

function fileToUri(tasksFile: File): Readonly<Uri> {
    // @todo: только если физически существует?
    return vscode.Uri.file(tasksFile) as Uri;
}

// @todo: переделать. не должна возвращать undefined, не должна принимать то из чего может получится undefined
export function computeUri(scope: vscode.WorkspaceFolder | vscode.TaskScope | undefined): Readonly<Uri> | undefined {

    if (!scope || scope === vscode.TaskScope.Global) {
        return undefined;
    }

    if (scope === vscode.TaskScope.Workspace) {
        // @fixme: только сохраненный vs и виртуальный - тоже
        // return (vscode.workspace.workspaceFile /*&& vscode.workspace.workspaceFile.fsPath.endsWith('.code-workspace')*/) ? vscode.workspace.workspaceFile as TasksFileUri : undefined;
        // сейчас: и виртуальный - тоже
        return vscode.workspace.workspaceFile as Uri | undefined;
    }

    return vscode.Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as Uri;
}


export function jsonPath(fileUri: vscode.Uri): string[] {
    if (fileUri.fsPath.endsWith('.json')) {
        return ['tasks'];
    }
    return ['tasks', 'tasks'];
}


export function isValidPid(pid: number | undefined): pid is ProcessId {
    return (pid !== undefined && Number.isInteger(pid) && pid > 0);
}


export interface IconDefinition {
    /** Идентификатор иконки */
    id?: string,
    /** Цвет иконки */
    color?: string;
}

/** The description of a task. */
export interface Definition {

    /** The task's name */
    // name: Name;

    // /** Whether the executed command is kept alive and runs in the background. */
    // isBackground?: boolean;

    // /** Defines the group to which this task belongs. Also supports to mark
    //  * a task as the default task in a group. */
    // group?: string | { kind: string; isDefault: boolean; };

    /** Флаг скрытия задачи из палитры задач */
    hide: boolean | undefined;

    /** Пользовательская иконка для задачи */
    icon: IconDefinition;
}


export interface UserTask extends Definition {
    file: File;
    vscTask: Readonly<vscode.Task>;
}
