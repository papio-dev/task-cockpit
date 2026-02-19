import * as vscode from 'vscode';
import {
    FolderRoot,
    Marker,
    WorkspaceRoot
} from './Basic';
import {
    Branch,
} from './Branch';
import {
    Task
} from '../Task';
import { encodeQueryComponent } from '../DecorationProviders/QueryComponent';



function workspaceRoot(node: WorkspaceRoot): vscode.TreeItem {

    return {
        id: node.tasksFile,
        label: node.segment,
        resourceUri: vscode.Uri.file(node.tasksFile),
        iconPath: new vscode.ThemeIcon('layers'),
        contextValue: 'task-cockpit::Folder:Workspace',
        collapsibleState: node.excluded ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded
    };
}


function folderRoot(node: FolderRoot): vscode.TreeItem {

    return {
        id: node.tasksFile,
        label: node.segment,
        resourceUri: vscode.Uri.file(node.tasksFile),
        iconPath: new vscode.ThemeIcon('root-folder'),
        contextValue: 'task-cockpit::Folder:Project',
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    };
}


function emptyMarker(node: Marker): vscode.TreeItem {

    // #region DEBUG
    // @fixme
    if (node.marker !== 'empty') {
        throw new Error('Internal error: assertion dfg343');
    }
    // #endregion DEBUG

    return {
        id: `marker-${node.marker}!${node.tasksFile}`,
        resourceUri: vscode.Uri.from({
            scheme: 'task-cockpit',
            path: 'marker',
            query:
                encodeQueryComponent({
                    color: 'list.deemphasizedForeground',
                    special: 'empty'
                })
        }),
        iconPath: new vscode.ThemeIcon('dash', new vscode.ThemeColor('list.deemphasizedForeground')),
        label: 'No tasks to display in this scope',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'task-cockpit::EmptyMarker',
        tooltip: new vscode.MarkdownString(`*No tasks to display in this scope*\n`, false)
    };
}


function leaf(
    node: Branch.DataNode<Task.UserTask>,
    scopedConfig: {
        defaultIconName: string;
        tintLabel: boolean;
    },
    taskStateInfo: ReadonlyMap<Task.ProcessId, Readonly<Task.ProcessInfo>> | undefined
): vscode.TreeItem {




    const processes = taskStateInfo?.size ?? 0;
    const running = processes > 0 ? [...taskStateInfo!.values()].reduce((n, pInfo) => n + (pInfo.running ? 1 : 0), 0) : 0;

    const contextValue = 'task-cockpit::Task' + (processes > 0 ? ':terminals' : '') + (running ? ':running' : '');



    const tooltip = new vscode.MarkdownString(
        `${(`*${node.data.file.endsWith('.code-workspace') ? 'Workspace' : 'Project'} Task*`).padEnd(48, '\u00A0')}\n\n` +
        `**${node.segment}**  \n` +
        (node.data.vscTask.detail ?? '')
        , true
    );
    tooltip.isTrusted = false;
    tooltip.supportHtml = false;
    tooltip.supportThemeIcons = true;

    const flags = [
        node.data.hide ? 'Hidden' : false,
        node.data.vscTask.group?.isDefault ? 'Default' : false,
        node.data.vscTask.isBackground ? 'Background' : false
    ].filter((s): s is string => Boolean(s));

    return {
        id: node.nodePath,
        resourceUri: vscode.Uri.from({
            scheme: 'task-cockpit',
            path: 'task',
            query:
                encodeQueryComponent({
                    color: scopedConfig.tintLabel ? node.data.icon.color : undefined,
                    processes,
                    running
                })
        }),
        label: node.segment,
        iconPath: new vscode.ThemeIcon(
            node.data.icon.id || scopedConfig.defaultIconName,
            node.data.icon.color ? new vscode.ThemeColor(node.data.icon.color) : undefined
        ),
        collapsibleState: Branch.hasChildren(node) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        description: flags.length > 0 ? `( ${flags.join(', ')} )` : undefined,
        tooltip,
        contextValue,
    };
}


function inner(
    node: Branch.Node<Task.UserTask>,
    scopedConfig: {
        useFolderIcon: boolean;
    }
): vscode.TreeItem {
    return {
        id: node.nodePath,
        label: node.segment,
        iconPath: scopedConfig.useFolderIcon ? new vscode.ThemeIcon('folder') : undefined,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        tooltip: new vscode.MarkdownString(`**${node.segment}** group\n`)
    };
}




export const Renderers = {
    emptyMarker,
    workspaceRoot,
    folderRoot,
    leaf,
    inner,
};
