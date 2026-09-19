/** @file Branch.types.test.ts — проверяется только компилятором, не запускается */

import Branch from '../../../src/TreeViewPanel/Branch';

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

const expectType = <_T extends true>(): void => undefined;

interface TaskData {
    readonly [k: string]: unknown,
    readonly cmd?: string;
}
type El = Branch.Element<'tasks', TaskData>;

export function typeTests(
    el: El,
    roots: ReadonlyArray<El>,
    foreign: Branch.Element<'other', TaskData>
): void {

    // --- сужение через гарды
    if (Branch.Element.isDataElement(el)) {
        expectType<Equal<typeof el, Branch.Element.Data<'tasks', TaskData>>>();
        expectType<Equal<typeof el.data, TaskData>>();
        expectType<Equal<typeof el.children, ReadonlyArray<El> | undefined>>();
    } else {
        expectType<Equal<typeof el, Branch.Element.Intermediate<'tasks', TaskData>>>();
        expectType<Equal<typeof el.data, undefined>>();
        expectType<Equal<typeof el.children, ReadonlyArray<El>>>();
    }

    if (Branch.Element.isIntermediateElement(el)) {
        expectType<Equal<typeof el.children, ReadonlyArray<El>>>();
    } else {
        expectType<Equal<typeof el.data, TaskData>>();
    }

    // --- сужение без гарда, по самому data (union должен быть дискриминируемым)
    if (el.data !== undefined) {
        expectType<Equal<typeof el.data, TaskData>>();
    } else {
        expectType<Equal<typeof el.children, ReadonlyArray<El>>>();
    }

    // --- гард в filter даёт суженный массив
    const dataOnly = roots.filter(Branch.Element.isDataElement);
    expectType<Equal<typeof dataOnly, Array<Branch.Element.Data<'tasks', TaskData>>>>();

    // --- литералы и родитель
    expectType<Equal<typeof el.branchKey, 'tasks'>>();
    expectType<Equal<typeof el.parent, El | undefined>>();

    // --- readonly
    // @ts-expect-error
    el.label = 'x';
    // @ts-expect-error
    el.id = 'x';
    // @ts-expect-error
    el.branchKey = 'tasks';
    // @ts-expect-error
    el.parent = undefined;
    if (Branch.Element.isDataElement(el)) {
        // @ts-expect-error
        el.data = {};
    }
    // @ts-expect-error — ReadonlyArray без push
    el.children?.push(el);
    // @ts-expect-error
    roots.push(el);

    // --- элементы разных веток несовместимы
    // @ts-expect-error
    roots.includes(foreign);
}

// --- K выводится литералом, а не string
declare const nodes: Array<{ path: string[]; data: TaskData; }>;
export const inferred = Branch.build({ branchKey: 'tasks', nodes }, (_k, _p, s) => s);
expectType<Equal<typeof inferred, ReadonlyArray<El>>>();
