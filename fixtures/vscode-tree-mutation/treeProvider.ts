
import * as vscode from 'vscode';

// ── Тип элемента ─────────────────────────────────────────────────────────────

export type FrozenNode = Readonly<{
    id: string;
    label: string;
    children: ReadonlyArray<FrozenNode>;
}>;

// ── Обход ограничения типов ───────────────────────────────────────────────────
//
// vscode.TreeDataProvider<T>.getChildren требует T[], хотя сам VS Code
// массив не мутирует (проверено по extHostTreeViews.ts: только coalesce+map).
// Объявляем провайдер с честными типами, а единственный unsafe cast
// инкапсулируем здесь.

type ReadonlyTreeDataProvider<T> =
    Omit<vscode.TreeDataProvider<T>, 'getChildren'> & {
        getChildren(element?: T): vscode.ProviderResult<ReadonlyArray<T>>;
    };

export function asTreeDataProvider<T>(
    p: ReadonlyTreeDataProvider<T>,
): vscode.TreeDataProvider<T> {
    return p as unknown as vscode.TreeDataProvider<T>;
}

// ── Фабрика узлов ─────────────────────────────────────────────────────────────
//
// Замораживаем и массив children, и сам узел — Object.freeze shallow,
// поэтому оба уровня нужны явно.

function node(id: string, label: string, ...children: FrozenNode[]): FrozenNode {
    return Object.freeze({
        id,
        label,
        children: Object.freeze(children) as ReadonlyArray<FrozenNode>,
    });
}

// ── Дерево ────────────────────────────────────────────────────────────────────

const ROOT: ReadonlyArray<FrozenNode> = Object.freeze([
    node('alpha', 'Alpha',
        node('alpha-1', 'Alpha 1'),
        node('alpha-2', 'Alpha 2'),
    ),
    node('beta', 'Beta',
        node('beta-1', 'Beta 1',
            node('beta-1-1', 'Beta 1.1'),
        ),
    ),
    node('gamma', 'Gamma'),
]);

// ── Провайдер ─────────────────────────────────────────────────────────────────

export class FreezeTreeProvider implements ReadonlyTreeDataProvider<FrozenNode> {

    getTreeItem(element: FrozenNode): vscode.TreeItem {
        // Убеждаемся что VS Code вернул именно наш замороженный объект,
        // а не копию / обёртку
        if (!Object.isFrozen(element)) {
            throw new Error(`[freeze-tree] element '${element.id}' NOT frozen`);
        }
        if (!Object.isFrozen(element.children)) {
            throw new Error(`[freeze-tree] children of '${element.id}' NOT frozen`);
        }

        return new vscode.TreeItem(
            element.label,
            element.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );
    }

    getChildren(element?: FrozenNode): ReadonlyArray<FrozenNode> {
        const result = element === undefined ? ROOT : element.children;

        if (!Object.isFrozen(result)) {
            throw new Error(`[freeze-tree] result array NOT frozen`);
        }

        return result;
    }
}
