
import * as Basic from './Basic';
import {
    Branch
} from './Branch';
import {
    DataProvider as _DataProvider
} from './DataProvider';
import {
    Task
} from '../Task';

export namespace Tree {
    export type FolderRoot = Basic.FolderRoot;
    export type DataNode = Branch.DataNode<Task.UserTask>;
    export type WorkspaceRoot = Basic.WorkspaceRoot;
    export type Node = Basic.Node;
    export type DataProvider = _DataProvider;
}


export const Tree = {
    DataProvider: _DataProvider,
    isDataNode: Branch.isDataNode,
    isMarker: Basic.isMarker,
    isRoot: Basic.isRoot,
    parseNodePath: Branch.parseNodePath // @todo тип
};
