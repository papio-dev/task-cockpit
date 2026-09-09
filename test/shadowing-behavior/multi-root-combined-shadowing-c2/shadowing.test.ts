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
//             "icon": {
//                 "id": "u-1"
//             },
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
// <нет>
//
// project/folder2/.vscode/tasks.json
// {
//     "version": "2.0.0",
//     "tasks": [
//         {
//             "label": "My Task",
//             "icon": {
//                 "id": "f2-1"
//             },
//             "command": "run-folder2-level-task-1",
//             "type": "shell",
//             "problemMatcher": []
//         },
//         {
//             "label": "My Task",
//             "icon": {
//                 "id": "f2-2"
//             },
//             "command": "run-folder2-level-task-2",
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

    suite('Combined shadowing: within-scope в folder2 изолирован от cross-scope', function () {

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

            // C2: Folder2 с двумя My Task изолирована — cross-scope shadowing (User над Prima)
            // не затрагивает Folder2. Внутри Folder2 работает стандартный within-scope: last wins.
            test('multi-root-combined-shadowing-c2', function () {

                assert.ok(taskInUser);
                assert.equal(taskInWorkspace, undefined);
                assert.equal(taskInPrima, undefined);
                assert.ok(taskInFolder2);

                assert.ok(taskInUser.effective);
                assert.equal(taskInUser.shadowed, undefined);

                assert.ok(taskInFolder2.effective);
                assert.equal(taskInFolder2.effective?.icon?.id, 'f2-2');
                assert.deepEqual(taskInFolder2.shadowed?.map(d => d.icon?.id), ['f2-1']);
            });

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

        test('multi-root-combined-shadowing-c2', function () {

            // Где "My Task" доступен
            assert.ok(taskInUser);                    // +
            assert.equal(taskInWorkspace, undefined); // -
            assert.equal(taskInPrima, undefined);     // -
            assert.ok(taskInFolder2);                 // +

            // что будет запускаться
            assert.equal((taskInUser.execution as vscode.ShellExecution).commandLine, 'run-user-level-task');
            assert.equal((taskInFolder2.execution as vscode.ShellExecution).commandLine, 'run-folder2-level-task-2');

        });

    });
});
