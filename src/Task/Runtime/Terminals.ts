import * as vscode from 'vscode';
import {
    isValidPid,
    ProcessId
} from '../Basic';


// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
try {
    ({ logger, assert } = require('../../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


export interface TerminalSnapshot {
    timestamp: number,
    processIds: ReadonlySet<ProcessId>;
}


interface ActiveRequest {
    timestamp: number;
    cancellation: vscode.CancellationTokenSource;
}


/** Резолвер PID открытых терминалов VS Code.
 *
 * Возвращает атомарный снимок (snapshot) PID всех терминалов.
 * Гарантирует целостность: либо все терминалы опрошены, либо запрос отменён.
 *
 * ## API
 *
 * ### Методы:
 * - `reconcile(timestamp)` — инициировать сбор PID, результат через событие
 * - `dispose()` — освободить ресурсы, отменить активные запросы
 *
 * ### События:
 * - `onReconciledTerminals` — snapshot готов
 *
 * ## Модель конкурентности
 *
 * Latest-wins с run-to-completion:
 * - Новый запрос вытесняет pending, но не прерывает активный
 * - Активный запрос всегда завершается полностью
 * - Гарантия: последний запрос будет выполнен
 *
 * ## Важно
 *
 * - Кэширование запрещено — каждый вызов опрашивает API заново
 * - Терминал не ответивший за timeout исключается из результата (не ошибка)
 * - Частичные результаты не возвращаются — только полный snapshot
 *
 * @see Terminals.md — детали реализации, обоснование решений */
export class Terminals implements vscode.Disposable {

    private readonly timeout: number;

    private readonly reconciledEmitter: vscode.EventEmitter<TerminalSnapshot>;
    public readonly onDidReconcile: vscode.Event<TerminalSnapshot>;


    private activeExecution: ActiveRequest | undefined;
    private pending: number | undefined;

    private disposed: boolean;


    constructor(timeout: number) {
        this.disposed = false;
        this.timeout = timeout;

        this.reconciledEmitter = new vscode.EventEmitter<TerminalSnapshot>();
        this.onDidReconcile = this.reconciledEmitter.event;
    }


    // #region Публичный API

    /** Инициировать сбор PID всех открытых терминалов.
     *
     * Опрашивает каждый терминал с индивидуальным таймаутом.
     * Терминалы не ответившие вовремя исключаются из результата.
     * Результат приходит через событие `onDidReconcile`.
     *
     * При вызове во время выполнения предыдущего запроса:
     * - Активный запрос продолжает выполняться до конца
     * - Pending запрос (если был) молча вытесняется
     * - Новый запрос становится pending и выполнится после активного
     *
     * @param timestamp — идентификатор запроса (возвращается в snapshot)
     *
     * @fire onDidReconcile */
    public reconcile(timestamp: number): void {

        if (this.disposed) {
            return;
        }

        // #region DEBUG
        const status = this.activeExecution
            ? (this.pending !== undefined ? `queued, supersedes ${this.pending}` : 'queued')
            : 'immediate';
        logger?.(vscode.LogLevel.Debug, `Reconcile requested (${status})`, timestamp.toString());
        // #endregion DEBUG

        // заместить в очереди
        this.pending = timestamp;

        // попробовать запустить (если idle)
        if (this.activeExecution === undefined) {
            this.executeNext();
        }


    }

    public dispose(): void {
        this.disposed = true;
        this.reconciledEmitter.dispose();
        this.cancelActive();
        this.pending = undefined;

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'disposed');
        // #endregion DEBUG
    }

    // #endregion



    // #region Управление очередью


    // #endregion


    // #region Выполнение

    // взять из очереди и запустить
    private async executeNext(): Promise<void> {

        if (this.pending === undefined) {
            return;
        }

        const execution = {
            timestamp: this.pending,
            cancellation: new vscode.CancellationTokenSource
        };

        this.activeExecution = execution;
        this.pending = undefined;

        // выполнить конкретный запрос

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'Executing request',
            execution.timestamp.toString());
        // #endregion DEBUG

        try {

            const result = await this.performReconciliation(execution.timestamp, execution.cancellation.token);
            this.reconciledEmitter.fire(result);

        } catch (error) {

            // #region DEBUG
            if (error instanceof Error && !(error instanceof vscode.CancellationError)) {
                logger?.(
                    vscode.LogLevel.Error,
                    `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
                    execution.timestamp.toString());
            }

            logger?.(
                vscode.LogLevel.Debug,
                'Request has been canceled',
                execution.timestamp.toString());

            // #endregion DEBUG


        } finally {

            if (this.activeExecution) {
                //  очистка + запуск следующего
                execution.cancellation.dispose();
                this.activeExecution = undefined;

                // Это не рекурсия (Tail Call в async): стек очищен благодаря await выше.
                // Следующий вызов встает в очередь микрозадач.
                this.executeNext();
            }

        }

    }


    // отменить текущий (для dispose)
    private cancelActive(): void {

        if (!this.activeExecution) {
            return;
        }

        this.activeExecution.cancellation.cancel();
        this.activeExecution.cancellation.dispose();
        this.activeExecution = undefined;
    }

    // #endregion


    // #region Резолвинг

    private async performReconciliation(
        timestamp: number,
        cancellationToken: vscode.CancellationToken
    ): Promise<TerminalSnapshot> {

        if (cancellationToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        const terminals = vscode.window.terminals;

        if (terminals.length === 0) {
            return { timestamp, processIds: new Set() };
        }

        // Запускаем опрос.
        const results = await Promise.all(
            terminals.map(t => this.getTerminalPid(t, cancellationToken))
        );

        if (cancellationToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // #region DEBUG
        const responded = results.filter(p => p !== undefined).length;
        const failed = terminals.length - responded;
        logger?.(
            vscode.LogLevel.Debug,
            `${responded}/${terminals.length} terminals responded` +
            (failed > 0 ? `, ${failed} timed out or closed` : ''),
            timestamp.toString());
        // #endregion DEBUG

        // Фильтруем закрытые/зависшие (undefined)
        return {
            timestamp,
            processIds: new Set(
                results.filter((pid): pid is ProcessId => pid !== undefined)
            )
        };
    }

    // Считаю этот метод завершенным. не стоит его изменять без явной выгоды
    public async getTerminalPid(
        terminal: vscode.Terminal,
        cancellationToken?: vscode.CancellationToken
    ): Promise<ProcessId | undefined> {

        if (this.disposed) {
            return;
        }

        if (cancellationToken && cancellationToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        let timeoutId: NodeJS.Timeout | undefined;
        let disposeListener: vscode.Disposable | undefined;
        let cancellationListener: vscode.Disposable | undefined;

        try {

            const racers: PromiseLike<ProcessId | undefined>[] = [
                // Успешный исход
                terminal.processId.then(pid => isValidPid(pid) ? pid : undefined)
            ];

            racers.push(
                // Тайм-аут
                // Workaround для багов #91905 (2020) и #236869 (2024):
                // processId зависает, если есть проблемы с shellIntegration и т.д.
                new Promise<undefined>((resolve) => {
                    timeoutId = setTimeout(() => {

                        // // #region DEBUG
                        // logger?.(
                        //     vscode.LogLevel.Warning,
                        //     `Terminal "${terminal.name || '<unnamed>'}" PID resolution timed out`);
                        // // #endregion DEBUG

                        resolve(undefined);
                    }, this.timeout);
                }),
            );

            racers.push(
                // Закрытие терминала
                new Promise<undefined>((resolve) => {
                    disposeListener = vscode.window.onDidCloseTerminal(t => {
                        if (t === terminal) {
                            resolve(undefined);
                        };
                    });
                    if (terminal.exitStatus) {
                        resolve(undefined);
                    }
                }),
            );

            if (cancellationToken) {
                racers.push(
                    new Promise<never>((_, reject) => {
                        cancellationListener = cancellationToken.onCancellationRequested(() => reject(new vscode.CancellationError()));
                        if (cancellationToken.isCancellationRequested) {
                            reject(new vscode.CancellationError());
                        }
                    })
                );
            }

            return await Promise.race(racers);

        } finally {
            // безусловная очистка
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (disposeListener) {
                disposeListener.dispose();
            }
            if (cancellationListener) {
                cancellationListener.dispose();
            }
        }
    }

    // #endregion

}
