/** @file src/extension.ts */

import * as vscode from 'vscode';
import { FreezeTreeProvider, asTreeDataProvider } from './treeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const provider = new FreezeTreeProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'freezeTree.view',
            asTreeDataProvider(provider),
        ),
    );
}

export function deactivate(): void { }
