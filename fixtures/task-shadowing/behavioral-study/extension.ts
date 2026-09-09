/** @file extension.ts */

import * as vscode from 'vscode';
import ResourceStateCoordinator from '../../../src/ResourceStateCoordinator/ResourceStateCoordinator';
import OriginKey from '../../../src/OriginKey';
import TaskName from '../../../src/TaskName';
import type ResourceConfig from '../../../src/ResourceStateCoordinator/ResourceConfig/ResourceConfig';
import TaskDefinitionEntry from '../../../src/ResourceStateCoordinator/TaskDefinition/TaskDefinitionEntry';
import Immutable from '../../../src/utils/Immutable';
import EligibleTask from '../../../src/ResourceStateCoordinator/EligibleTask/EligibleTask';


export async function activate(context: vscode.ExtensionContext): Promise<void> {

    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];

    const log = vscode.window.createOutputChannel(extName);
    const trace = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(log, trace);

    log.appendLine(section('ACTIVATED'));
    log.appendLine(`  id:        ${ext.id} ${ext.packageJSON['version']}`);
    log.appendLine(`  mode:      ${vscode.ExtensionMode[context.extensionMode]}`);
    log.appendLine(`  vscode:    ${vscode.version}`);
    log.appendLine(`  node:      ${process.version} ${process.platform} ${process.arch}`);
    log.appendLine(`  log level: ${vscode.LogLevel[trace.logLevel]}`);
    log.appendLine(`  workspace: ${workspaceName()}`);
    log.show();

    await run(context.subscriptions, log, trace);
}


async function run(
    subscriptions: { dispose(): void; }[],
    log: vscode.OutputChannel,
    trace: vscode.LogOutputChannel,
) {
    let changeCount = 0;
    let coordinator = await initCoordinator(log, trace);
    let changeListener = subscribeChanges();

    // changeListener управляется вручную (recreate), поэтому — прокси
    subscriptions.push({ dispose: () => { changeListener.dispose(); } });

    function subscribeChanges(): vscode.Disposable {
        return coordinator.onDidCompleteUpdate(async (affectedKeys) => {
            changeCount++;
            log.appendLine(section(`CHANGE #${changeCount}  ${ts()}  keys: ${[...affectedKeys].join(', ')}`));
            await printState(coordinator, log);
        });
    }

    function reg(id: string, fn: () => void | Promise<void>): vscode.Disposable {
        return vscode.commands.registerCommand(id, fn);
    }

    subscriptions.push(

        reg('_debug.printState', async () => {
            log.appendLine(section(`MANUAL PRINT  ${ts()}`));
            await printState(coordinator, log);
        }),

        reg('_debug.forceFullRefresh', async () => {
            log.appendLine(rule(`force-full-refresh  ${ts()}`));
            await coordinator.forceFullRefresh();
        }),

        reg('_debug.recreate', async () => {
            changeListener.dispose();
            coordinator.dispose();
            log.appendLine(section(`RECREATE  ${ts()}`));
            coordinator = await initCoordinator(log, trace);
            await printState(coordinator, log);
            changeListener = subscribeChanges();
        }),


        vscode.tasks.onDidStartTaskProcess(async (e) => {

            const task = e.execution.task;

            const origin = await coordinator.resolveTaskOrigin(task);
            if (!origin) {
                return;
            }

            log.appendLine(rule(`TASK STARTED  ${ts()}  pid: ${e.processId}`));
            log.appendLine(`    name    : ${task.name}`);
            log.appendLine(`    origin  : ${OriginKey.resolveOriginName(origin)}`);
            log.appendLine(`    source  : ${task.source}`);
            log.appendLine(`    scope   : ${taskScopeLabel(task.scope)}`);
            log.appendLine(`    command : "${(task.execution as vscode.ShellExecution).commandLine}"`);
            log.appendLine(`    detail  : ${task.detail ?? '(none)'}`);
        }),

    );

    log.appendLine('');
    log.appendLine('  commands:');
    log.appendLine('    _debug.printState          print current state');
    log.appendLine('    _debug.forceFullRefresh    force full refresh');
    log.appendLine('    _debug.recreate            dispose and recreate coordinator');

    log.appendLine(section(`INITIAL STATE  ${ts()}`));
    await printState(coordinator, log);
}


