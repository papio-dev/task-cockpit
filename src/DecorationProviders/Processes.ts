import * as vscode from 'vscode';
import { decodeQueryComponent } from './QueryComponent';

export class Processes implements vscode.FileDecorationProvider {
    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {

        if (uri.scheme !== "task-cockpit" || uri.path !== 'task' || token.isCancellationRequested) {
            return undefined;
        }

        const metadata = decodeQueryComponent(uri.query);

        if (!metadata) {
            return undefined;
        }

        const processes = metadata.processes ?? 0;

        if (processes < 1) {
            return undefined;
        }

        const running = metadata.running ?? 0;

        // Большой кружок если есть running, маленький если нет
        const badge = (running > 0 ? '●' : '•') + (running > 1 ? (running > 9 ? '+' : running) : '');

        return (token.isCancellationRequested) ? undefined : {
            badge: badge,
            propagate: false,
        };
    }
}
