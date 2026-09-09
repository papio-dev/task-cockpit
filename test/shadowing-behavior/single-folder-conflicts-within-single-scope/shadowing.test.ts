import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import type IFixture from '../extension';
import type Immutable from '../../../src/utils/Immutable';
import type TaskDefinitionEntry from '../../../src/ResourceStateCoordinator/TaskDefinition/TaskDefinitionEntry';
import type EligibleTask from '../../../src/ResourceStateCoordinator/EligibleTask/EligibleTask';

// User/profiles/.../tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [ ]
// }
//
// project/.vscode/tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [
//         {
//             "label": "My Task",
//             "icon": {
//                 "id": "my-task-1"
//             },
//             "type": "shell",
//             "command": "run-my-task-1",
//             "problemMatcher": []
//         },
//         {
//             "label": "My Task",
//             "icon": {
//                 "id": "my-task-2"
//             },
//             "type": "shell",
//             "command": "run-my-task-2",
//             "problemMatcher": []
//         },
//         {
//             "label": "My Task",
//             "icon": {
//                 "id": "my-task-3"
//             },
//             "type": "shell",
//             "command": "run-my-task-3",
//             "problemMatcher": []
//         }
//     ]
// }

suite('Shadowing behavior', function () {

    let fixture: IFixture;

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        fixture = await ext.activate();
        assert.ok(fixture);
    });

    suite('Conflicts within single scope', function () {

        // определения задач
        suite('TaskDefinition.mapTaskDefinitions', function () {

            let taskInUser: Immutable<TaskDefinitionEntry> | undefined;
            let taskInPrima: Immutable<TaskDefinitionEntry> | undefined;

            suiteSetup(function () {

                taskInUser = fixture.taskDefinitionMap.get(fixture.availableKeys.userKey)?.get(fixture.testedTaskName);

                taskInPrima = fixture.availableKeys.primaKey
                    ? fixture.taskDefinitionMap.get(fixture.availableKeys.primaKey)?.get(fixture.testedTaskName)
                    : undefined;

                // single-folder
                assert.equal(fixture.availableKeys.workspaceKey, undefined);
                assert.equal(fixture.availableKeys.folder2Key, undefined);
            });


            test('single-folder-conflicts-within-single-scope', function () {

                // Где "My Task" определен
                assert.equal(taskInUser, undefined);
                assert.ok(taskInPrima);

                // Что отображается
                assert.equal(taskInPrima.effective?.taskName, fixture.testedTaskName);

                // Что затеняется
                assert.deepEqual(taskInPrima.shadowed?.map(d => d.taskName), [fixture.testedTaskName, fixture.testedTaskName]);

            });

            test('Побеждает задача последняя по порядку в файле', function () {
                assert.ok(taskInPrima);
                assert.equal(taskInPrima.effective?.icon?.id, 'my-task-3');
            });

            test('Список затененных в порядке из файла', function () {
                assert.ok(taskInPrima);
                assert.deepEqual(taskInPrima.shadowed?.map(d => d.icon?.id), ['my-task-1', 'my-task-2']);
            });

        });


        // runtime задачи
        suite('EligibleTask.mapEligibleTasks', function () {

            let taskInUser: Immutable<EligibleTask> | undefined;
            let taskInPrima: Immutable<EligibleTask> | undefined;

            suiteSetup(function () {

                taskInUser = fixture.eligibleTaskMap.get(fixture.availableKeys.userKey)?.get(fixture.testedTaskName);

                taskInPrima = fixture.availableKeys.primaKey
                    ? fixture.eligibleTaskMap.get(fixture.availableKeys.primaKey)?.get(fixture.testedTaskName)
                    : undefined;

                // single-folder
                assert.equal(fixture.availableKeys.workspaceKey, undefined);
                assert.equal(fixture.availableKeys.folder2Key, undefined);
            });

            test('single-folder-conflicts-within-single-scope', function () {

                // Где "My Task" доступен
                assert.equal(taskInUser, undefined);
                assert.ok(taskInPrima);

                // что будет запускаться
                assert.equal((taskInPrima.execution as vscode.ShellExecution).commandLine, 'run-my-task-3');

            });
        });

    });
});
