/** @file HierarchyModel/Branch.ts */

import * as assert from 'node:assert/strict';


interface AnyData { readonly [k: string]: unknown; }


// #region построение

/** Внутренний узел билдера. Наружу не выходит. */
interface MutableNode<K extends string, D extends AnyData> {
    readonly branchKey: K;
    readonly id: string;
    readonly label: string;
    readonly parent: MutableNode<K, D> | undefined;
    children: MutableNode<K, D>[] | undefined;
    data: D | undefined;
}

/** Строит корни ветки. Порядок узлов = порядок первого объявления в `spec.nodes`.
 *  Коллизии ID не проверяются: `makeId` обязан давать уникальные ID. */
export function build<K extends string, D extends AnyData>(
    spec: Branch.Spec<K, D>,
    makeId: Branch.MakeId<K>
): Branch<K, D> {

    const { branchKey } = spec;
    const roots: MutableNode<K, D>[] = [];

    // родитель → (сегмент → узел); ключ `undefined` — корневой уровень
    const levels = new Map<MutableNode<K, D> | undefined, Map<string, MutableNode<K, D>>>();

    for (const { path, data } of spec.nodes) {

        assert.ok(path.length > 0, 'Specification error: path must contain at least one segment.');
        assert.ok(data != undefined, 'data must not be undefined');

        let node: MutableNode<K, D> | undefined;

        for (const segment of path) {
            const parent = node;

            let level = levels.get(parent);
            if (!level) {
                level = new Map();
                levels.set(parent, level);
            }

            node = level.get(segment);
            if (!node) {
                node = {
                    branchKey,
                    id: makeId(branchKey, parent, segment),
                    label: segment,
                    parent,
                    children: undefined,
                    data: undefined
                };
                level.set(segment, node);

                if (parent) { (parent.children ??= []).push(node); }
                else { roots.push(node); }
            }
        }

        assert.ok(node); // path непустой, значит node определён
        node.data = data;
    }

    // Единственный каст. Инвариант: data === undefined ⇒ children непуст,
    // потому что узел без data создаётся только на пути к более глубокому сегменту.
    return roots as ReadonlyArray<Branch.Element<K, D>>;
}

// #endregion построение


const isDataElement = <K extends string, D extends AnyData>(
    e: Branch.Element<K, D>
): e is Branch.Element.Data<K, D> => e.data !== undefined;

const isIntermediateElement = <K extends string, D extends AnyData>(
    e: Branch.Element<K, D>
): e is Branch.Element.Intermediate<K, D> => e.data === undefined;


// #region публичные типы

type Branch<K extends string, D extends AnyData> = ReadonlyArray<Branch.Element<K, D>>;

declare namespace Branch {

    interface ElementBase<K extends string> {
        readonly branchKey: K;
        readonly id: string;
        readonly label: string;
    }

    type MakeId<K extends string> =
        (branchKey: K, parent: Branch.ElementBase<K> | undefined, segment: string) => string;


    export interface Spec<K extends string, D extends AnyData> {
        /** Уникальный среди всех веток ключ; попадает в `branchKey` каждого узла. */
        readonly branchKey: K;
        readonly nodes: ReadonlyArray<Spec.Node<D>>;
    }

    namespace Spec {
        /** Узел ветки: путь (сегменты) и данные. При совпадении путей побеждает последний. */
        interface Node<D extends AnyData> {
            readonly path: ReadonlyArray<string>;
            readonly data: D;
        }
    }

    type Element<K extends string, D extends AnyData> =
        | Element.Data<K, D>
        | Element.Intermediate<K, D>;

    namespace Element {

        interface Data<K extends string, D extends AnyData> extends ElementBase<K> {
            readonly data: D;
            readonly children: ReadonlyArray<Element<K, D>> | undefined;
            readonly parent: Element<K, D> | undefined;
        }

        interface Intermediate<K extends string, D extends AnyData> extends ElementBase<K> {
            readonly data: undefined;
            readonly children: ReadonlyArray<Element<K, D>>;
            readonly parent: Element<K, D> | undefined;
        }
    }
}
// #endregion публичные типы

const Branch = {
    build,
    Element: {
        isDataElement,
        isIntermediateElement
    } as const
} as const;

export default Branch;
