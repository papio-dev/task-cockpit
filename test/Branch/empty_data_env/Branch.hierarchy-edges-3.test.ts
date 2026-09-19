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

        test('Сегменты à la "числа" — порядок сохраняется', function () {

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['3', '1', '2'], data: {} },
                    { path: ['3', '2', '1'], data: {} },
                    { path: ['1', '2', '3'], data: {} }
                ]
            };

            // ничего особенного не происходит

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                '├─ 3',
                '│  ├─ 1',
                '│  │  └─ ▶ 2',
                '│  └─ 2',
                '│     └─ ▶ 1',
                '└─ 1',
                '   └─ 2',
                '      └─ ▶ 3'
            ], 'ascii дерево должно совпадать');

        });


        test('Дублирующиеся пути — последний выиграет', function () {

            // Если несколько спецификаций с одинаковым путём, побеждает
            // последняя (её данные перезаписывают предыдущие).

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['aaa', 'bbb', 'runnable'], data: { value: 'looser' } },
                    { path: ['aaa', 'bbb', 'runnable'], data: { value: 'winner' } },
                ]
            };

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const runnable = hierarchy[0]?.children?.[0]?.children?.[0];
            assert.ok(runnable);
            assert.equal(runnable.label, 'runnable');
            assert.ok(runnable.data);
            assert.equal(runnable.data.value, 'winner');

        });


        test('Повторяющиеся сегменты в одном пути', function () {

            // Пути с одинаковыми именами на разных уровнях — обрабатываются без конфликтов.

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['aaa', 'aaa', 'bbb', 'aaa', 'runnable'], data: {} },
                ]
            };

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                '└─ aaa',
                '   └─ aaa',
                '      └─ bbb',
                '         └─ aaa',
                '            └─ ▶ runnable'
            ], 'ascii дерево должно совпадать');


        });

    });
});
