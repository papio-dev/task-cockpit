
import vscode from 'vscode';
import { NodeState, Step } from './SCENARIOS';

function buildUri(nodeIndex: number, state: NodeState): vscode.Uri {
    const params = new URLSearchParams();
    params.set('available', String(state.available));
    params.set('running', String(state.running));
    if (state.tintColor) {
        params.set('tintColor', state.tintColor);
    }
    return vscode.Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: `/node-${nodeIndex}`, // path игнорируется провайдером, нужен для уникальности Uri
        query: params.toString(),
    });
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

class ProbeNode extends vscode.TreeItem {
    constructor(index: number, state: NodeState) {
        super(state.label, vscode.TreeItemCollapsibleState.None);
        this.id = `probe-node-${index}`;
        this.resourceUri = buildUri(index, state);
        this.tooltip = this.resourceUri.toString();
    }
}

export class ProbeTreeProvider implements vscode.TreeDataProvider<ProbeNode>, vscode.Disposable {

    private readonly _emitter = new vscode.EventEmitter<ProbeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._emitter.event;

    private _items: ProbeNode[] = [];

    update(step: Step): void {
        this._items = step.nodes.map((node, i) => new ProbeNode(i, node));
        this._emitter.fire();
    }

    getTreeItem(element: ProbeNode): ProbeNode { return element; }
    getChildren(element?: ProbeNode): ProbeNode[] { return element ? [] : this._items; }

    dispose(): void { this._emitter.dispose(); }
}
