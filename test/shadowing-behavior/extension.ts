import * as vscode from 'vscode';
import ProjectLayout from '../../src/ResourceStateCoordinator/ResourceStructure';
import assert from 'node:assert/strict';
import groupTaskDefinitions from '../../src/ResourceStateCoordinator/TaskDefinition/groupTaskDefinitions';
import groupEligibleTasks from '../../src/ResourceStateCoordinator/EligibleTask/groupEligibleTasks';
import type TaskName from '../../src/TaskName';
import type Immutable from '../../src/utils/Immutable';
import OriginKey from '../../src/OriginKey';
import type TaskDefinitionMap from '../../src/ResourceStateCoordinator/TaskDefinition/TaskDefinitionMap';
import EligibleTask from '../../src/ResourceStateCoordinator/EligibleTask/EligibleTask';
import type EligibleTasksMap from '../../src/ResourceStateCoordinator/EligibleTask/EligibleTasksMap';


interface IFixture {
    taskDefinitionMap: Immutable<Map<OriginKey, TaskDefinitionMap>>;
    eligibleTaskMap: Immutable<Map<OriginKey, EligibleTasksMap>>;
    availableKeys: {
        userKey: OriginKey.User,
        workspaceKey: OriginKey.Workspace | undefined,
        primaKey: OriginKey.Folder | undefined,
        folder2Key: OriginKey.Folder | undefined,
    };
    testedTaskName: TaskName;
}


export async function activate(context: vscode.ExtensionContext): Promise<Immutable<IFixture>> {


    const scopeLayout = ProjectLayout.build();
    const [primaKey, folder2Key] = scopeLayout.folders?.map(f => f.originKey) ?? [undefined, undefined];

    const taskDefinitionMap = groupTaskDefinitions(scopeLayout);

    const eligibleTasks = await EligibleTask.fetchTasks();

    const eligibleTaskMap = groupEligibleTasks(eligibleTasks, taskDefinitionMap);

    // console.log(
    //     JSON.stringify(eligibleTasks, (_, v) => v instanceof Map ? Object.fromEntries(v) : v)
    // );
    // process.exit(100);

    return {
        taskDefinitionMap,
        eligibleTaskMap,
        availableKeys: {
            userKey: scopeLayout.User.originKey,
            workspaceKey: scopeLayout.Workspace?.originKey,
            primaKey,
            folder2Key
        },
        testedTaskName: 'My Task' as TaskName
    };

}

export function deactivate(): void { }


export default IFixture;