async function initCoordinator(
    log: vscode.OutputChannel,
    trace: vscode.LogOutputChannel,
): Promise<ResourceStateCoordinator> {
    log.appendLine('  creating coordinator...');
    const coordinator = await ResourceStateCoordinator.create(10_000, trace);
    log.appendLine('  coordinator ready');
    return coordinator;
}


async function printState(coordinator: ResourceStateCoordinator, log: vscode.OutputChannel) {
    const layout = await coordinator.getProjectLayout();

    await printScope(coordinator, log, 'User', 'global', OriginKey.USER);

    if (layout.workspace) {
        await printScope(coordinator, log, layout.workspace.name, 'workspace', OriginKey.WORKSPACE);
    }

    for (const folder of layout.folders ?? []) {
        await printScope(coordinator, log, folder.name, 'folder', folder.key);
    }
}


async function printScope(
    coordinator: ResourceStateCoordinator,
    log: vscode.OutputChannel,
    name: string,
    kind: string,
    key: OriginKey,
) {
    const config = await coordinator.getResourceConfig(key);
    const definitions = await coordinator.getOriginTaskDefinitions(key);
    const eligible = await coordinator.getEligibleTasks(key);

    log.appendLine('');
    log.appendLine(`  -- ${name}  [${kind}]`);

    // COnfig
    // --------------------------------------------------------------------
    // if (!config) {
    //     log.appendLine('    config: (null — scope does not exist)');
    //     return;
    // }
    //
    // log.appendLine('    config:');
    // printConfig(config, log);
    // --------------------------------------------------------------------

    log.appendLine('    tasks:');

    if (!definitions || definitions.size === 0) {
        log.appendLine('      (none)');
        return;
    }

    for (const [taskName, definitionsEntry] of definitions) {
        printTask(log, taskName, definitionsEntry, config, eligible);
    }
}


function printTask(
    log: vscode.OutputChannel,
    taskName: TaskName,
    definitionsEntry: Immutable<TaskDefinitionEntry>,
    config: Immutable<ResourceConfig> | null,
    eligible: Immutable<Map<TaskName, EligibleTask>> | null
) {
    const displayName = TaskName.formatTaskName(taskName, config ? { segmentSeparator: config.Hierarchy.segmentSeparator, displaySeparator: ' > ' } : null);

    const isActive = definitionsEntry.effective != null;
    const shadowedCount = definitionsEntry.shadowed?.length ?? 0;

    if (isActive) {
        const runtimeTask = eligible?.get(taskName);
        log.appendLine(`      +  ${displayName.padEnd(18)}; ${runtimeTask ? `command: "${(runtimeTask.execution as vscode.ShellExecution).commandLine}"` : '« wrong task definition »'}`);
    }

    if (shadowedCount > 0) {
        for (let i = 0; i < shadowedCount; ++i) {
            log.appendLine(`      -  ${displayName.padEnd(18)}; « shadowed »`);
        }
    }


}


function printConfig(config: ResourceConfig, log: vscode.OutputChannel) {
    for (const [grp, value] of Object.entries(config)) {
        if (value !== null && typeof value === 'object') {
            for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
                log.appendLine(`      ${`${grp}.${field}`.padEnd(32)}${JSON.stringify(fieldValue)}`);
            }
        } else {
            log.appendLine(`      ${String(grp).padEnd(32)}${JSON.stringify(value)}`);
        }
    }
}


// --- утилиты ---

const SEP = '='.repeat(72);
const RULE = '-'.repeat(72);

function section(title: string): string {
    return `\n${SEP}\n  ${title}\n${SEP}`;
}

function rule(title: string): string {
    return `\n${RULE}\n  ${title}\n${RULE}`;
}

function ts(): string {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const p3 = (n: number) => String(n).padStart(3, '0');
    return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p3(d.getMilliseconds())}`;
}

function workspaceName(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return '(none)';
    return vscode.workspace.name ? `"${vscode.workspace.name}"` : `"${folders[0]!.name}"`;
}

function taskScopeLabel(scope: vscode.TaskScope | vscode.WorkspaceFolder | undefined): string {
    if (scope === vscode.TaskScope.Global) return 'Global';
    if (scope === vscode.TaskScope.Workspace) return 'Workspace';
    if (scope != null && typeof scope === 'object') return `folder:"${(scope as vscode.WorkspaceFolder).name}"`;
    return '?';
}


export function deactivate(): void { }
