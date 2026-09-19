import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import Branch from '../../../src/TreeViewPanel/Branch';
import type Fixture from '../extension';


suite('Branch', function () {

    let buildAsciiTree: Fixture['buildAsciiTree'];
    let makeId: Fixture['makeId'];
    let checkInvariants: Fixture['checkInvariants'];

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        const fixture: Fixture = await ext.activate();

        assert.ok(fixture);

        buildAsciiTree = fixture.buildAsciiTree;
        makeId = fixture.makeId;
        checkInvariants = fixture.checkInvariants;
    });

    suite('Построение иерархии (базовые)', function () {

        test('Простая вложенность', function () {
            const branchKey = 'branch';
            const branchSpec: Branch.Spec<'branch', {}> = {
                branchKey,
                nodes: [
                    { path: ['a', 'b-runnable'], data: {} },
                    { path: ['a', 'b-runnable', 'c-runnable'], data: {} }
                ]
            };

            const branch = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(branch);

            assert.deepEqual(lines, [
                '└─ a',
                '   └─ ▶ b-runnable',
                '      └─ ▶ c-runnable'
            ], 'ascii дерево должно совпадать');

            checkInvariants(branch, branchKey);

        });


        test('Простая вложенность, несколько корней', function () {
            const branchKey = 'branch';
            const branchSpec = {
                branchKey,
                nodes: [
                    { path: ['runnable1'], data: {} },
                    { path: ['group1', 'runnable2'], data: {} },
                    { path: ['group2', 'runnable3'], data: {} },
                    { path: ['group2', 'runnable4'], data: {} }
                ]
            };

            const branch = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(branch);

            assert.deepEqual(lines, [
                '├─ ▶ runnable1',
                '├─ group1',
                '│  └─ ▶ runnable2',
                '└─ group2',
                '   ├─ ▶ runnable3',
                '   └─ ▶ runnable4'
            ], 'ascii дерево должно совпадать');

            checkInvariants(branch, branchKey);
        });

        suite('Простая вложенность, несколько корней. Разный порядок', function () {

            // структура дерева не зависит от порядка поступления спек.
            // Порядок элементов в структуре — зависит.

            test('Лист добавлен до поддерева-соседа', function () {
                const branchKey = 'branch';
                const branchSpec = {
                    branchKey,
                    nodes: [
                        { path: ['aaa', 'bbb', 'ccc', 'ccc-runnable'], data: {} },
                        { path: ['aaa', 'bbb', 'ccc', 'ddd', 'ddd-runnable'], data: {} },
                    ]
                };

                const branch = Branch.build(
                    branchSpec,
                    makeId
                );

                const lines = buildAsciiTree(branch);

                assert.deepEqual(lines, [
                    '└─ aaa',
                    '   └─ bbb',
                    '      └─ ccc',
                    '         ├─ ▶ ccc-runnable',
                    '         └─ ddd',
                    '            └─ ▶ ddd-runnable'
                ], 'ascii дерево должно совпадать');

                checkInvariants(branch, branchKey);
            });

            test('Поддерево-сосед добавлено до листа', function () {
                const branchKey = 'branch';
                const branchSpec = {
                    branchKey,
                    nodes: [
                        { path: ['aaa', 'bbb', 'ccc', 'ddd', 'ddd-runnable'], data: {} },
                        { path: ['aaa', 'bbb', 'ccc', 'ccc-runnable'], data: {} },
                    ]
                };

                const branch = Branch.build(
                    branchSpec,
                    makeId
                );

                const lines = buildAsciiTree(branch);

                assert.deepEqual(lines, [
                    // Порядок aaa→bbb→ccc→ddd,
                    // но ccc-лист вставлен после появления ddd-группы.
                    '└─ aaa',
                    '   └─ bbb',
                    '      └─ ccc',
                    '         ├─ ddd',
                    '         │  └─ ▶ ddd-runnable',
                    '         └─ ▶ ccc-runnable'
                ], 'ascii дерево должно совпадать');
                checkInvariants(branch, branchKey);
            });
        });
    });
});
