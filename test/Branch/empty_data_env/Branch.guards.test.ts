
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import Branch from '../../../src/TreeViewPanel/Branch';
import type Fixture from '../extension';


interface TaskData {
    readonly [k: string]: unknown,
    readonly cmd?: string;
}   // все поля опциональны, чтобы {} был валидными данными

type K = 'tasks';
type El = Branch.Element<K, TaskData>;

suite('Branch', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        const fixture: Fixture = await ext.activate();
        assert.ok(fixture);
    });

    suite('Branch.Element: гарды', () => {


        function build(...nodes: Array<[path: string[], data: TaskData]>): Branch<K, TaskData> {
            return Branch.build<K, TaskData>(
                { branchKey: 'tasks', nodes: nodes.map(([path, data]) => ({ path, data })) },
                (branchKey: string, parent: Branch.ElementBase<string> | undefined, segment: string) => parent ? parent.id + '+' + segment : branchKey + '+' + segment
            );
        }

        function find(roots: ReadonlyArray<El>, ...path: string[]): El {
            let level = roots;
            let found: El | undefined;
            for (const seg of path) {
                found = level.find(e => e.label === seg);
                assert.ok(found, `нет узла «${seg}»`);
                level = found.children ?? [];
            }
            assert.ok(found);
            return found;
        }

        const roots = build(
            [['leaf'], { cmd: 'l' }],
            [['group', 'child'], { cmd: 'c' }],
            [['both'], { cmd: 'b' }],
            [['both', 'inner'], { cmd: 'i' }],
            [['empty'], {}]
        );

        const cases: Array<{ name: string; path: string[]; data: boolean; children: boolean; }> = [
            { name: 'чистый лист', path: ['leaf'], data: true, children: false },
            { name: 'чистый промежуточный', path: ['group'], data: false, children: true },
            { name: 'лист под промежуточным', path: ['group', 'child'], data: true, children: false },
            { name: 'данные И дети одновременно', path: ['both'], data: true, children: true },
            { name: 'data = {} — это данные', path: ['empty'], data: true, children: false },
        ];

        for (const c of cases) {
            test(c.name, () => {
                const el = find(roots, ...c.path);
                assert.equal(Branch.Element.isDataElement(el), c.data);
                assert.equal(Branch.Element.isIntermediateElement(el), !c.data);
                // гард обязан совпадать со структурой, на которую опирается union
                assert.equal(el.children !== undefined, c.children);
            });
        }

        test('гарды взаимоисключающи на каждом узле дерева', () => {
            const stack = [...roots];
            let visited = 0;
            while (stack.length > 0) {
                const el = stack.pop()!;
                visited++;
                assert.notEqual(
                    Branch.Element.isDataElement(el),
                    Branch.Element.isIntermediateElement(el),
                    `оба или ни один: ${el.id}`
                );
                stack.push(...(el.children ?? []));
            }
            assert.equal(visited, 6);   // leaf, group, child, both, inner, empty
        });

        test('гард работает как предикат для filter', () => {
            assert.deepEqual(
                roots.filter(Branch.Element.isDataElement).map(e => e.label),
                ['leaf', 'both', 'empty']
            );
        });

        test('data: undefined во входной спецификации — ошибка', () => {
            // Гард опирается на «data === undefined ⇒ нет данных».
            // Если undefined мог бы стать данными, различение развалится.
            assert.throws(
                () => build([['x'], undefined as unknown as TaskData]),
                /data must not be undefined/
            );
        });
    });
});
