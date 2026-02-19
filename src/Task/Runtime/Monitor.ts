import * as vscode from 'vscode';
import {
    ProcessId,
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


/** Мониторинг процессов (адаптивный интервал опроса).
 *
 * Класс для отслеживания состояния запущенных процессов.
 * Автоматически определяет завершившиеся процессы и уведомляет подписчиков.
 *
 * Интервал проверки растёт по квадратичной формуле: POLL_MIN + 0.2×n² мс (cap this.pollCap мс),
 * что обеспечивает баланс между отзывчивостью UI и нагрузкой на систему.
 *
 * ## Monitor
 *
 * ### API
 *
 * #### События:
 * - `onProcessesCompleted` — процесс(ы) задачи завершились
 *
 * #### Методы:
 * - `addTaskProcess(pid)` — добавить процесс в мониторинг
 * - `dispose()` — освободить ресурсы
 *
 * @remarks
 * Использует `process.kill(pid, 0)` для проверки жизни процесса.
 *
 * */
export class Monitor implements vscode.Disposable {

    // #region Static

    // 322 - очень хорошее четное число из интервала 321..323
    /** Минимальный интервал опроса */
    private static readonly POLL_MIN = 322;


    /** Коэффициент замедления опроса при росте очереди.
     * Чем выше, тем быстрее мы достигаем pollCap. */
    private static readonly POLL_ACCELERATION = 0.2;

    // #endregion

    private disposed: boolean;


    // #region Instance fields

    /** Событие: процесс задачи завершился.
     * Вызывается при обнаружении мёртвых процессов через `process.kill(pid, 0)`.  */
    private readonly completedEmitter: vscode.EventEmitter<ReadonlySet<ProcessId>>;
    public readonly onProcessesCompleted: vscode.Event<ReadonlySet<ProcessId>>;

    private readonly _processes: Set<ProcessId>;

    private readonly pollCap: number;

    /** Таймер периодической проверки процессов.
     *
     * Undefined когда мониторинг остановлен (нет активных процессов). */
    private checkInterval: NodeJS.Timeout | undefined;

    // #endregion


    // #region Lifecycle

    /** Создать экземпляр монитора.
     * @param polingCap - Максимальный интервал опроса (в мс). */
    constructor(polingCap: number) {

        this.disposed = false;

        this.completedEmitter = new vscode.EventEmitter<ReadonlySet<ProcessId>>();
        this.onProcessesCompleted = this.completedEmitter.event;

        this._processes = new Set();

        // минимальный кап будет ~550 (поэтому и 1.7)
        this.pollCap = Math.max(Monitor.POLL_MIN * 1.7, polingCap);
    }

    /** Освободить ресурсы монитора.
     *
     * Останавливает все проверки, очищает события и набор процессов.
     * Сбрасывает singleton-инстанс.
     *
     * @affects `checkInterval` Таймер будет остановлен
     * @affects `processes` Будет очищен
     *
     * @implements {vscode.Disposable} */
    public dispose() {

        this.disposed = true;

        this.completedEmitter.dispose();

        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = undefined;
        }

        this._processes.clear();

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            'disposed');
        // #endregion DEBUG

    }

    // #endregion


    // #region Public API

    /** Получить все живые процессы задачи.
     *
     * @remarks Живая структура, не копия
     * @returns Set процессов или undefined если у задачи нет работающих процессов  */
    public get processes(): ReadonlySet<ProcessId> {

        if (this.disposed) {
            return new Set();
        }

        return this._processes;
    }


    /** Добавить процесс задачи в мониторинг.
     *
     * @param processId - PID процесса для отслеживания
     *
     * @remarks
     * - Игнорирует дубликаты (если PID уже отслеживается)
     * - Запускает мониторинг если он был остановлен
     * - Сохраняет текущий интервал проверки для быстрого отклика UI
     * */
    public addTaskProcess(processId: ProcessId) {

        if (this.disposed) {
            return;
        }

        if (this._processes.has(processId)) {

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Warning,
                `Process is already tracked, skip it`,
                processId.toString());
            // #endregion DEBUG

            return;
        }

        // #region DEBUG
        logger?.(
            vscode.LogLevel.Debug,
            `Added process to monitoring`,
            processId.toString());
        // #endregion DEBUG

        this._processes.add(processId);

        // Не проверяем жив-ли процесс сразу — даем UI время
        // отдышаться

        // Не пересчитываем интервал если таймаут уже работает.
        // «предохранитель» - добавление 10 процессов за
        // миллисекунду, scheduleCheck вызовется только для первого.
        // Также это небольшой буст если работаем быстро (проверяем 1
        // один процесс), и добавляется еще 100 за миллисекунду —
        // то перавя проверка проверка - быстро, потом интервал пересчитается.
        if (!this.checkInterval) {

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Trace,
                'Starting monitoring');
            // #endregion DEBUG

            this.scheduleCheck();
        }
    }

    // #endregion


    // #region Private implementation

    /** Проверить существование процесса.
     *
     * Использует `process.kill(pid, 0)` для проверки доступности процесса.
     *
     * @param processId - PID процесса
     * @returns true если процесс жив и доступен для проверки
     *
     * @remarks
     * Обработка ошибок:
     * - ESRCH → процесс не существует (мёртв) → false
     * - Любая другая ошибка (включая EPERM) → неожиданная ситуация,
     *   процесс исключается из мониторинга (return false).
     *
     * EPERM теоретически означает "процесс жив, но нет прав на проверку".
     * В контексте VS Code extension это не должно происходить —
     * мы проверяем только дочерние процессы терминалов, запущенных самим VS Code.
     * Появление EPERM сигнализирует о нештатной ситуации (чужой PID в карте,
     * изменение прав, race condition). Продолжать мониторинг невалидируемого
     * процесса бессмысленно. */
    private isAlive(processId: ProcessId): boolean {
        try {

            process.kill(processId, 0);
            return true;

        }
        catch (error) {

            if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
                return false;
            }

            // #region DEBUG
            // Логируем только не-ESRCH ошибки
            logger?.(
                vscode.LogLevel.Error,
                `Unexpected error while checking process: ${JSON.stringify(error, null, 2)}`,
                processId.toString());
            // #endregion DEBUG

            return false;
        }
    }


    /** Запланировать следующую проверку процессов.
     *
     * Пересчитывает интервал на основе текущего количества процессов.
     * Если процессов нет — мониторинг останавливается до добавления новых.
     *
     * */
    private scheduleCheck() {

        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = undefined;
        }

        const timeout = this.pollingInterval(this._processes.size);

        if (timeout) {
            this.checkInterval = setTimeout(() => {
                this.pruneDead();
                this.scheduleCheck(); // и по новой, пока this.totalProcesses > 0
            }, timeout);

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Trace,
                `Next check in ${new Intl.NumberFormat(undefined, {
                    useGrouping: false,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(timeout)}ms for ${this._processes.size} processes`);
            // #endregion DEBUG

        }
        // #region DEBUG
        else {
            logger?.(
                vscode.LogLevel.Trace,
                'No active processes, stopping monitoring');
        }
        // #endregion DEBUG
    }

    /** Вычислить интервал опроса на основе количества
     * отслеживаемых процессов.
     *
     * Для значений по умолчанию:
     * Формула: 322 + 0.2×n² мс, но не более this.pollCap
     *
     * Примеры интервалов:
     * - 1 процесс → 322 мс (быстрая реакция)
     * - 5 процессов → 327 мс
     * - 10 процессов → 342 мс
     * - 20 процессов → 402 мс
     * - 50 процессов → 822 мс
     * - 70+ процессов → 1335 мс (достигнут cap)
     *
     * @returns Интервал в миллисекундах, или undefined если нет процессов
     *
     * @remarks
     * undefined — если count < 1 что должно означать остановку мониторинга до появления новых процессов. */
    private pollingInterval(count: number): number | undefined {

        if (count < 1) {
            return undefined;
        }

        // Медленный рост вначале, резкое ускорение, cap на pollCap
        return Math.min(Monitor.POLL_MIN + Monitor.POLL_ACCELERATION * count * count, this.pollCap);
    }


    /** Проверить все отслеживаемые процессы и удалить завершившиеся.
     *
     * Вызывается таймером согласно адаптивному интервалу.
     * Проверяет каждый PID через {@link isAlive} и удаляет мёртвые.
     *
     * @fires onProcessesCompleted для каждого обнаруженного завершённого процесса
     *
     *  */
    private pruneDead() {

        const completed = new Set<ProcessId>();

        for (const processId of this._processes) {

            if (!this.isAlive(processId)) {

                // #region DEBUG
                logger?.(
                    vscode.LogLevel.Trace,
                    `Process is no longer running`,
                    processId.toString());
                // #endregion DEBUG

                this._processes.delete(processId); // Safe: Set allows delete during iteration
                completed.add(processId);
            }

        }

        if (completed.size > 0) {

            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                `${completed.size} process(es) finished, emitting notification`);
            // #endregion DEBUG

            this.completedEmitter.fire(completed);
        }
    }

}

// #endregion
