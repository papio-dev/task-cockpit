import * as vscode from 'vscode';
import { PerformanceObserver, performance } from 'perf_hooks';

export async function activate(context: vscode.ExtensionContext): Promise<void> {

    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];

    const logChannel = vscode.window.createOutputChannel(extName);
    const traceChannel = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(logChannel, traceChannel);

    logChannel.appendLine(`extension: ${ext.id} ${ext.packageJSON['version']}`);
    logChannel.appendLine(`mode: ${vscode.ExtensionMode[context.extensionMode]}`);
    logChannel.appendLine(`vscode: ${vscode.version}`);
    logChannel.appendLine(`node: ${process.version} ${process.platform} ${process.arch}`);
    logChannel.appendLine(`log level: ${vscode.LogLevel[traceChannel.logLevel]}`);
    logChannel.appendLine(`workspace: ${vscode.workspace.name ? vscode.workspace.name : vscode.workspace.workspaceFolders?.[0] ? `"${vscode.workspace.workspaceFolders![0]?.name}"` : '(none)'}`);

    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.appendLine('-'.repeat(80));
    logChannel.show();

    await run(context.subscriptions, logChannel, traceChannel);
}


export function deactivate(): void { }

// ----------------------------------------------

async function run(
    subscriptions: { dispose(): unknown; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel,
): Promise<void> {

    const query = 'available=5&running=2&tintColor=charts.red';

    const N = 100_000;

    // --- URLSearchParams ---
    let t0 = performance.now();
    for (let i = 0; i < N; i++) {
        const p = new URLSearchParams(query);
        p.get('available'); p.get('running'); p.get('tintColor');
    }
    logChannel.appendLine(`URLSearchParams: ${performance.now() - t0} ms`);

    // --- manual ---
    t0 = performance.now();
    for (let i = 0; i < N; i++) {
        parseUriQuery(query); // твой вариант
    }
    logChannel.appendLine(`manual: ${performance.now() - t0} ms`);

    await new Promise(r => setTimeout(r, 5_000));

    logChannel.appendLine(
        measure('URLSearchParams', () => {
            const p = new URLSearchParams(query);
            p.get('available'); p.get('running'); p.get('tintColor');
        })
    );

    // пауза между прогонами, чтобы GC успел отработать остатки первого
    await new Promise(r => setTimeout(r, 5_000));

    logChannel.appendLine(
        measure('manual', () => {
            parseUriQuery(query);
        })
    );

}


function parseUriQuery(query: string): { available: string | null; running: string | null; tintColor: string | null; } {
    let available: string | null = null;
    let running: string | null = null;
    let tintColor: string | null = null;

    let start = 0;
    while (start <= query.length) {
        const ampIdx = query.indexOf('&', start);
        const end = ampIdx === -1 ? query.length : ampIdx;
        const eqIdx = query.indexOf('=', start);

        if (eqIdx !== -1 && eqIdx < end) {
            const key = query.slice(start, eqIdx);
            const val = query.slice(eqIdx + 1, end);
            if (key === 'available') available = val;
            else if (key === 'running') running = val;
            else if (key === 'tintColor') tintColor = val;
        }

        if (ampIdx === -1) break;
        start = ampIdx + 1;
    }

    return { available, running, tintColor };
}




const query = 'available=5&running=2&tintColor=charts.red';
const N = 100_000;

function measure(label: string, fn: () => void): string {
    let gcCount = 0;
    let gcDuration = 0;

    const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            gcCount++;
            gcDuration += entry.duration;
        }
    });
    obs.observe({ entryTypes: ['gc'] });

    const t0 = performance.now();
    for (let i = 0; i < N; i++) fn();
    const elapsed = performance.now() - t0;

    obs.disconnect();

    return `${label}: ${elapsed.toFixed(2)}ms | GC runs: ${gcCount} | GC time: ${gcDuration.toFixed(2)}ms`;
}
