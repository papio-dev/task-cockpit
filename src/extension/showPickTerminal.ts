/** @file extension/showPickTerminal.ts */

import {
    env,
    ThemeIcon,
    window
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type TaskProcessRecord from '../Runtime/TaskProcessRecord';


async function showPickTerminal(
    taskLabel: string,
    taskProcesses: Immutable<Array<TaskProcessRecord>>
) {

    const iconPath = new ThemeIcon('terminal');

    const items = taskProcesses.map((taskProcess) => ({
        label: `Process ID: ${taskProcess.taskProcessId}`,
        iconPath,
        description: taskProcess.running ? 'running' : 'completed',
        detail: new Date(taskProcess.timestamp).toLocaleString(env.language),
        terminalRef: taskProcess.terminalRef
    }));

    return (await window.showQuickPick(items, {
        title: taskLabel,
        placeHolder: 'Select terminal',
        matchOnDescription: true,
        matchOnDetail: true
    }))?.terminalRef;
}

export default showPickTerminal;
