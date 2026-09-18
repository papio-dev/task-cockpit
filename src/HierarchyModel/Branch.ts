/** @file HierarchyModel/Branch.ts */

import * as assert from 'node:assert/strict';


interface AnyData { readonly [k: string]: unknown; };



type PathSegment = string;

// #region class Element
class Element<K extends string, D extends AnyData> {

    #childrenMap?: Map<PathSegment, Element<K, D>>;
    #data?: D;

    public readonly label: string;
    public readonly id: string;

    public readonly branchKey: K;

    public readonly parent?: Element<K, D>;

    constructor(
        branchKey: K,
        id: string,
        label: string,
        parent: Element<K, D> | undefined
    ) {
        this.label = label;
        this.id = id;
        this.branchKey = branchKey;
        if (parent) {
            this.parent = parent;
        }
    }

    // #region RO интерфейс

    get children(): ReadonlyArray<Element<K, D>> | undefined {

        if (!this.#childrenMap) { return undefined; }

        assert.ok(this.#childrenMap.size > 0);

        return [...this.#childrenMap.values()];
    }


    get data(): D | undefined {
        return this.#data;
    }


    // #endregion RO интерфейс


    ensureChildrenMap(): Map<PathSegment, Element<K, D>> {
        return this.#childrenMap ??= new Map<PathSegment, Element<K, D>>();
    }


    setData(data: D) {

        assert.ok(data !== undefined, 'setData: data must not be undefined');

        this.#data = data;
    }

}
// #endregion class Element


/** Спецификация узла: scope, путь (сегменты) и данные. */
interface ElementSpec<D extends AnyData> {
    readonly path: ReadonlyArray<string>;
    readonly data: Readonly<D>;
}

/** Спецификация ветки */
interface BranchSpec<K extends string, D extends AnyData> {

    /** Уникальный ключ ветки. Каждый созданный узел
     * получит этот ключ в свойство `branchKey` для идентификации принадлежности
     * к данной ветке. *обязан* быть уникальным среди *всех* веток. */
    readonly branchKey: K;

    /** Массив {@linkcode ElementSpec | спецификаций} (путь + данные),
     * из которых строится дерево. Порядок элементов определяет порядок
     * создания узлов и перезаписи данных на листьях. */
    readonly nodes: ReadonlyArray<Readonly<ElementSpec<D>>>;
}


/** Иерархическая ветка, построенная по {@link BranchSpec | списку спецификаций узлов}.
 *
 * Где {@link ElementSpec | каждая спецификация} из списка описывает путь в виде массива сегментов
 * и данные, которые должны быть записаны в узел, соответствующий последнему
 * сегменту пути.
 *
 * Узлы появляются в ветке в порядке первого объявления в `specs`.
 * Если несколько спецификаций заканчиваются одним и тем же путём,
 * данные последней перезаписывают предыдущие.
 *
 * @template D Тип данных, хранимых в runnable-узлах.
 * @template K
 *
 * @makeId Функция формирующая ID для узла. Предполагается что ID будут уникальными
 *   среди всех элементов всего дерева. Никаких проверок на коллизии здесь не выполняется.
 *
 * @roots Корни, узлы верхнего уровня.
 */
class Branch<K extends string, D extends AnyData> {

    readonly #roots: ReadonlyMap<PathSegment, Element<K, D>>;

    constructor(
        branchSpec: BranchSpec<K, D>,
        makeId: Branch.MakeId<K, D>
    ) {
        this.#roots = buildRoots(
            branchSpec,
            makeId
        );
    }


    get roots(): ReadonlyArray<Branch.Element<K, D>> {
        return [...this.#roots.values()] as ReadonlyArray<Branch.Element<K, D>>;
    }


    static Element = {

        isDataElement<K extends string, D extends AnyData>(element: Branch.Element<K, D>): element is Branch.DataElement<K, D> {
            return element.data !== undefined;
        },

        isIntermediateElement<K extends string, D extends AnyData>(element: Branch.Element<K, D>): element is Branch.IntermediateElement<K, D> {
            return !Branch.Element.isDataElement(element);
        }

    } as const;
}



function buildRoots<K extends string, D extends AnyData>(
    branchSpec: BranchSpec<K, D>,
    makeId: Branch.MakeId<K, D>
): ReadonlyMap<PathSegment, Element<K, D>> {

    if (branchSpec.nodes.length < 1) {
        // нет структуры — пусто
        return new Map();
    }

    const roots = new Map<PathSegment, Element<K, D>>();

    // Обрабатываем массив спецификаций
    for (const { path, data } of branchSpec.nodes) {

        // нет пути — ошибка входных данных
        assert.ok(path.length > 0, 'Specification error: path must contain at least one segment.');

        let siblings = roots; // Map<PathSegment, Element> на текущем уровне
        let parent: Element<K, D> | undefined = undefined;

        // обход сегментов
        for (let i = 0; i < path.length; i++) {

            const segment = path.at(i);
            assert.ok(segment !== undefined, 'Internal error: path segment is undefined while traversing.');
            let element = siblings.get(segment);

            if (!element) {
                element = new Element<K, D>(
                   /* branchKey */ branchSpec.branchKey,
                          /* id */ makeId(branchSpec.branchKey, parent, segment),
                       /* label */ segment,
                      /* parent */ parent
                );
                siblings.set(segment, element);
            }

            if (i < path.length - 1) { // защита листа от ложной инициализации детей.
                siblings = element.ensureChildrenMap();
                parent = element;
            }
            else {
                element.setData(data);
            }

        }

    }

    return roots;
}


// #region внешний интерфейс
// Этот интерфейс отдается потребителю для использования.

declare namespace Branch {

    /** Read-only представление узла ветки.
     *
     * - branchKey: ключ ветки, указывающий принадлежность узла к ветке;
     * - label: метка (ее сегмент пути) или составная метка после сжатия;
     * - id: уникальный идентификатор узла;
     * - data: данные узла. undefined если это чистый промежуточный узел;
     * - children: массив дочерних узлов или undefined, если это чистый листовой узел.
     *  */
    type Element<K extends string, D extends AnyData> = DataElement<K, D> | IntermediateElement<K, D>;

    interface DataElement<K extends string, D extends AnyData> {
        readonly branchKey: K;
        readonly children: ReadonlyArray<Branch.Element<K, D>> | undefined;
        readonly data: D;
        readonly id: string;
        readonly label: string;
        readonly parent: Branch.Element<K, D> | undefined;
    }

    interface IntermediateElement<K extends string, D extends AnyData> {
        readonly branchKey: K;
        readonly children: ReadonlyArray<Branch.Element<K, D>>;
        readonly data: undefined;
        readonly id: string;
        readonly label: string;
        readonly parent: Branch.Element<K, D> | undefined;
    }

    /** Спецификация ветки */
    interface Spec<K extends string, D extends AnyData> {

        /** Уникальный ключ ветки. Каждый созданный узел
         * получит этот ключ в свойство `branchKey` для идентификации принадлежности
         * к данной ветке. *обязан* быть уникальным среди *всех* веток. */
        branchKey: K;

        /** Массив {@linkcode ElementSpec | спецификаций} (путь + данные),
         * из которых строится дерево. Порядок элементов определяет порядок
         * создания узлов и перезаписи данных на листьях. */
        nodes: Array<Spec.Node<D>>;
    }

    namespace Spec {
        /** Спецификация узла: scope, путь (сегменты) и данные. */
        interface Node<D extends AnyData> {
            path: Array<string>;
            data: D;
        }
    }

    type ParentRef<K extends string, D extends AnyData> = Pick<Branch.Element<K, D>, 'id' | 'label' | 'branchKey'> | undefined;
    type MakeId<K extends string, D extends AnyData> = (branchKey: K, parent: ParentRef<K, D> | undefined, segment: string) => string;

}

// #endregion внешний интерфейс


export default Branch;
