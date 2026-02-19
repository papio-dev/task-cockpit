import * as vscode from 'vscode';
import { Console } from 'console';
import path from 'path';

export class AssertionFailed extends Error {
    readonly name = 'AssertionFailed';
    constructor(message: string) {
        super(message);
    }
}

type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
type AssertFn = (condition: unknown, text: string, fail?: boolean) => void;
type FailFn = (condition: unknown, text: string, fail?: boolean) => asserts condition;
type TableFn = (level: vscode.LogLevel, data: Record<string, unknown> | Record<string, unknown>[], config?: { headers?: string[]; undefinedAsEmpty?: boolean; }) => void;

const debugFlag = ['true', 'on'].includes((process.env.USER_TASK_DEBUG || 'off').toLowerCase());
const useConsoleFlag = ['true', 'on'].includes((process.env.USER_TASK_CONSOLE_LOG || 'off').toLowerCase());


const logChannel: vscode.LogOutputChannel | Console | undefined =
    debugFlag
        ? useConsoleFlag
            ? console
            : vscode.window.createOutputChannel('Task Cockpit Extension', { log: true })
        : undefined;


function dispose() {
    if (logChannel && 'dispose' in logChannel && typeof logChannel.dispose === 'function') {
        logChannel.dispose();
    }
}

function get(file: string): { logger: LoggerFn; assert: AssertFn; fail: FailFn; table: TableFn; } {

    const ext = vscode.extensions.getExtension('lumen-dev.task-cockpit')!;
    const id = `${file.replace(`${ext.extensionPath}${path.sep}`, '')}`;

    return {
        logger: out.bind(undefined, id),
        assert: assert.bind(undefined, id),
        fail: fail.bind(undefined, id),
        table: table.bind(undefined, id),
    };
}


function out(id: string, level: vscode.LogLevel, text: string, identity?: string) {

    if (!logChannel || level === vscode.LogLevel.Off) {
        return;
    }

    const prefix = `${id.replace(/\.js$/, '')}${identity ? `::[[ ${identity} ]]` : ''}`;
    const msg = `${prefix}: ${text}`;

    switch (level) {
        case vscode.LogLevel.Trace:
            if (logChannel instanceof Console) {
                logChannel.info(msg);
                break;
            }
            logChannel.trace(msg);
            break;

        case vscode.LogLevel.Warning:
            logChannel.warn(msg);
            break;

        case vscode.LogLevel.Info:
            logChannel.info(msg);
            break;

        case vscode.LogLevel.Error:
            logChannel.error(msg);
            break;

        case vscode.LogLevel.Debug:
            logChannel.debug(msg);
            break;

        default:
            throw new Error();
    }
}


function assert(id: string, condition: unknown, text: string) {

    if (condition) {
        return;
    }

    out(id, vscode.LogLevel.Error, text, 'Assertion failed');

}

function fail(id: string, condition: unknown, text: string) {

    if (condition) {
        return;
    }

    new AssertionFailed(`${id.replace(/\.js$/, '')}: ${text}`);
}

function formatValue(value: unknown, undefinedAsEmpty?: boolean): string {

    if (value === undefined) { return undefinedAsEmpty ? '' : 'undefined'; };
    if (typeof value === 'function') { return '<function>'; };
    if (typeof value === 'symbol') { return value.toString(); };

    if (Array.isArray(value)) {
        return `${value.length} item(s)`;
    }
    else {
        try {
            return JSON.stringify(value);
        }
        catch {
            return '<circular>';
        }
    }
}

function table(id: string, level: vscode.LogLevel, data: Record<string, unknown> | Record<string, unknown>[], config?: { headers?: string[]; undefinedAsEmpty?: boolean; }) {
    if (!logChannel) {
        return;
    }
    const rows: Record<string, unknown>[] = Array.isArray(data) ? data : Object.entries(data).map(([k, v]) => ({ '(index)': k, Value: v }));
    if (rows.length === 0) {
        out(id, vscode.LogLevel.Info, '(empty table)');
        return;
    }
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const columnHeaders = config?.headers ?? keys;
    const widths = new Map<string, number>();
    for (let i = 0; i < keys.length; i++) {
        const header = columnHeaders[i] ?? keys[i];
        widths.set(keys[i], header.length);
    }
    for (const row of rows) {
        for (const key of keys) {
            const val = formatValue(row[key], config?.undefinedAsEmpty);
            widths.set(key, Math.max(widths.get(key)!, val.length));
        }
    }
    const sep = keys.map(k => '─'.repeat(widths.get(k)! + 2)).join('┼');
    const header = keys.map((k, i) => ` ${(columnHeaders[i] ?? k).padEnd(widths.get(k)!)} `).join('│');
    const lines = rows.map(row =>
        keys.map(k => ` ${formatValue(row[k], config?.undefinedAsEmpty).padEnd(widths.get(k)!)} `).join('│')
    );
    const output = [`┌${sep.replaceAll('┼', '┬')}┐`, `│${header}│`, `├${sep}┤`, ...lines.map(l => `│${l}│`), `└${sep.replaceAll('┼', '┴')}┘`];
    output.forEach(line => {
        out(id, level, line);
    });
}

export {
    dispose,
    get
};
