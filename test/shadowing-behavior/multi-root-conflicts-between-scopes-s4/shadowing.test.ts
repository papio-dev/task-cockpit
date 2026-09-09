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
// project/project.code-workspace
// {
// ...
//    "tasks": {
//        "version": "2.0.0",
//        "tasks": [ ]
//    }
// }
//
// project/folder1/.vscode/tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [ ]
// }
//
// project/folder2/.vscode/tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [ ]
// }

suite('Shadowing behavior', function () {

    let fixture: IFixture;

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        fixture = await ext.activate();
        assert.ok(fixture);
    });

    suite('Conflicts between scopes', function () {

        // определения задач
        suite('TaskDefinition.mapTaskDefinitions', function () {

            let taskInUser: Immutable<TaskDefinitionEntry> | undefined;
            let taskInWorkspace: Immutable<TaskDefinitionEntry> | undefined;
            let taskInPrima: Immutable<TaskDefinitionEntry> | undefined;
            let taskInFolder2: Immutable<TaskDefinitionEntry> | undefined;

            suiteSetup(function () {

                taskInUser = fixture.availableKeys.userKey
                    ? fixture.taskDefinitionMap.get(fixture.availableKeys.userKey)?.get(fixture.testedTaskName)
                    : undefined;

                taskInWorkspace = fixture.availableKeys.workspaceKey
                    ? fixture.taskDefinitionMap.get(fixture.availableKeys.workspaceKey)?.get(fixture.testedTaskName)
                    : undefined;

                taskInPrima = fixture.availableKeys.primaKey
                    ? fixture.taskDefinitionMap.get(fixture.availableKeys.primaKey)?.get(fixture.testedTaskName)
                    : undefined;

                taskInFolder2 = fixture.availableKeys.folder2Key
                    ? fixture.taskDefinitionMap.get(fixture.availableKeys.folder2Key)?.get(fixture.testedTaskName)
                    : undefined;
            });


            test('multi-root-conflicts-between-scopes-s4', function () {

                // Где "My Task" определен
                assert.ok(taskInUser);                    // +
                assert.equal(taskInWorkspace, undefined); // -
                assert.equal(taskInPrima, undefined);     // -

                assert.equal(taskInFolder2, undefined);   // -

                // Что отображается
                assert.ok(taskInUser.effective);

                // Что затеняется
                assert.equal(taskInUser.shadowed, undefined);

            });

        });

        // runtime задачи
        suite('EligibleTask.mapEligibleTasks', function () {

            let taskInUser: Immutable<EligibleTask> | undefined;
            let taskInWorkspace: Immutable<EligibleTask> | undefined;
            let taskInPrima: Immutable<EligibleTask> | undefined;
            let taskInFolder2: Immutable<EligibleTask> | undefined;

            suiteSetup(function () {

                taskInUser = fixture.eligibleTaskMap.get(fixture.availableKeys.userKey)?.get(fixture.testedTaskName);

                taskInWorkspace =
                    fixture.availableKeys.workspaceKey
                        ? fixture.eligibleTaskMap.get(fixture.availableKeys.workspaceKey)?.get(fixture.testedTaskName)
                        : undefined;

                taskInPrima =
                    fixture.availableKeys.primaKey
                        ? fixture.eligibleTaskMap.get(fixture.availableKeys.primaKey)?.get(fixture.testedTaskName)
                        : undefined;

                taskInFolder2 =
                    fixture.availableKeys.folder2Key
                        ? fixture.eligibleTaskMap.get(fixture.availableKeys.folder2Key)?.get(fixture.testedTaskName)
                        : undefined;

            });

            test('multi-root-conflicts-between-scopes-s4', function () {

                // Где "My Task" доступен
                assert.ok(taskInUser);                     // +
                assert.equal(taskInWorkspace, undefined);  // -
                assert.equal(taskInPrima, undefined);      // -

                assert.equal(taskInFolder2, undefined);    // -

                // что будет запускаться
                assert.equal((taskInUser.execution as vscode.ShellExecution).commandLine, 'run-user-level-task');

            });
        });

    });
});
