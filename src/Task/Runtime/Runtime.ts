import * as vscode from 'vscode';
import {
    idFromTask,
    TaskID,
    taskIdToString,
    isValidPid,
    ProcessId,
} from '../Basic';
import {
    Monitor,
} from './Monitor';
import {
    Terminals,
    TerminalSnapshot
} from './Terminals';


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


export interface ProcessInfo {
    running: boolean,
    timestamp: number;
}


export class Runtime implements vscode.Disposable {

    private readonly changeEmitter: vscode.EventEmitter<TaskID>;
    public readonly onDidChange: vscode.Event<TaskID>;

    /** Реестр всех процессов для задач с их статусами
     *
     * Все процессы остаются здесь с флагами alive/dead,
     * пока видны в терминале  */
    private readonly registry: Map<TaskID, Map<ProcessId, ProcessInfo>>;

    private disposables: vscode.Disposable;

    private readonly monitor: Monitor;
    private readonly terminals: Terminals;


    private disposed: boolean;

    /**  */
    constructor(shellIntegrationTimeout: number, polingCap: number) {

        this.disposed = false;

        this.registry = new Map<TaskID, Map<ProcessId, ProcessInfo>>();

        this.changeEmitter = new vscode.EventEmitter<TaskID>();
        this.onDidChange = this.changeEmitter.event;

        this.monitor = new Monitor(polingCap);
        this.terminals = new Terminals(shellIntegrationTimeout);


        this.disposables = vscode.Disposable.from(

            // задача породила процесс
            vscode.tasks.onDidStartTaskProcess((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"tasks.onDidStartTaskProcess" event received');
                // #endregion DEBUG

                this.processStartedHandler(e);
            }),

            // @todo возможно vscode.window.onDidEndTerminalShellExecution лучше? @reject
            // @reject - Bug:
            // Этот подход не работает для задач с "showReuseMessage": false -
            // {
            //     "label": "Test Task 1",
            //     "type": "shell",
            //     "command": "true",
            //     "presentation": {
            //         "showReuseMessage": false,
            //     },
            //     "problemMatcher": []
            // }
            // для таких задач не приходит onDidEndTerminalShellExecution
            // что делает не возможным отследить завершение процесса у задачи.
            // С событием vscode.tasks.onDidEndTaskProcess - то же есть проблемы.
            // ----
            // Процесс(ы) задач(и) сдох(ли)
            this.monitor.onProcessesCompleted((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"monitor.onProcessesCompleted" event received');
                // #endregion DEBUG

                this.processCompletedHandler(e);
            }),

            // любой терминал закрылся
            vscode.window.onDidCloseTerminal(() => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"window.onDidCloseTerminal" event received');
                // #endregion DEBUG

                this.terminals.reconcile(Date.now());
                // @todo: для оптимизации тут можно проверять и удалять конкретный процесс,
                // не проверять все терминалы.
                // Оставлю пока так для "а вдруг что-то пропускаю - почистит"
            }),

            // наконец-то обновилось состояние терминалов (возможно - протухшее)
            this.terminals.onDidReconcile((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"terminals.onDidReconcile" event received');
                // #endregion DEBUG

                this.terminalsReconciledHandler(e);
            }),

            this.monitor,
            this.terminals,
            this.changeEmitter,

        );
    }


    /** Cleanup: очистить все хранилища */
    dispose() {
        this.disposed = true;

        this.disposables.dispose();

        this.registry.clear();

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'disposed');
        // #endregion DEBUG
    }


    // это live view - возвращает мутируемое состояние, не кешируй ссылки.
    // Тут живая ссылка на Map. Если потребитель ожидает чего-то другого
    // — это его проблемы.
    public state(taskId: TaskID): ReadonlyMap<ProcessId, Readonly<ProcessInfo>> | undefined {

        if (this.disposed) {
            return undefined;
        }

        return this.registry.get(taskId);
    }


    public async getTerminals(taskId: TaskID): Promise<ReadonlyMap<vscode.Terminal, ProcessInfo & { processId: ProcessId; }>> {

        const stateInfo = this.registry.get(taskId);

        if (!stateInfo) {
            return new Map();
        }

        return new Map(
            (await Promise.all(
                vscode.window.terminals.map(async (terminal) => {
                    const processId = await this.terminals.getTerminalPid(terminal);

                    if (!processId) {
                        return undefined;
                    }

                    const processInfo = stateInfo.get(processId);

                    if (!processInfo) {
                        return undefined;
                    }

                    return [terminal, { ...processInfo, processId }] as const;
                })
            ))
                .filter((d): d is readonly [vscode.Terminal, ProcessInfo & { processId: ProcessId; }] => Boolean(d))
                .sort((a, b) => a[1].timestamp - b[1].timestamp) // Старый в верху
        );

    }


    // запрос на остановку все процессов задачи.
    // процессам будет отправлен SIGTERM.
    // Мгновенная остановка, как и остановка вообще - не гарантируется
    public abortAll(taskId: TaskID): void {

        if (this.disposed) {
            return;
        }

        const processes = this.registry.get(taskId);

        if (!processes || processes.size === 0) {
            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                'Abort requested but no processes registered',
                taskIdToString(taskId));
            // #endregion DEBUG
            return;
        }

        const runningProcesses = [...processes.entries()]
            .filter(([_, info]) => info.running)
            .map(([pid]) => pid);

        if (runningProcesses.length === 0) {
            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                `Abort requested, but none running from ${processes.size} process(es) registered`,
                taskIdToString(taskId));
            // #endregion DEBUG
            return;
        }

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            `Aborting ${runningProcesses.length} of ${processes.size} registered process(es)`,
            taskIdToString(taskId));
        // #endregion DEBUG

        for (const processId of runningProcesses) {
            this.killProcess(processId);
        }
    }


    private killProcess(pid: ProcessId): void {
        try {

            // @todo: Что с windows?
            // NO Win: попытка убить группу, fallback на сам процесс
            // Win: попытка убить только сам процесс
            try {
                if (process.platform === 'win32') {
                    process.kill(pid, 'SIGTERM');
                }
                else {
                    process.kill(-pid, 'SIGTERM');
                }
            }
            catch (error) {

                if (error instanceof Error && 'code' in error) {
                    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
                        return;
                    }
                }

                // для windows тут все
                if (process.platform === 'win32') {
                    return;
                }

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    'Group kill failed, falling back to direct kill',
                    pid.toString());
                // #endregion DEBUG


                process.kill(pid, 'SIGTERM');
            }

        }
        catch (error) {
            // ESRCH — уже мёртв
            if (error instanceof Error && 'code' in error) {
                if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
                    return;
                }
            }

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Warning,
                `Failed to kill process: ${error instanceof Error ? error.message : String(error)}`,
                pid.toString());
            // #endregion DEBUG

            // не фатально
            return;
        }
    }


    private processStartedHandler({ execution, processId }: vscode.TaskProcessStartEvent) {

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            `Task started with process "${processId}"`,
            execution.task.name);
        // #endregion DEBUG

        // начинаем следить, если "подходящая"
        if (isValidPid(processId)) { // сразу отбрасываем сломанное

            const taskId = idFromTask(execution.task);

            if (taskId) { // не следим за тем что не можем идентифицировать

                this.addProcess(processId, taskId, Date.now());

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Debug,
                    `Task process "${processId}" added to the registry`,
                    taskIdToString(taskId));
                // #endregion DEBUG

                this.changeEmitter.fire(taskId);

                this.monitor.addTaskProcess(processId);
            }
            // #region DEBUG
            else {
                logger?.(
                    vscode.LogLevel.Warning,
                    'Task is beyond the scope, monitoring is skipped',
                    execution.task.name);
            }
            // #endregion DEBUG
        }
        // #region DEBUG
        else {
            logger?.(
                vscode.LogLevel.Warning,
                `Invalid PID received: "${processId}"`,
                execution.task.name);
        }
        // #endregion DEBUG

        // в любом случае — пересмотр терминалов
        this.terminals.reconcile(Date.now());
    }


    private processCompletedHandler(completed: ReadonlySet<ProcessId>) {

        const ids = this.markCompleted(new Set(completed));

        if (ids.size > 0) {

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                `Completed ${ids.size} process(es):`);
            // #endregion DEBUG

            for (const taskId of ids) {
                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Debug,
                    'Marked as completed',
                    taskIdToString(taskId));
                // #endregion DEBUG


                this.changeEmitter.fire(taskId);
            }
        }

        // в любом случае — пересмотр терминалов
        this.terminals.reconcile(Date.now());
    }


    private terminalsReconciledHandler(snapshot: TerminalSnapshot) {

        const ids = this.removeUnavailableProcesses(snapshot);

        if (ids.size > 0) {

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                `Unavailable ${ids.size} process(es):`);
            // #endregion DEBUG

            for (const taskId of ids) {
                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Debug,
                    'Marked as unavailable',
                    taskIdToString(taskId));
                // #endregion DEBUG

                this.changeEmitter.fire(taskId);
            }
        }
    }


    private addProcess(processId: ProcessId, taskId: TaskID, timestamp: number): void {

        let processes = this.registry.get(taskId);

        if (!processes) {
            processes = new Map();
            this.registry.set(taskId, processes);
        }

        if (processes.has(processId)) {
            // #region DEBUG
            logger?.(
                vscode.LogLevel.Warning,
                `Duplicate process registration attempt: "${processId}"`,
                taskIdToString(taskId));
            // #endregion DEBUG
            return;
        }


        processes.set(processId, {
            timestamp: timestamp,
            running: true,
        });

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Trace,
            `Registered process "${processId}" (total: ${processes.size})`,
            taskIdToString(taskId));
        // #endregion DEBUG

        return;

    }


    private markCompleted(completed: Set<ProcessId>): ReadonlySet<TaskID> {

        const changed = new Set<TaskID>();

        for (const [taskId, processes] of this.registry) {

            for (const [processId, processInfo] of processes) {

                if (completed.has(processId)) {

                    processInfo.running = false;

                    changed.add(taskId);

                    // процесс - штука уникальная
                    // Значит: первое совпадение = единственное совпадение
                    completed.delete(processId);
                    if (completed.size < 1) {
                        break;
                    }
                }

            }

            if (completed.size < 1) {
                break;
            }

        }

        return changed;
    }


    private removeUnavailableProcesses(snapshot: TerminalSnapshot): ReadonlySet<TaskID> {

        const changed = new Set<TaskID>();

        for (const [taskId, processes] of this.registry) {

            for (const [processId, processInfo] of processes) {

                // снапшоты приходят по порядку и всегда актуальны, это условие — предохранитель.
                // Он гарантирует, что если процесс был добавлен после того, как VS Code
                // начал собирать данные для текущего снапшота, мы его не тронем.
                if (snapshot.timestamp < processInfo.timestamp) {

                    // пропуск возможного, неактуального для процесса снапшота

                    // #region DEBUG
                    logger?.(
                        vscode.LogLevel.Trace,
                        `Snapshot outdated for process "${processId}" (${snapshot.timestamp} < ${processInfo.timestamp}), skipping removal check`,
                        taskIdToString(taskId));
                    continue;
                    // #endregion DEBUG

                    // @todo:
                    // Про break vs continue в removeInvisibleProcesses:
                    // Есть мнение что break — это не косяк, а отличная оптимизация. Поскольку:
                    // Map в JavaScript гарантирует порядок итерации в порядке вставки. -?
                    // Новые процессы добавляются в конец Map (в addProcess). -?
                    // logicalClock всегда растет.
                    // Следовательно, процессы внутри Map для конкретной задачи всегда
                    // отсортированы по времени (timestamp). Как только встречен первый процесс,
                    // который "моложе" снапшота (snapshot.timestamp < processInfo.timestamp),
                    // то можно быть уверенным, что все последующие процессы в этой задаче тоже моложе.
                    // Итог: break позволяет не проверять остальные процессы этой задачи, что
                    // эффективнее, чем continue.
                    // @fixme: Сейчас релизная версия использует break, но
                    // это не достаточно протестировано
                    break;
                }

                // если терминалы не "видят" этот процесс
                if (!snapshot.processIds.has(processId)) {

                    // удаление из реестра,
                    // #region DEBUG
                    logger?.(
                        vscode.LogLevel.Debug,
                        `Task process "${processId}" has been removed from the registry (no longer available).`,
                        taskIdToString(taskId));
                    // #endregion DEBUG

                    processes.delete(processId);
                    changed.add(taskId);
                }
            }

            if (processes.size < 1) {
                //  очистка пустых
                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Debug,
                    `Task removed from registry (no processes left)`,
                    taskIdToString(taskId));
                // #endregion DEBUG

                this.registry.delete(taskId);
            }

        }

        return changed;

    }


}
