import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import Branch from '../../../src/TreeViewPanel/Branch';
import type Fixture from '../extension';


suite('Branch', function () {

    let buildAsciiTree: Fixture['buildAsciiTree'];
    let makeId: Fixture['makeId'];

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        const fixture: Fixture = await ext.activate();

        assert.ok(fixture);

        buildAsciiTree = fixture.buildAsciiTree;
        makeId = fixture.makeId;
    });

    suite('Построение иерархии (граничные случаи)', function () {

        suite('Коллизия типов: узел одновременно лист и ветка', function () {

            // Сначала добавляется лист, потом тот же узел получает детей — должен превратиться в ветку.
            // Сначала добавляется промежуточный узел без данных, потом ему добавляются данные — становится листом.
            // Порядок поступления таких спек не повлияет ни на структуру, ни на порядок узлов.
            // Проверяется, что при любом порядке построения дерево корректно отражает обе роли.

            test('сначала лист, потом тот же узел — уже ветка', function () {

                const branchSpec = {
                    branchKey: 'branch',
                    nodes: [
                        { path: ['aaa', 'subRunnable'], data: {} },
                        // bbb создан как лист, потом в него пытаются добавить ребёнка
                        { path: ['aaa', 'subRunnable', 'runnable'], data: {} },
                    ]
                };

                const hierarchy = Branch.build(
                    branchSpec,
                    makeId
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '└─ aaa',
                    '   └─ ▶ subRunnable',
                    '      └─ ▶ runnable',
                ], 'ascii дерево должно совпадать');

            });

            test('сначала ветка — потом должна стать ещё и листом', function () {

                const branchSpec = {
                    branchKey: 'branch',
                    nodes: [
                        { path: ['aaa', 'subRunnable', 'runnable'], data: {} },
                        // bbb уже существует как промежуточный узел без data, теперь надо добавить data
                        { path: ['aaa', 'subRunnable'], data: {} },
                    ]
                };

                const hierarchy = Branch.build(
                    branchSpec,
                    makeId
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '└─ aaa',
                    '   └─ ▶ subRunnable',
                    '      └─ ▶ runnable'
                ], 'ascii дерево должно совпадать');

            });


        });


        test('Единственная линейная цепочка без ветвлений', function () {

            // Сжимается по-разному в зависимости от режима:
            // off — каждый сегмент отдельный узел.
            // on — сжимаются только все промежуточные узлы.
            // on-aggressive —  сжимаются все узлы и лист —
            // вся цепочка становится одним комбинированным узлом.

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['a', 'b', 'c', 'd', 'runnable'], data: {} }
                ]
            };

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                // структура "as is"
                '└─ a',
                '   └─ b',
                '      └─ c',
                '         └─ d',
                '            └─ ▶ runnable'
            ], 'ascii дерево должно совпадать');

        });


        test('Несколько корневых элементов', function () {

            // Строятся независимые корневые поддеревья, порядок
            // сохраняется по порядку первого добавления.

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['aaa', 'runnable1'], data: {} },
                    { path: ['bbb', 'runnable2'], data: {} },
                    { path: ['aaa', 'runnable3'], data: {} },  // aaa уже существует
                ]
            };


            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                '├─ aaa',
                '│  ├─ ▶ runnable1',
                '│  └─ ▶ runnable3',
                '└─ bbb',
                '   └─ ▶ runnable2'
            ], 'ascii дерево должно совпадать');

        });


        test('Дети с перемежающимися типами (лист между ветками)', function () {

            // Порядок детей в выводе соответствует порядку спецификаций, ветки и листья корректно чередуются.

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['root', 'branch1', 'runnable1'], data: {} },
                    { path: ['root', 'direct-runnable'], data: {} },      // лист между двух веток
                    { path: ['root', 'branch2', 'runnable2'], data: {} },
                ]
            };


            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                '└─ root',
                '   ├─ branch1',
                '   │  └─ ▶ runnable1',
                '   ├─ ▶ direct-runnable',
                '   └─ branch2',
                '      └─ ▶ runnable2'
            ], 'ascii дерево должно совпадать');

        });


        test('Один элемент с одним сегментом', function () {

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['lone'], data: {} }
                ]
            };

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                '└─ ▶ lone'
            ], 'ascii дерево должно совпадать');

        });

    });

});
