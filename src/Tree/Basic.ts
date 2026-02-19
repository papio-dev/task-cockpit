import {
    Task
} from "../Task";
import {
    Branch
} from "./Branch";


export type Node = FolderRoot | WorkspaceRoot | Branch.Node<Task.UserTask> | Marker;

export interface CountWDetail {
    all: number;
    excludes: number;
}

export interface Marker {
    marker: 'empty';
    tasksFile: Task.File;
}

export interface CountTDetail {
    all: number;
    // skipped: number; // @todo или да?
    hidden: number;
}


export type WorkspaceRoot = Omit<Branch.Node<Task.UserTask>, 'children' | 'data' | 'nodePath'> & RootNode & {
    workspaceDetail: CountWDetail;
    excluded: boolean;
};


export type FolderRoot = Omit<Branch.Node<Task.UserTask>, 'children' | 'data' | 'nodePath'> & RootNode;

interface RootNode {
    tasksFile: Task.File,
    children: Branch.Node<Task.UserTask>[];
    tasksDetail: CountTDetail;
    childrenConfigs: {
        defaultIconName: string,
        tintLabel: boolean;
        useFolderIcon: boolean;
    };
}


export function isMarker(node: Branch.Node<Task.UserTask> | WorkspaceRoot | FolderRoot | Marker): node is Marker {
    return 'marker' in node;
}


export function isRoot(node: Branch.Node<Task.UserTask> | FolderRoot | WorkspaceRoot | Marker): node is FolderRoot | WorkspaceRoot {
    if (isMarker(node)) {
        return false;
    }
    return 'tasksFile' in node;
}


export function isWorkspaceRoot(node: FolderRoot | WorkspaceRoot): node is WorkspaceRoot {
    return node.tasksFile.endsWith('.code-workspace');
}


export function isFolderRoot(node: FolderRoot | WorkspaceRoot): node is FolderRoot {
    return node.tasksFile.endsWith('tasks.json');
}
