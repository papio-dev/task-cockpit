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

        test('Сегмент, содержащий пустую строку', function () {
            // ничего особенного не происходит

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: ['a', '', 'b'], data: {} }
                ]
            };

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                '└─ a',
                '   └─ ',
                '      └─ ▶ b'
            ], 'ascii дерево должно совпадать');

        });


        test('Пустой список нод (ничего)', function () {

            const branchSpec = {
                branchKey: 'K',
                nodes: []
            };

            const hierarchy = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(hierarchy);

            assert.deepEqual(lines, [
                // ничего
            ], 'ascii дерево должно совпадать');

        });


        test('Пустой массив сегментов пути (ошибка входных данных)', function () {

            const branchSpec = {
                branchKey: 'branch',
                nodes: [
                    { path: [], data: {} }
                ]
            };

            assert.throws(
                () => {
                    // выбросит исключение: ошибка входных данных
                    Branch.build(
                        branchSpec,
                        makeId
                    );
                },
                {
                    name: 'AssertionError',
                    message: /path must contain at least one segment/
                }
            );

        });

    });

});
