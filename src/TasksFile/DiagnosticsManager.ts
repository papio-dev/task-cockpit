import * as vscode from 'vscode';


// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
declare type TableFn = (level: vscode.LogLevel, data: Record<string, unknown> | Record<string, unknown>[], config?: { headers?: string[]; undefinedAsEmpty?: boolean; }) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
let table: TableFn | undefined = undefined;
try {
    ({ logger, assert, table } = require('../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


/** Nominal type для ключей Map — защита от случайного использования
 * произвольных строк вместо нормализованных ключей. */
declare const __Key: unique symbol;
type Key = string & { [__Key]: never; };

interface PendingCheck {
    /** Таймер debounce. undefined после срабатывания. */
    timeout?: NodeJS.Timeout;
    /** Токен для отмены проверки. Создаётся сразу при планировании,
     * чтобы cancelCheck() мог правильно отменить ещё не начавшуюся проверку.
     * undefined после завершения/отмены. */
    cts?: vscode.CancellationTokenSource;
}


/** Функция проверки конфигурационных файлов с задачами. Семантический линтер.
 *
 * ## Что это НЕ делает
 *
 * - НЕ валидирует JSON-синтаксис (это делает VS Code)
 * - НЕ дублирует диагностики LSP / встроенных валидаторов
 * - НЕ проверяет JSON Schema соответствие
 *
 * ## Что это делает
 *
 * Ищет проблемы специфичные для конфигурации задач VS Code,
 * которые не ловятся стандартными инструментами. Например:
 * - дубликаты label среди задач
 * - ссылки на несуществующие dependsOn
 * - [другие примеры]
 *
 * ## Контракт:
 * - Возвращает диагностики для переданного URI
 * - Проверяет token.isCancellationRequested в точках прерывания
 * - При отмене — выбрасывает CancellationError
 * - Сама обрабатывает и логирует свои ошибки
 *
 * ## Уточнение к поведению при проблемах (обязательно к соблюдению)
 *
 * Отмена запрошена (token.isCancellationRequested):
 *   → выбросить CancellationError (единственный разрешённый throw)
 *
 * Внутренняя ошибка (сеть, парсинг, etc.):
 *   → залогировать, вернуть [] (НЕ выбрасывать)
 *
 * Файл не существует / невалидный JSON:
 *   → вернуть [] (это штатная ситуация, не ошибка)
 *
 * ## Почему так
 *
 * DiagnosticsManager не интерпретирует ошибки чекеров.
 * Выброс !== CancellationError — нарушение контракта, результат игнорируется.
 * Чекер сам отвечает за graceful degradation.
 *
 * @remarks
 * tasks.json является частью конфигурации. Событие onDidChangeConfiguration срабатывает,
 * когда VS Code обновляет свою внутреннюю модель конфигурации. Парсер VS Code устойчив к ошибкам синтаксиса
 * и будет обновлять конфигурацию из частично распарсеного файла.
 *
 * При инициализации (в конструкторе) или при добавлении папок (onWorkspaceFoldersChanged)
 * мы вызываем проверки на всех потенциальных источниках (getTasksSources()),
 * даже если файл не был одобрен VS Code (например, если он содержит синтаксические ошибки).
 *
 * Таким образом DiagnosticChecker, потенциально, должен быть готов работать с не валидным JSONC.
 * Не бросать ошибок, не сообщать о проблемах с синтаксисом и т.п. А возвращать пустой
 * массив или частичные диагностики.
 *
 * @remarks
 * Также DiagnosticChecker не должен предполагать что файл по uri существует физически. */
export type DiagnosticChecker = (
    uri: vscode.Uri,
    token: vscode.CancellationToken
) => Promise<vscode.Diagnostic[]>;



/** Управляет диагностиками конфигурационных файлов с задачами.
 *
 * ## Контракт DiagnosticsManager (НЕ наследует поведение чекеров)
 *
 * Ошибка/отмена проверки:
 *   → диагностики *для этого URI* не обновляются (остаются пустыми после scheduleCheck)
 *   → CancellationError поглощается внутри
 *
 * Успешная проверка:
 *   → результаты всех чекеров агрегируются
 *
 * ## Инварианты
 *
 * - Изменение конфигурации tasks → диагностики обновятся (или очистятся)
 * - Удаление workspace folder → диагностики очистятся, проверки отменятся
 *
 * @remarks
 * throw * vs throw CancellationError — в терминологии CancellationError — это не "ошибка"
 * в смысле "что-то сломалось", это сигнал управления потоком.
 * */
export class DiagnosticsManager implements vscode.Disposable {

    private readonly disposables: vscode.Disposable;

    private readonly pendingChecks: Map<Key, PendingCheck>;

    private readonly diagnostics: vscode.DiagnosticCollection;

    private readonly debounceMs: number;

    private readonly checkers: DiagnosticChecker[];

    constructor(
        checkers: DiagnosticChecker[],
        debounceMs = 330
    ) {

        this.checkers = checkers;
        this.debounceMs = debounceMs;
        this.diagnostics = vscode.languages.createDiagnosticCollection('Task Cockpit');

        this.pendingChecks = new Map<Key, PendingCheck>();


        this.disposables = vscode.Disposable.from(

            this.diagnostics,

            vscode.workspace.onDidChangeConfiguration((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"workspace.onDidChangeConfiguration" event received');
                // #endregion DEBUG

                this.configurationChangedHandler(e);
            }),

            vscode.workspace.onDidChangeWorkspaceFolders((e) => {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    '"workspace.onDidChangeWorkspaceFolders" event received');
                // #endregion DEBUG

                this.workspaceFoldersChangedHandler(e);
            })
        );

        const sources = this.getTasksSources();

        // #region DEBUG
        logger?.(vscode.LogLevel.Trace,
            `Initialized with ${this.checkers.length} checker(s), ${sources.length} source(s)`);
        // #endregion DEBUG

        sources.forEach(uri => this.scheduleCheck(uri));
    }


    private configurationChangedHandler(event: vscode.ConfigurationChangeEvent): void {

        if (!event.affectsConfiguration('tasks')) {
            // #region DEBUG
            logger?.(vscode.LogLevel.Trace,
                'Configuration change does not affect "tasks", ignoring');
            // #endregion DEBUG
            return;
        }

        const sources = this.getTasksSources();

        // #region DEBUG
        logger?.(vscode.LogLevel.Trace,
            `Tasks configuration changed, scheduling checks for ${sources.length} source(s)`);
        // #endregion DEBUG

        // @todo понять зачем
        // this.getAffectedSource(event).forEach(uri => this.scheduleCheck(uri));
        // Проверка всех потенциальных источников, даже если можем
        // определить только измененные файлы — нужно для правильной работы
        // определения зависимостей. (или нет?)
        sources.forEach(uri => this.scheduleCheck(uri));
    }


    /** Обрабатывает добавление/удаление workspace folders.
     *
     * added: планирует проверку для потенциального tasks.json (файл может не существовать).
     * removed: отменяет проверки и очищает диагностики. */
    private workspaceFoldersChangedHandler(event: vscode.WorkspaceFoldersChangeEvent): void {

        // #region DEBUG
        logger?.(vscode.LogLevel.Trace,
            `Folders changed: ${(event.added.length === 0 && event.removed.length === 0) ? 'renamed only' : `+${event.added.length} -${event.removed.length}`}`);
        // #endregion DEBUG

        for (const folder of event.added) {

            // #region DEBUG
            logger?.(vscode.LogLevel.Trace,
                `Folder added)`,
                folder.uri.fsPath);
            // #endregion DEBUG

            // @todo а разве нет получателя uri в basic?
            this.scheduleCheck(vscode.Uri.joinPath(folder.uri, '.vscode', 'tasks.json'));
        }

        for (const folder of event.removed) {

            // #region DEBUG
            logger?.(vscode.LogLevel.Trace,
                `Folder removed)`,
                folder.uri.fsPath);
            // #endregion DEBUG

            const uri = vscode.Uri.joinPath(folder.uri, '.vscode', 'tasks.json');
            this.cancelCheck(uri);
            this.diagnostics.delete(uri);

            // #region DEBUG
            logger?.(vscode.LogLevel.Trace,
                `Diagnostics cleared`,
                uri.fsPath);
            // #endregion DEBUG
        }
    }


    // @todo понять зачем
    // /** Фильтрует потенциальные источники по событию изменения конфигурации.
    //  * Возвращённые URI могут указывать на несуществующие файлы. */
    // private getAffectedSource(event: vscode.ConfigurationChangeEvent): vscode.Uri[] {

    //     const affected = this.getTasksSources().filter(uri =>
    //         event.affectsConfiguration('tasks', uri)
    //     );

    //     logger?.(vscode.LogLevel.Trace,
    //         affected.length > 0 ? `Affected files:\n${affected.map(u => `\t-${u.fsPath}`).join('\n')}` : 'No Affected files');

    //     return affected;
    // }


    /** Возвращает URI всех потенциальных источников tasks.
     * URI могут указывать на несуществующие файлы. */
    private getTasksSources(): vscode.Uri[] {

        const taskSources: vscode.Uri[] = [];

        if (vscode.workspace.workspaceFile) {
            taskSources.push(vscode.workspace.workspaceFile);
        }

        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                taskSources.push(vscode.Uri.joinPath(folder.uri, '.vscode', 'tasks.json'));
            }
        }

        return taskSources;
    }


    /** Планирует проверку файла с debounce.
     *
     * При повторном вызове для того же URI:
     * - отменяет предыдущую проверку (pending или выполняющуюся)
     * - очищает старые диагностики
     * - запускает новый таймер */
    private scheduleCheck(uri: vscode.Uri): void {

        // прервать текущую проверку
        this.cancelCheck(uri);

        // очистить диагностику для указанного uri
        this.diagnostics.delete(uri);

        // #region DEBUG
        logger?.(vscode.LogLevel.Trace,
            `Scheduled check in ${this.debounceMs}ms`,
            uri.fsPath);
        // #endregion DEBUG

        const pending: PendingCheck = {
            cts: new vscode.CancellationTokenSource(),
            timeout: setTimeout(async () => {

                // #region DEBUG
                logger?.(vscode.LogLevel.Trace,
                    `Check started`,
                    uri.fsPath);
                // #endregion DEBUG

                pending.timeout = undefined;

                const cts = pending.cts;
                if (cts) {
                    try {
                        if (!cts.token.isCancellationRequested) {

                            const diagnostics = await this.performCheck(uri, cts.token);

                            if (cts.token.isCancellationRequested) {
                                throw new vscode.CancellationError();
                            };

                            this.diagnostics.set(uri, diagnostics);

                            // #region DEBUG
                            logger?.(vscode.LogLevel.Trace,
                                `Check completed. ${diagnostics.length} diagnostic(s)${diagnostics.length > 0 ? ':' : ''}`,
                                uri.fsPath);

                            if (diagnostics.length > 0) {
                                table?.(vscode.LogLevel.Trace,
                                    diagnostics.map(d => ({ Line: `L:${d.range.start.line}`, Message: d.message }))
                                );
                            }
                            // #endregion DEBUG

                        }
                    } catch (error) {

                        // #region DEBUG
                        // performCheck по контракту оборачивает всё в CancellationError.
                        // Если сюда прилетело что-то другое — это баг логики, нарушение инварианта.
                        assert?.(
                            error instanceof vscode.CancellationError,
                            `Unexpected error type: ${error instanceof Error ? error.constructor.name : typeof error}`
                        );
                        // #endregion DEBUG

                        // #region DEBUG
                        logger?.(vscode.LogLevel.Trace,
                            `Check cancelled`,
                            uri.fsPath);
                        // #endregion DEBUG

                    }
                    finally {
                        // cleanup при естественном завершении проверки
                        // в this.pendingChecks уже может быть чужой таймер
                        const pending = this.pendingChecks.get(keyFromUri(uri));
                        if (pending && pending.cts === cts) {
                            pending.cts.dispose();
                            pending.cts = undefined;
                            this.pendingChecks.delete(keyFromUri(uri));
                        }
                    }
                }

            }, this.debounceMs)
        };

        const key = keyFromUri(uri);
        this.pendingChecks.set(key, pending);
    }


    /** Отменяет проверку (pending или выполняющуюся) и удаляет из очереди. */
    private cancelCheck(uri: vscode.Uri): void {

        const key = keyFromUri(uri);

        const pending = this.pendingChecks.get(key);

        if (pending) {

            // #region DEBUG
            logger?.(vscode.LogLevel.Trace,
                `Cancelling previous check`,
                uri.fsPath);
            // #endregion DEBUG

            this.cleanupPending(pending);
            this.pendingChecks.delete(key);
        }

    }


    /** Очищает ресурсы PendingCheck: таймер и CancellationTokenSource. */
    private cleanupPending(pending: PendingCheck) {

        if (pending.timeout) {
            clearTimeout(pending.timeout);
            pending.timeout = undefined;
        }

        if (pending.cts) {
            pending.cts.cancel();
            pending.cts.dispose();
            pending.cts = undefined;
        }
    }


    /** Выполняет проверку с предварительной валидацией существования файла
     * (что НЕ гарантирует существования этого файла на момент запуска
     * конкретного чекера).
     *
     * Любая ошибка (кроме CancellationError) преобразуется в CancellationError.
     * Причина: оркестратор не интерпретирует ошибки чекеров. Он различает только
     * "проверка завершена" и "проверка прервана". Частичным результатам от
     * упавшего чекера доверять нельзя — нет гарантии актуальности. */
    private async performCheck(uri: vscode.Uri, ctsToken: vscode.CancellationToken): Promise<vscode.Diagnostic[]> {

        try {

            try {
                const stat = await vscode.workspace.fs.stat(uri);
                // @todo -- а что с ссылкой на директорию?
                if (stat.type === vscode.FileType.Directory) {
                    throw new Error(`Uri: ${uri} is a directory`);
                }
            }
            catch (error) {

                // @todo - vscode.FileSystemError -
                if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') {

                    // #region DEBUG
                    logger?.(vscode.LogLevel.Error,
                        `Check failed: Fs stat: ${error instanceof Error ? error.message : error}`,
                        uri.toString());
                    // #endregion DEBUG
                }

                // scheduleCheck вызывается для "потенциальных источников" — URI которые могут не существовать
                // Если файла нет — это не ошибка, это просто "нечего проверять"
                // Семантически это ближе к "прервано" (нет предмета проверки), чем к "ошибка".
                // Это не "ошибка файловой системы", это "причина не продолжать".
                // И нет реальных причин различать "почему" прервано.
                // Тесты: в доменной модели нет категории "ресурс недоступен" как
                // отдельного состояния с отдельным поведением, то и тестировать
                // её отдельно — тестировать несуществующий контракт.

                // #region DEBUG
                logger?.(vscode.LogLevel.Trace,
                    `File not found, skipping`,
                    uri.fsPath);
                // #endregion DEBUG

                throw new vscode.CancellationError();
            }

            // Проверяем отмену после каждого await
            if (ctsToken.isCancellationRequested) {
                throw new vscode.CancellationError();
            };

            return await this.check(uri, ctsToken);

        } catch (error) {

            if (error instanceof vscode.CancellationError) {
                throw error;
            }

            // #region DEBUG
            logger?.(vscode.LogLevel.Error,
                `Check failed: ${error instanceof Error ? error.message : error}`,
                uri.toString());
            // #endregion DEBUG

            // Ошибка чекера = отмена. Всегда. Тоже преобразуется в
            // CancellationError (результату доверять нельзя).
            // Как либо интепретировать результат или убедится в его актуальности — невозможно
            throw new vscode.CancellationError();

        }
    }


    /** Запускает все чекеры параллельно с поддержкой кооперативной отмены.
     *
     * Promise.race между результатами чекеров и сигналом отмены.
     * При отмене не ждём завершения чекеров — они сами проверяют token
     * и прервутся в своих точках прерывания.
     *
     * Оркестратор не прерывает. Оркестратор — теряет интерес.
     * Правильная остановка — проблема самих чекеров.
     *  */
    private async check(
        uri: vscode.Uri,
        token: vscode.CancellationToken
    ): Promise<vscode.Diagnostic[]> {

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        };

        if (this.checkers.length === 0) {
            return [];
        }

        let listener: vscode.Disposable | undefined;

        try {
            const results = await Promise.race([
                new Promise<never>((_, reject) => {
                    listener = token.onCancellationRequested(() => {
                        reject(new vscode.CancellationError());
                    });
                }),
                Promise.allSettled(this.checkers.map(fn => fn(uri, token))),
            ]);

            // #region DEBUG
            const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
            if (rejected.length > 0) {
                logger?.(vscode.LogLevel.Warning,
                    `${rejected.length} checker(s) failed`,
                    uri.fsPath);
                rejected.forEach(r =>
                    logger?.(vscode.LogLevel.Warning,
                        `  ${r.reason instanceof Error ? r.reason.message : r.reason}`)
                );
            }
            // #endregion DEBUG

            return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

        } finally {
            listener?.dispose();
        }
    }


    /** Освобождает все ресурсы: отменяет pending проверки, очищает диагностики,
     * отписывается от событий VS Code. */
    dispose(): void {

        for (const [key, pending] of this.pendingChecks) {
            this.cleanupPending(pending);
            this.pendingChecks.delete(key);
        }

        this.diagnostics.clear();

        this.disposables.dispose();

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'disposed');
        // #endregion DEBUG
    }
}


/** (наивно) Нормализует URI в строковый ключ для Map.
 *  @todo: Потенциальная проблема: виртуальные схемы (untitled:, etc.) — не проверялось. */
function keyFromUri(uri: vscode.Uri): Key {
    return uri.toString() as Key;
}
