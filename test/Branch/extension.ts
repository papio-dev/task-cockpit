import * as vscode from 'vscode';
import type Branch from '../../src/TreeViewPanel/Branch';
import * as assert from 'node:assert/strict';


interface Fixture {
    buildAsciiTree: (hierarchy: readonly Branch.Element<string, any>[]) => string[];
    makeId: Branch.MakeId<string>;
    checkInvariants<K extends string, D extends {}>(roots: Branch<K, any>, branchKey: K): number;
}

export function activate(context: vscode.ExtensionContext): Fixture {
    return {
        buildAsciiTree,
        makeId,
        checkInvariants
    };
}


export function deactivate(): void { }

// --------------------------------------------------------------------


function buildAsciiTree(
    branch: readonly Branch.Element<string, any>[]
): string[] {
    const lines: string[] = [];
    collectLines(branch, '', lines);
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

function makeId(branchKey: string, parent: Branch.ElementBase<string> | undefined, segment: string): string {
    if (parent) {
        return `${parent.id}${SEP}${segment}`;
    }
    return `${branchKey}${SEP}${segment}`;
}


function checkInvariants<K extends string, D extends {}>(
    roots: Branch<K, any>,
    branchKey: K
): number {
    let count = 0;
    // явный стек: рекурсия
    const stack: Array<[Branch.Element<K, D>, Branch.Element<K, D> | undefined]> =
        roots.map(r => [r, undefined]);

    while (stack.length > 0) {
        const [el, parent] = stack.pop()!;
        count++;

        assert.strictEqual(el.parent, parent, `parent mismatch: ${el.id}`);
        assert.strictEqual(el.branchKey, branchKey);

        if (el.children !== undefined) {
            assert.ok(el.children.length > 0, `пустой children у ${el.id}`);
        }
        assert.ok(
            el.data !== undefined || el.children !== undefined,
            `узел ${el.id} без data и без детей`
        );

        for (const child of el.children ?? []) { stack.push([child, el]); }
    }
    return count;
}

export default Fixture;
