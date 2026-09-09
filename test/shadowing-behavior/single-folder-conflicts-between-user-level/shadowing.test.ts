import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import type IFixture from '../extension';
import type Immutable from '../../../src/utils/Immutable';
import type TaskDefinitionEntry from '../../../src/ResourceStateCoordinator/TaskDefinition/TaskDefinitionEntry';
import type EligibleTask from '../../../src/ResourceStateCoordinator/EligibleTask/EligibleTask';

// User/profiles/.../tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [
//         {
//             "label": "My Task",
//             "command": "run-user-level-task",
//             "type": "shell",
//             "problemMatcher": []
//         }
//     ]
// }
//
// project/.vscode/tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [
//         {
//             "label": "My Task",
//             "command": "run-project-level-task",
//             "type": "shell",
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

    suite('Conflicts between User level', function () {

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

            test('single-folder-conflicts-between-user-level', function () {

                // Где "My Task" определен
                assert.ok(taskInUser);
                assert.ok(taskInPrima);

                // Что отображается
                assert.ok(taskInUser.effective);
                assert.equal(taskInPrima.effective, null);

                // Что затеняется
                assert.equal(taskInUser.shadowed, undefined);
                assert.deepEqual(taskInPrima.shadowed?.map(d => d.taskName), [fixture.testedTaskName]);
            });

        });

        // runtime задачи
        suite('EligibleTask.mapEligibleTasks', function () {

            let taskInUser: Immutable<EligibleTask> | undefined;
            let taskInPrima: Immutable<EligibleTask> | undefined;

            suiteSetup(function () {

                taskInUser = fixture.eligibleTaskMap.get(fixture.availableKeys.userKey)?.get(fixture.testedTaskName);

                taskInPrima =
                    fixture.availableKeys.primaKey
                        ? fixture.eligibleTaskMap.get(fixture.availableKeys.primaKey)?.get(fixture.testedTaskName)
                        : undefined;

                // single-folder
                assert.equal(fixture.availableKeys.workspaceKey, undefined);
                assert.equal(fixture.availableKeys.folder2Key, undefined);
            });

            test('single-folder-conflicts-between-user-level', function () {

                // Где "My Task" доступен
                assert.ok(taskInUser);
                assert.equal(taskInPrima, undefined);

                // что будет запускаться
                assert.equal((taskInUser.execution as vscode.ShellExecution).commandLine, 'run-user-level-task');

            });
        });

    });
});
