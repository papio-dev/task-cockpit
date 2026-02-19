import * as vscode from 'vscode';
import {
    Task
} from '../Task';
import {
    CountWDetail,
    FolderRoot,
    WorkspaceRoot
} from './Basic';
import {
    Branch,
} from './Branch';

import {
    Splitter
} from './Splitter';

// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
try {
    ({ logger, assert } = require('../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG

async function grow(): Promise<[WorkspaceRoot, ...FolderRoot[]] | FolderRoot[]> {

    // uri workspace`а. будет undefined - если single-каталог проект
    const workspaceUri = Task.computeUri(vscode.TaskScope.Workspace);

    // исключаемые каталоги имеют смысл только в workspace`е
    const excludes = workspaceUri
        ? new Set(
            vscode.workspace
                .getConfiguration('taskCockpit', workspaceUri)
                .get<string[]>('filtering.excludeFolders', [])
        )
        : new Set<string>();

    const folders: Readonly<vscode.WorkspaceFolder>[] = [];

    const workspaceDetail = {
        all: 0,
        excludes: 0
    };

    if (vscode.workspace.workspaceFolders) {

        workspaceDetail.all = vscode.workspace.workspaceFolders.length;

        for (const folder of vscode.workspace.workspaceFolders) {
            if (!excludes.has(folder.name)) {
                folders.push(folder);
            }
            else {
                workspaceDetail.excludes++;
            }
        }
    }

    const folderUris = folders
        .map(folder => Task.computeUri(folder))
        .filter((uri): uri is Task.Uri => Boolean(uri));

    const tasksMap = await Task.fetch(workspaceUri ? [workspaceUri, ...folderUris] : folderUris);

    const folderRoots = folders.map(folder => growFolderRoot(folder, tasksMap.get(Task.computeUri(folder)!.fsPath)));


    // #region DEBUG
    {
        const roots = workspaceUri ? [growWorkspaceRoot(workspaceUri, tasksMap.get(workspaceUri.fsPath), workspaceDetail), ...folderRoots] : folderRoots;

        const lines: string[] = ['Tree'];

        function walk(node: FolderRoot | WorkspaceRoot | Branch.Node<Task.UserTask>, prefix: string, isLast: boolean): void {
            const connector = isLast ? '└──' : '├──';

            lines.push(prefix + connector + (('tasksFile' in node) ? `(>) ${node.tasksFile}` : `${'data' in node ? '(*)' : '(/)'} ${Branch.parseNodePath(node.nodePath).segments}`));

            const children = (node.children ?? []);
            const childPrefix = prefix + (isLast ? '    ' : '│   ');

            children.forEach((child, i) => {
                walk(child, childPrefix, i === children.length - 1);
            });
        }

        roots.forEach((root, i) => {
            walk(root, '', i === roots.length - 1);
        });

        lines.forEach((l) => {
            logger?.(vscode.LogLevel.Trace, l);
        });
    }
    // #endregion DEBUG

    return workspaceUri
        ? [growWorkspaceRoot(workspaceUri, tasksMap.get(workspaceUri.fsPath), workspaceDetail), ...folderRoots]
        : folderRoots;
};


// Параметры, которые будут использованы для построения ветки
function branchConfigs(scopedConfig: vscode.WorkspaceConfiguration) {
    return {
        separator: scopedConfig.get<string>('display.segmentSeparator') || false as const,
        useGroupKind: scopedConfig.get<boolean>('display.useGroupKind', false),
        showHidden: scopedConfig.get<boolean>('filtering.showHidden', false),
    };
}


// Параметры, которые будут использованы для отображения элемента не ветке
function nodeConfigs(scopedConfig: vscode.WorkspaceConfiguration) {
    return {
        defaultIconName: scopedConfig.get<string>('display.defaultIconName', 'tools'),
        tintLabel: scopedConfig.get<boolean>('display.tintLabel', false),
        useFolderIcon: scopedConfig.get<boolean>('display.useFolderIcon', false)
    };
}


function growWorkspaceRoot(
    uri: Readonly<Task.Uri>,
    tasksMap: ReadonlyMap<Task.Name, Readonly<Task.UserTask>> | undefined,
    workspaceDetail: CountWDetail
): WorkspaceRoot {

    const scopedConfig = vscode.workspace.getConfiguration('taskCockpit', uri);

    const excluded = scopedConfig.get<boolean>('filtering.excludeWorkspaceTasks', false);

    const { branchSpec, tasksDetail } = (tasksMap && tasksMap.size > 0) ? makeBranchSpec(branchConfigs(scopedConfig), tasksMap) : {};

    return {
        tasksFile: uri.fsPath,
        segment: vscode.workspace.name!,
        workspaceDetail,
        excluded,
        tasksDetail: tasksDetail
            ? excluded
                ? { all: tasksDetail.all, hidden: tasksDetail.all, }
                : tasksDetail
            : { all: 0, hidden: 0, },
        childrenConfigs: nodeConfigs(scopedConfig),
        children: excluded
            ? []
            : branchSpec
                ? Branch.build(uri.fsPath, branchSpec)
                : []
    };
}


function growFolderRoot(
    folder: Readonly<vscode.WorkspaceFolder>,
    tasksMap: ReadonlyMap<Task.Name, Readonly<Task.UserTask>> | undefined,
): FolderRoot {

    const uri = Task.computeUri(folder)!;

    const scopedConfig = vscode.workspace.getConfiguration('taskCockpit', uri);

    const { branchSpec, tasksDetail } = (tasksMap && tasksMap.size > 0) ? makeBranchSpec(branchConfigs(scopedConfig), tasksMap) : {};

    return {
        tasksFile: uri.fsPath,
        segment: folder.name,
        tasksDetail: tasksDetail ? tasksDetail : { all: 0, hidden: 0, },
        childrenConfigs: nodeConfigs(scopedConfig),
        children: branchSpec ? Branch.build(uri.fsPath, branchSpec) : []
    };

}


/**
 *
 * */
function makeBranchSpec(
    configs: Readonly<{ separator: string | false, showHidden: boolean, useGroupKind: boolean; }>,
    tasksMap: ReadonlyMap<Task.Name, Readonly<Task.UserTask>>
) {

    const tasksDetail = {
        all: tasksMap.size,
        hidden: 0
    };

    const splitter = new Splitter(configs.separator);
    const branchSpec: Branch.Spec<Task.UserTask>[] = [];

    for (const [name, userTask] of tasksMap) {

        if (userTask.hide && !configs.showHidden) {
            tasksDetail.hidden++;
            continue;
        }

        const internodes =
            (configs.useGroupKind &&
                // @ts-expect-error // доступно как минимум с ^1.86.2
                userTask.vscTask.group?.label)
                ? [
                    // @ts-expect-error // доступно  как минимум с ^1.86.2
                    userTask.vscTask.group.label,
                    ...splitter.split(name)
                ]
                : splitter.split(name);

        branchSpec.push({
            segments: internodes,
            data: userTask
        });
    }

    return {
        tasksDetail,
        branchSpec
    };

}


export const Roots = {
    grow
};
