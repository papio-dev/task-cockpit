/** @file HierarchyModel/HierarchyModel.ts */

import * as assert from 'node:assert/strict';
import type Immutable from '../utils/Immutable';


interface AnyData { [k: string]: unknown; };

class InnerMap<out K, out V> extends Map<K, V> {

    #children: Array<V> | null = null;

    override set(key: K, value: V): this {
        this.#children = null; // инвалидируем
        return super.set(key, value);
    }

    get children(): Array<V> {
        return this.#children ??= [...this.values()];
    }
}

class HierarchyBuilder<out K extends string, out D extends AnyData> {

    readonly #roots: Array<Element<K, D>>;
    readonly #branchKey: K;

    constructor(specsDict: SpecsDict<K, D>) {
        this.#branchKey = specsDict.branchKey;
        for (const spec of specsDict.specs) {
            this.#insertSpec(spec);
        }
    }

    build(compression: PathCompression): HierarchyModel.Hierarchy<K, D> {
        const root = compression !== PathCompression.OFF
            ? this.#compressDict(this.#dict, compression)
            : this.#dict;
        return new Hierarchy(root) as HierarchyModel.Hierarchy<K, D>;
    }

    #insertSpec(spec: Spec<D>): void { /* текущее тело for-цикла */ }
    #compressNode(node: Element<K, D>, mode: ...): Element<K, D> { ... }
    #compressDict(d: InnerMap<...>, mode: ...): InnerMap <...> { ... }
}



declare namespace Hierarchy {

    interface DataNode { }

    interface IntermediateNode { }
}

class Hierarchy<out K extends string, out D extends AnyData> {

    readonly #root: InnerMap<string, Hierarchy.Element<K, D>>;

    constructor(root: InnerMap<string, Hierarchy.Element<K, D>>) {
        this.#root = root;
    }

    get children(): Array<Hierarchy.Element<K, D>> {
        return this.#root.children;
    }
}
