import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import Branch from '../../../src/TreeViewPanel/Branch';
import type Fixture from '../extension';


suite('Branch', function () {


    let makeId: Fixture['makeId'];
    let checkInvariants: Fixture['checkInvariants'];

    suiteSetup(async function () {

        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        const fixture: Fixture = await ext.activate();

        assert.ok(fixture);

        makeId = fixture.makeId;
        checkInvariants = fixture.checkInvariants;

        this.timeout(5_000);
        await new Promise<void>((resolve) => {
            setTimeout(() => { resolve(); }, 3_000);
        });


    });

    this.slow(200); // буду считать что 200 ms — это медленно
    // ------------


    suite('Стресс тесты на построение иерархии', function () {
        // проверяет что нет проблем на "больших" данных

        test('Глубокая линейная цепочка', function () {
            // Один путь из 100 000 сегментов
            const deepSegments = Array.from({ length: 100_000 }, (_, i) => `node${i}`);
            const sub: Branch.Spec.Node<{}>[] = [{ path: deepSegments, data: {} }];
            const branchKey = 'branch';
            const specs: Branch.Spec<string, {}> = { branchKey, nodes: sub };

            const branch = Branch.build(
                specs,
                makeId
            );

            assert.ok(branch);
            checkInvariants(branch, branchKey);

        });

        test('Широкое дерево: много прямых потомков', function () {
            // 100 000 спецификаций, каждая задаёт путь ['root', 'child_N']. Все они прямые потомки root.

            const COUNT = 100_000;
            const sub = Array.from({ length: COUNT }, (_, i) => ({
                path: ['root', `child_${i}`],
                data: { index: i }
            }));
            const branchKey = 'branch';
            const specs: Branch.Spec<string, {}> = { branchKey, nodes: sub };

            const branch = Branch.build(
                specs,
                makeId
            );

            assert.ok(branch);
            checkInvariants(branch, branchKey);

        });

        test('Много глубоких веток от одного корня', function () {
            // 1000 веток, каждая глубиной в 100 сегментов, все начинаются с общего корня.
            const BRANCHES = 1000;
            const DEPTH = 100;
            const sub = [];
            for (let b = 0; b < BRANCHES; b++) {
                const path = ['root'];
                for (let d = 1; d <= DEPTH; d++) {
                    path.push(`branch${b}_level${d}`);
                }
                sub.push({ path, data: { b } });
            }
            const branchKey = 'branch';
            const specs: Branch.Spec<string, {}> = { branchKey, nodes: sub };

            const branch = Branch.build(
                specs,
                makeId
            );

            assert.ok(branch);
            checkInvariants(branch, branchKey);

        });

    });


});
