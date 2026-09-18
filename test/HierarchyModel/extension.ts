import * as vscode from 'vscode';
import type Branch from '../../src/HierarchyModel/Branch';


interface Fixture {
    buildAsciiTree: (hierarchy: Branch<string, any>) => string[];
    makeId: Branch.MakeId<string, any>;
}

export function activate(context: vscode.ExtensionContext): Fixture {
    return {
        buildAsciiTree,
        makeId
    };
}


export function deactivate(): void { }

// --------------------------------------------------------------------


function buildAsciiTree(
    branch: Branch<string, any>
): string[] {
    const lines: string[] = [];
    collectLines(branch.roots, '', lines);
    return lines;
}

function collectLines(
    children: readonly Branch.Element<string, any>[],
    prefix: string,
    lines: string[]
): void {
    for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        const isLast = i === children.length - 1;
        const connector = isLast ? '└─ ' : '├─ ';
        const childPrefix = prefix + (isLast ? '   ' : '│  ');
        const runnablePrefix = child.data != null ? '▶ ' : '';
        lines.push(`${prefix}${connector}${runnablePrefix}${child.label}`);
        collectLines(child.children ?? [], childPrefix, lines);
    }
}

const SEP = '\x00\x1f\x00';

function makeId(branchKey: string, parent: Branch.ParentRef<string, any> | undefined, segment: string): string {
    if (parent) {
        return `${parent.id}${SEP}${segment}`;
    }
    return `${branchKey}${SEP}${segment}`;
}

export default Fixture;
