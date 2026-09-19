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


    suite('Построение иерархии (разное)', function () {

        // Разные тесты на структуру

        test('Неадекватно глубокая вложенность', function () {
            const branchKey = 'branch';
            const branchSpec = {
                branchKey,
                nodes: [
                    { path: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-2'], data: {} },
                    { path: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-3'], data: {} },
                    { path: ['S', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-1'/*намеренно*/], data: {} },
                    { path: ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'runnable-4'], data: {} },
                    { path: ['x', 'y', 'z', 'runnable-5'], data: {} },
                ]
            };

            const branch = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(branch);

            assert.deepEqual(lines, [
                '├─ a',
                '│  └─ b',
                '│     └─ c',
                '│        └─ d',
                '│           └─ e',
                '│              ├─ f',
                '│              │  └─ g',
                '│              │     └─ h',
                '│              │        └─ k',
                '│              │           └─ l',
                '│              │              └─ m',
                '│              │                 └─ n',
                '│              │                    └─ o',
                '│              │                       └─ p',
                '│              │                          └─ r',
                '│              │                             └─ s',
                '│              │                                └─ t',
                '│              │                                   └─ x',
                '│              │                                      └─ y',
                '│              │                                         └─ z',
                '│              │                                            ├─ ▶ runnable-2',
                '│              │                                            └─ ▶ runnable-3',
                '│              └─ g',
                '│                 └─ h',
                '│                    └─ ▶ runnable-4',
                '├─ S',
                '│  └─ a',
                '│     └─ b',
                '│        └─ c',
                '│           └─ d',
                '│              └─ e',
                '│                 └─ f',
                '│                    └─ g',
                '│                       └─ h',
                '│                          └─ k',
                '│                             └─ l',
                '│                                └─ m',
                '│                                   └─ n',
                '│                                      └─ o',
                '│                                         └─ p',
                '│                                            └─ r',
                '│                                               └─ s',
                '│                                                  └─ t',
                '│                                                     └─ x',
                '│                                                        └─ y',
                '│                                                           └─ z',
                '│                                                              └─ ▶ runnable-1',
                '└─ x',
                '   └─ y',
                '      └─ z',
                '         └─ ▶ runnable-5',
            ], 'ascii дерево должно совпадать');

            checkInvariants(branch, branchKey);
        });


        test('Каждый элемент получает данные уже после объявления', function () {

            const branchKey = 'branch';
            const branchSpec = {
                branchKey,
                nodes: [
                    // сначала все узлы объявляются как промежуточные
                    { path: ['x', 'y', 'z', 'φ'], data: {} },
                    // потом каждый узел получает данные — становится "листом-с-данными" (runnable-узлом)
                    { path: ['x', 'y', 'z'], data: {} },
                    { path: ['x', 'y'], data: {} },
                    { path: ['x'], data: {} },
                ]
            };
            // Получится дерево которое невозможно сжать: каждый узел — runnable-узел.
            // Порядок — в порядке первого объявления: x→y→z→φ

            const branch = Branch.build(
                branchSpec,
                makeId
            );

            const lines = buildAsciiTree(branch);

            assert.deepEqual(lines, [
                '└─ ▶ x',
                '   └─ ▶ y',
                '      └─ ▶ z',
                '         └─ ▶ φ',
            ], 'ascii дерево должно совпадать');

            checkInvariants(branch, branchKey);
        });

    });
});
