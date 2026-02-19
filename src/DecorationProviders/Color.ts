import * as vscode from 'vscode';
import { decodeQueryComponent } from './QueryComponent';


export class Color implements vscode.FileDecorationProvider {


    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {

        if (uri.scheme !== "task-cockpit" || token.isCancellationRequested) {
            return undefined;
        }

        if (!(uri.path === 'task' || uri.path === 'marker')) {
            return undefined;
        }

        const metadata = decodeQueryComponent(uri.query);

        if (!metadata) {
            return undefined;
        }

        const color = metadata.color;

        if (!color) {
            return undefined;
        }

        return {
            color: new vscode.ThemeColor(color),
            propagate: false,
        };

    }
}
