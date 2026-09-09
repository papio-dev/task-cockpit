/** @file ResourceStateCoordinator/ResourceStateCoordinator.ts */

import {
    EventEmitter,
    workspace
} from 'vscode';
import * as assert from 'node:assert/strict';
import EligibleTask from './EligibleTask/EligibleTask';
import groupEligibleTasks from './EligibleTask/groupEligibleTasks';
import groupResourceConfig from './ResourceConfig/groupResourceConfig';
import groupTaskDefinitions from './TaskDefinition/groupTaskDefinitions';
import lookupTaskOrigin from './EligibleTask/lookupTaskOrigin';
import OriginKey from '../OriginKey';
import ResourceConfigurationSchema from './ResourceConfig/ResourceConfigurationSchema';
import ResourceStructure from './ResourceStructure';

import type {
    ConfigurationChangeEvent,
    Disposable,
    Event,
    Task,
    WorkspaceFoldersChangeEvent
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type LogOutputChannel from '../extension/LogOutputChannel';
import type OriginEntriesSnapshot from './OriginEntriesSnapshot';
import type ResourceConfig from './ResourceConfig/ResourceConfig';
import type TaskBundle from './TaskBundle';
import type TaskDefinitionEntry from './TaskDefinition/TaskDefinitionEntry';
import type TaskName from '../TaskName';
import type TaskSource from './TaskSource';


interface ActiveUpdatePhase { affectedKeys: Immutable<AffectedKeys>; }
type Phase = 'idle' | 'disposed' | Immutable<ActiveUpdatePhase>;

// 'TASKS' — специальный маркер «пересчитать задачи»,
// а остальные ключи — ключи ресурсной конфигурации.
type AffectedKeys = Set<ResourceConfigurationSchema.ConfigKey | 'TASKS'>;


/** Единственный источник согласованного, актуального состояния *ресурсов*.
 * («какие задачи есть» + «по каким правилам из них строить дерево»,
 * сопоставление «рантайм-задача» → «ее определение»)
 *
 * Управляет оперативным состоянием расширения:
 * областями-источниками, определениями и рантайм-задачами, ресурсными конфигурациями.
 *
 * Это центральный координатор состояния. Он собирает, кеширует и синхронизирует
 * все динамические данные: список областей (scopes), ресурсные конфигурации,
 * определения задач (TaskDefinition) и построенные VS Code рантайм-задачи (EligibleTask).
 *
 * В основе лежит конечный автомат с фазами:
 * - 'idle'            — согласованное состояние готово, обновление не выполняется.
 * - `UpdatePhase` — активное обновление.
 * - 'disposed'        — координатор уничтожен, любое обращение к публичному API — ошибка.
 *
 * Это единственный источник правды для всего, что может измениться в рантайме.
 *
 * Сам следит за изменениями конфигурации и держит себя в актуальном виде,
 * оповещая подписчиков через onDidStateChange.
 *
 * onDidStateChange происходит только после актуализации состояния что
 * важно при изменении в конфигурации "tasks" — нужно дождаться
 * когда vs code перестроит задачи.
 *
 * - Консистентность – событие onDidStateChange должно отправляться только после
 *     того, как состояние действительно актуализировано (соответствует
 *     последней версии конфигурации).
 * - Не терять изменения
 * - Отзывчивость – **тут** *не* в приоритете.
 * */
class ResourceStateCoordinator implements Disposable {

    readonly #onDidScheduleUpdate: EventEmitter<void>;
    readonly onDidScheduleUpdate: Event<void>;

    readonly #onDidCompleteUpdate: EventEmitter<Immutable<AffectedKeys>>;

    /** Срабатывает после завершения полного цикла обновления состояния,
     * вызванного изменениями в конфигурации, разделе задач (`tasks`) или
     * структуре рабочих областей.
     *
     * На момент срабатывания все публичные геттеры возвращают согласованный снимок. */
    readonly onDidCompleteUpdate: Event<Immutable<AffectedKeys>>;

    // --------------------------------------------------------

    // Снимок состояния (всегда внутренне согласованный набор кешей)
    // #resourceStructure обновляется безусловно на каждом цикле #performUpdate.
    // #eligibleTasks и #taskDefinitions — только при наличии изменений в задачах.
    // Расхождения не возникает: единственный источник изменений #resourceStructure —
    // workspace.workspaceFolders, а обработчик onDidChangeWorkspaceFolders
    // всегда планирует обновление с Set(['TASKS'] (см. конструктор).
    // Таким образом при изменении структуры папок задачи также пересчитываются.
    // --------------------------------------------------------
    #resourceStructure!: Immutable<ResourceStructure>;
    /** Кеш eligible-задач — "подходящих" рантайм-задач, те что
     * VS Code успешно построила из определений и которые
     * {@link EligibleTask.isEligibleTask | соответствует критериям расширения}. */
    #eligibleTasks!: Immutable<Map<OriginKey, Map<TaskName, EligibleTask>>>;
    /** Кеш определений задач, сгруппированных по областям */
    #taskDefinitions!: Immutable<Map<OriginKey, Map<TaskName, TaskDefinitionEntry>>>;
    /** Кеш origin-специфичных конфигураций, сгруппированных по областям-источникам */
    #perOriginConfig!: Immutable<Map<OriginKey, ResourceConfig>>;
    // --------------------------------------------------------

    // Защита от дребезга между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // --------------------------------------------------------
    #debounceTimer: NodeJS.Timeout | null;
    #pendingAffectedKeys: AffectedKeys | null;
    static readonly #DEBOUNCE_MS: number = 350;
    // --------------------------------------------------------

    /** Текущая фаза координатора.
     *
     * "чем сейчас занят координатор"
     *
     * Сессия обновления: период пока координатор находится в фазе updating.
     * Начинается при первом переходе idle → UpdatePhase, заканчивается переходом
     * UpdatePhase → idle + нотификацией.
     * Внутри сессии возможны перезапуски #performUpdate (UpdatePhase → UpdatePhase).
     *
     *  */
    #phase: Phase;

    // -------------------------------------------------------
    /** Deferred, который резолвится при переходе UpdatePhase → idle.
     * Публичные геттеры через #waitForIdle() ждут именно его, чтобы
     * вернуть согласованный снимок.
     *
     * Устанавливается в {@linkcode #waitForIdle} */
    #idleDeferred: {
        readonly promise: Promise<void>;
        readonly resolve: (value: void | PromiseLike<void>) => void;
        readonly reject: (reason: Error) => void;
    } | null;

    // инфраструктура
    // --------------------------------------------------------
    #logOutputChannel: LifecycleOmitted<LogOutputChannel>;

    readonly #disposables: Disposable[];

    private constructor(
        eligibleTasks: Immutable<Array<EligibleTask>>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel>
    ) {

        this.#logOutputChannel = logOutputChannel;

        this.#onDidScheduleUpdate = new EventEmitter();
        this.onDidScheduleUpdate = this.#onDidScheduleUpdate.event;

        this.#onDidCompleteUpdate = new EventEmitter();
        this.onDidCompleteUpdate = this.#onDidCompleteUpdate.event;

        this.#debounceTimer = null;
        this.#pendingAffectedKeys = null;
        this.#idleDeferred = null;

        this.#disposables = [
            this.#onDidScheduleUpdate,
            this.#onDidCompleteUpdate
        ];

        // по всей видимости, единственный случай когда срабатывает самостоятельно,
        // без сопутствующего `onDidChangeConfiguration` — это переименование
        // директорий в .code-workspace
        workspace.onDidChangeWorkspaceFolders(this.#changeWorkspaceFoldersHandler, this, this.#disposables);

        workspace.onDidChangeConfiguration(this.#handleConfigurationChange, this, this.#disposables);

        // ----------------------------------------------
        // Первичное заполнение кешей
        this.#updateCaches(eligibleTasks);

        // кеш должен быть полностью обновлен перед началом;
        assert.ok(this.#resourceStructure);
        assert.ok(this.#eligibleTasks);
        assert.ok(this.#taskDefinitions);
        assert.ok(this.#perOriginConfig);

        // начинаем в 'idle' — полное состояние, работа не выполняется
        this.#phase = 'idle';
    }


    /** Фабрика.
     *
     * Асинхронно собирает рантайм-задачи (устойчиво к гонке с
     * изменением конфигурации прямо во время запроса) и только потом
     * возвращает готовый, согласованный экземпляр.
     *
     * @throws { Error } Выбрасывает наверх ошибки fetchTasks .
     * @throws { Error } Если система не стабилизировалась, а `deadlineMs` вышел.
     *
     *  */
    static async create(
        deadlineMs: number,
        logOutputChannel: LifecycleOmitted<LogOutputChannel>
    ): Promise<ResourceStateCoordinator> {

        const initialEligibleTasks = await fetchEligibleTasksUntilStable(deadlineMs, logOutputChannel);

        const stateCoordinator = new ResourceStateCoordinator(
            initialEligibleTasks,
            logOutputChannel
        );

        return stateCoordinator;
    }


    /** Уничтожает координатор: уведомляет подписчиков через {@linkcode onDidDispose},
     * отключает все слушатели, очищает таймеры и переводит фазу в `'disposed'`.
     *
     * Повторный вызов безопасен. */
    public dispose() {

        if (this.disposed) { return; }

        this.#phase = 'disposed';

        // Остановка дебонс-механизма
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        if (this.#idleDeferred) {
            this.#idleDeferred.reject(new Error(`${this.constructor.name} was disposed while waiting`));
            this.#idleDeferred = null;
        }

        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel.trace(`[${this.constructor.name}] disposed`);
    }


    // #region Handlers

    #changeWorkspaceFoldersHandler(_event: WorkspaceFoldersChangeEvent) {

        if (this.disposed) { return; }

        this.#logOutputChannel.trace(`[${this.constructor.name}] Workspace folders changed. Scheduling update (with task).`);

        this.#scheduleUpdate(new Set(['TASKS']));

    }


    #handleConfigurationChange(event: ConfigurationChangeEvent) {

        if (this.disposed) { return; }

        this.#logOutputChannel.trace(`[${this.constructor.name}#handleConfigurationChange]: Configuration changed…`);

        const changes: AffectedKeys =
            // @todo или просто "tasks"? в чем разница?
            // ключ 'tasks.tasks' реагирует только на изменения в самом массиве задач.
            // Однако другие изменения внутри раздела tasks (например, tasks.verification,
            // tasks.version и пр.) тоже могут требовать пересчёта.
            // Но сейчас нам нужен только список определений и рантайм-задач.
            // Что-то может изменится в списке рантайм-задач при изменении
            // в разделе tasks, но не в массиве определений?
            // @decision: Сознательно используем tasks.tasks
            event.affectsConfiguration('tasks.tasks')
                ? new Set(['TASKS'])
                : new Set();

        for (const [key, sectionSet] of ResourceConfigurationSchema.SECTIONS_BY_KEY) {
            for (const section of sectionSet) {
                if (event.affectsConfiguration(section)) {
                    changes.add(key);
                    break;
                }
            }
        }

        if (changes.size < 1) {
            this.#logOutputChannel.trace('  Change does not affect any resource settings or tasks. Ignoring.');
            return;
        }

        this.#logOutputChannel.trace(`  Scheduling update with ${[...changes.keys()].map((k) => `"${k}"`).join(', ')}`);

        this.#scheduleUpdate(changes);

    }

    // #endregion Handlers


    /** Получить ресурсную конфигурацию для заданной области-источника.
     *
     * @returns {@linkcode ResourceConfig} или `null`, если область-источник не существует
     *          (например, была удалена, а ссылка на неё сохранилась в истории).
     * @throws { Error } если координатор disposed на момент запроса.
     * @throws { Error } если координатор disposed во время ожидания. */
    public async getResourceConfig(originKey: OriginKey): Promise<Immutable<ResourceConfig> | null> {

        assert.ok(!this.disposed, `[${this.constructor.name}#getResourceConfig]: use after dispose`);

        await this.#waitForIdle();

        if (this.disposed) { throw new Error(`[${this.constructor.name}#getResourceConfig]: was disposed while waiting`); }

        // если состояние согласовано то для существующей области-источника
        // есть результат (возможно пустой).
        // но если состояние где-то сохраняется (история, пины...) возможен
        // запрос к не существующей.
        return this.#perOriginConfig.get(originKey) ?? null;
    }


    /** Восстанавливает происхождение рантайм-задачи (OriginKey)
     *
     * @param task  Рантайм-задача, чьё происхождение нужно установить.
     * @returns `OriginKey` если задачу удалось сопоставить определению, иначе `null`.
     *
     * @throws { Error } если координатор disposed на момент запроса.
     * @throws { Error } если координатор disposed во время ожидания. */
    public async resolveTaskOrigin(task: Immutable<Task>): Promise<Immutable<{ originKey: OriginKey; taskName: TaskName; }> | null> {

        assert.ok(!this.disposed, `[${this.constructor.name}#resolveTaskOrigin]: use after dispose`);

        await this.#waitForIdle();

        if (this.disposed) { throw new Error(`[${this.constructor.name}#resolveTaskOrigin]: was disposed while waiting`); }

        if (!EligibleTask.isEligibleTask(task)) { return null; }

        const originKey = lookupTaskOrigin(task, this.#taskDefinitions);

        if (!originKey) { return null; }

        return {
            originKey,
            taskName: task.name
        };

    }

    /** Формирует снимок всех областей-источников в виде записей `OriginEntry`.
     *
     * Снимок содержит:
     * - `user` — глобальную пользовательскую область; её `taskSourceUri` всегда `null`;
     * - `project` — список проектных областей. При наличии workspace первой идёт
     *   workspace-область, затем folder-области; если workspace отсутствует —
     *   только folder-область.
     *
     * Каждая запись включает:
     * - `originKey`;
     * - `name`;
     * - `taskSourceUri` — файл-источник-задач ассоциированныи с данным originKey;
     * - `hierarchyConfig`;
     * - `definitionEntries` — определения задач для этой области.
     *
     * Снимок соответствует последнему завершённому циклу обновления и согласован
     * со всеми внутренними кешами координатора.
     *
     * @returns Неизменяемый снимок {@linkcode OriginEntriesSnapshot}.
     *
     * @throws { Error } если координатор disposed на момент запроса.
     * @throws { Error } если координатор disposed во время ожидания. */
    public async getOriginEntries(): Promise<Immutable<OriginEntriesSnapshot>> {

        assert.ok(!this.disposed, `[${this.constructor.name}#getOriginEntries]: use after dispose`);

        await this.#waitForIdle();

        if (this.disposed) { throw new Error(`[${this.constructor.name}#getOriginEntries]: was disposed while waiting`); }

        return {
            User: {
                ...this.#resourceStructure.User,
                hierarchyConfig: this.#perOriginConfig.get(OriginKey.USER)!.Hierarchy,
                definitionEntries: this.#taskDefinitions.get(OriginKey.USER)!
            },
            Workspace: this.#resourceStructure.Workspace
                ? {
                    ...this.#resourceStructure.Workspace,
                    hierarchyConfig: this.#perOriginConfig.get(OriginKey.WORKSPACE)!.Hierarchy,
                    definitionEntries: this.#taskDefinitions.get(OriginKey.WORKSPACE)!
                }
                : null,
            folders: this.#resourceStructure.folders
                ? this.#resourceStructure.folders.map((folder) => ({
                    ...folder,
                    hierarchyConfig: this.#perOriginConfig.get(folder.originKey)!.Hierarchy,
                    definitionEntries: this.#taskDefinitions.get(folder.originKey)!
                }))
                : []
        };

    }


    /** Возвращает агрегированный набор данных для конкретной задачи указанной области-источника.
     *
     * `TaskBundle` содержит:
     * - `nodeConfig` — конфигурацию отображения узла для origin или `null`;
     * - `taskDefinition` — активное определение задачи или `null`, если отсутствует;
     * - `eligibleTask` — рантайм-задачу или `null`, если VS Code не смогла её построить.
     *
     * @param originKey  Ключ области-источника.
     * @param taskName   Имя задачи.
     * @returns Неизменяемый {@linkcode TaskBundle} с данными задачи.
     *
     * @throws { Error } если координатор disposed на момент запроса.
     * @throws { Error } если координатор disposed во время ожидания. */
    public async getTaskBundle(originKey: OriginKey, taskName: TaskName): Promise<Immutable<TaskBundle>> {

        assert.ok(!this.disposed, `[${this.constructor.name}#getTaskBundle]: use after dispose`);

        await this.#waitForIdle();

        if (this.disposed) { throw new Error(`[${this.constructor.name}#getTaskBundle]: was disposed while waiting`); }

        return {
            nodeConfig: this.#perOriginConfig.get(originKey)?.Node ?? null,
            taskDefinition: this.#taskDefinitions.get(originKey)?.get(taskName)?.effective ?? null,
            eligibleTask: this.#eligibleTasks.get(originKey)?.get(taskName) ?? null
        };
    }


    /** Возвращает ассоциированный источник задач для указанного origin.
     *
     * Перед чтением ожидает завершения текущего обновления конфигурации.
     * Если объект был или стал disposed — выбрасывает исключение.
     *
     * @param originKey Ключ origin.
     *
     * @returns Источник задач, либо `null` для USER.
     *
     * @throws {Error} Если объект disposed — немедленно или во время ожидания idle.
     * @throws {Error} Если запрошен origin недоступен.
     */
    public async resolveTaskSource(originKey: OriginKey): Promise<Immutable<TaskSource> | null> {

        assert.ok(!this.disposed, `[${this.constructor.name}#resolveTaskSource]: use after dispose`);

        await this.#waitForIdle();

        if (this.disposed) { throw new Error(`[${this.constructor.name}#resolveTaskSource]: was disposed while waiting`); }

        if (originKey === OriginKey.USER) {
            return this.#resourceStructure.User.taskSource;
        }

        if (originKey === OriginKey.WORKSPACE) {
            const workspaceOrigin = this.#resourceStructure.Workspace;
            if (!workspaceOrigin) {
                throw new Error(`Origin not found for key "${originKey}"`);
            }
            return workspaceOrigin.taskSource;
        }

        const folderOrigin = this.#resourceStructure.folders?.find((f) => f.uri.toString() === originKey);

        if (!folderOrigin) {
            throw new Error(`Origin not found for key "${originKey}"`);
        }

        return folderOrigin.taskSource;

    }


    /** Принудительный полный пересбор состояния.
     * Может использоваться для выхода из ситуации, когда предыдущий цикл обновления
     * не завершился (например, из-за невозможного исключения, оставившего фазу в <UpdatePhase>),
     * или когда пользователь вручную запрашивает обновление.
     *
     * Сбрасывает отложенный дебаунс-таймер, немедленно запускает
     * `#performUpdate()` с полным пересчётом задач.
     *
     * Ошибка, возникшая в процессе, пробрасывается вызывающей стороне;
     * координатор при этом может остаться в несогласованном состоянии,
     * поэтому вызывающий код должен предусмотреть восстановление/показать ошибку пользователю.
     *
     * При конкуренции метод не гарантирует ожидание окончательного состояния.
     *
     * @returns {Promise<void>} Завершается после полного цикла обновления.
     *
     * @remark Это не recovery, а «пни ещё раз, вдруг повезёт». Он не обязан (и не может)
     * чинить то, что уже сломано.
     *
     * @throws { Error } Если `#performUpdate()` завершился с ошибкой.
     * @throws { Error } если координатор disposed на момент запроса.  */
    public forceFullRefresh(): Promise<void> {

        if (this.disposed) {
            return Promise.reject(new Error(`[${this.constructor.name}#forceFullRefresh]: use after dispose`));
        }

        this.#logOutputChannel.trace(`[${this.constructor.name}#forceFullRefresh] force full refresh...`);

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }
        else {
            this.#onDidScheduleUpdate.fire();
        }

        this.#pendingAffectedKeys = null;
        this.#phase = {
            affectedKeys: new Set(['TASKS', ...ResourceConfigurationSchema.SECTIONS_BY_KEY.keys()])
        };

        return this.#performUpdate();
    }


    /** Ждёт завершения текущего цикла обновления.
     *
     * После возврата фаза координатора гарантированно равна `'idle'`, а все кеши
     * соответствуют последнему завершённому {@linkcode #performUpdate}.
     *
     * @returns Промис, резолвящийся при переходе фазы в `'idle'`.
     *
     * @throws { Error } если координатор disposed на момент вызова.
     * @throws { Error } если координатор disposed во время ожидания. */
    #waitForIdle(): Promise<void> {

        if (this.#phase === 'idle') { return Promise.resolve(); }

        if (this.#idleDeferred) { return this.#idleDeferred.promise; }

        let resolve!: (value: void | PromiseLike<void>) => void;
        let reject!: (reason?: unknown) => void;

        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        // assert.ok(resolve);
        // assert.ok(reject);

        this.#idleDeferred = { promise, resolve, reject };

        return this.#idleDeferred.promise;
    }


    /** Объединяет изменения в `#pendingAffectedKeys` и (пере)запускает дебаунс-таймер.
     *
     * Вызовы в течение {@linkcode ResourceStateCoordinator.#DEBOUNCE_DELAY} мс схлопываются
     * в один запуск `#performUpdate`, предотвращая спам от одновременных
     * `onDidChangeWorkspaceFolders` и `onDidChangeConfiguration`.
     *
     * @param changes  Ключи ресурсов, затронутых текущим изменением. */
    #scheduleUpdate(changes: AffectedKeys): void {

        if (this.disposed) { return; }

        this.#pendingAffectedKeys ??= new Set();
        for (const key of changes) {
            this.#pendingAffectedKeys.add(key);
        }

        // Перезапускаем таймер
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }
        else {
            this.#onDidScheduleUpdate.fire();
        }

        this.#debounceTimer = setTimeout(() => {

            this.#debounceTimer = null;

            if (this.#phase === 'disposed') { return; }

            if (!this.#pendingAffectedKeys) {
                // потенциально может обогнать forceFullRefresh
                return;
            }

            const pendingChanges =
                this.#phase === 'idle'
                    ? new Set(this.#pendingAffectedKeys)
                    : new Set([...this.#pendingAffectedKeys, ...this.#phase.affectedKeys]);
            this.#pendingAffectedKeys = null;

            this.#phase = { affectedKeys: pendingChanges };

            // Запускаем новую работу
            void this.#performUpdate().catch((error) => {

                this.#logOutputChannel.error(`[${this.constructor.name}#performUpdate]: unexpected error`, error);
                // @todo форс-переход? но куда? и с каким обоснованием?
                // @reject это состояние недостижимо при соблюдении контрактов нижележащих функций,
                // и если оно достигнуто — чинить нужно контракт, а не добавлять сюда recovery-логику.
                // Координатору некуда переходить и продолжать работу, его инструментарий сломан:
                // теперь любое состояние не может считаться ни актуальным, ни согласованным.
                // "Не бросало раньше" — не значит "соблюдало контракт раньше": не-throw — лишь
                // часть контракта, а не весь. Раз здесь он доказано нарушен, нет оснований
                // доверять и тем результатам того же кода, что были построены ранее без исключений.
                //
                // Это осознанный отказ от ложных восстановлений:
                // Попадание сюда означает нарушение контракта нижележащих функций.
                // Восстановление не предусмотрено: кеши могут быть несогласованы.
                // Ошибка логируется как баг, а не как ожидаемое состояние.
                // Поэтому попадание в эту ветку — это баг кода.
                // Эту ветку нельзя правильно обработать не исправляя код.
                // Как и нет "правильной" реакции на такое поведение.
                // Переход в idle или disposed будет маскировкой а не "восстановлением".
                // Чинить контракт того, что бросило. Всё остальное — самообман.
            });
        }, ResourceStateCoordinator.#DEBOUNCE_MS);

    }


    /** Выполняет один цикл обновления кешей.
     *
     * Если затронуты задачи (`'TASKS'`), вызывает `EligibleTask.fetchTasks()`;
     * ошибка трактуется как пустой список. Затем обновляет кеши через `#updateCaches`.
     *
     * Stale-check: если фаза изменилась за время асинхронного ожидания —
     * результаты отбрасываются, кеши не трогаются.
     *
     * По завершении переводит фазу в `'idle'`, резолвит `#idleDeferred`
     * и испускает `onDidStateChange`.
     *
     * @throws { never } Не должен бросать — ошибки `fetchTasks()` перехватываются внутри.
     *    Контракт синхронных функций (`#updateCaches` и др.) — не бросать. */
    async #performUpdate(): Promise<void> {

        assert.ok(typeof this.#phase !== 'string', 'must only be called when an update phase');

        const capturedPhase = this.#phase;

        this.#logOutputChannel.trace(`[${this.constructor.name}#performUpdate]: Updating caches for ${[...capturedPhase.affectedKeys.keys()].map((k) => `"${k}"`).join(', ')}`);

        // for-debug-only
        // await new Promise<void>((r) => {
        //     setTimeout(() => {
        //         r();
        //     }, 5_000);
        // });

        let eligibleTasks: Immutable<EligibleTask[]> | null = null;

        if (capturedPhase.affectedKeys.has('TASKS')) {
            // ---------------------------
            // Асинхронный блок, получение рантайм-задач
            try {
                eligibleTasks = await EligibleTask.fetchTasks();
            }
            catch (error) {
                // Логируем и рассматриваем список задач как пустой.
                // Если среда стабилизируется, следующее обновление (по изменению
                // конфигурации или ручному refresh) подхватит актуальный список, если сможет.
                // Сохранять старый кеш когда VS Code явно сигнализирует что среда сломана —
                // нельзя, это ложная картина мира для пользователя.
                // Раз VS Code не может доставить рантайм-задачи, а другого источника не
                // существует — показываем пусто.
                this.#logOutputChannel.error(`[${this.constructor.name}#performUpdate]: Tasks.fetchTasks() threw unexpectedly — treating task list as empty.`, error);
                // Сбой в VS Code API — расширение не может и *не должно* восстанавливать что-либо.
                eligibleTasks = []; // не null, иначе updateCaches пропустит обновление taskDefinitions
            }
        }

        // Сверить фазу, в которой начали, с фактической текущей
        // Результат нужен, только если фаза строго равна текущей (не менялась).
        if (this.#phase !== capturedPhase) {
            // Могли перейти в dispose, или нас обогнали:
            // результат нашей работы уже никому не нужен — отбрасываем

            const reason =
                typeof this.#phase === 'string'
                    ? `phase changed to '${this.#phase}'`
                    : 'newer update cycle started';
            this.#logOutputChannel.trace(`[${this.constructor.name}#performUpdate]: stale — ${reason}, discarding results`);
            return;
        }
        // -----
        // Только если дошли сюда — обновляем кеши.
        // Иначе все результаты выбрасываются — геттеры продолжать
        // отдавать, возможно, старое но согласованное состояние.
        // Так и задумано:
        // - кеши могут устаревать, но в таком случае гарантируется
        //     повторный запуск и onDidChange.
        // - между onDidChange — кеши взаимно согласованы.
        // ------------------------

        // если выше получали рантайм-задачи (успешно или нет)
        // будет обновление и кеша задач, иначе только конфигурации

        // Вызываемые функции **обязаны** не бросать исключений
        // и всегда возвращать результат (возможно, пустой). Их контракт —
        // их ответственность.
        this.#updateCaches(eligibleTasks);

        // Снапшот получен
        this.#phase = 'idle';
        if (this.#idleDeferred) {
            this.#idleDeferred.resolve();
            this.#idleDeferred = null;
        }
        this.#onDidCompleteUpdate.fire(capturedPhase.affectedKeys);
    }


    /** Синхронно пересобирает внутренние кеши.
     *
     * `#resourceStructure` пересчитывается безусловно на каждом вызове.
     * `#taskDefinitions` и `#eligibleTasks` — только если `eligibleTasks != null`
     * (т.е. в этом цикле запрашивались рантайм-задачи).
     * `#perOriginConfig` пересчитывается безусловно.
     *
     * @param eligibleTasks  Свежий список рантайм-задач или `null`,
     *    если текущий цикл не затрагивал задачи (только конфигурация). */
    #updateCaches(eligibleTasks: Immutable<Array<EligibleTask>> | null) {

        // resourceStructure пересчитывается безусловно на каждом обновлении,
        // потому что изменение workspaceFolders могло произойти одновременно
        // с изменением конфигурации. Так мы гарантируем,
        // что структура всегда актуальна.
        this.#resourceStructure = ResourceStructure.build();

        // если получали рантайм-задачи
        if (eligibleTasks != null) {
            this.#taskDefinitions = groupTaskDefinitions(this.#resourceStructure);
            this.#eligibleTasks = groupEligibleTasks(eligibleTasks, this.#taskDefinitions);
        }

        this.#perOriginConfig = groupResourceConfig(
            this.#resourceStructure,
            ResourceConfigurationSchema.SCHEMA
        );
    }


    // ----------------------------------------------
    public get disposed(): boolean {
        return this.#phase === 'disposed';
    }

}


// -----


/** Тянет рантайм-задачи, перезапускаясь, если конфигурация задач поменялась
 * прямо во время запроса — иначе есть риск получить уже устаревший результат.
 * Используется только на этапе {@linkcode ResourceStateCoordinator.create}, пока
 * экземпляра ещё нет и полагаться на обработчик `onDidChangeConfiguration`
 * нельзя.
 *
 * Есть защита от ухода в бесконечный цикл, если система постоянно в нестабильном
 * состоянии.
 * Внимание: "защита **от ухода в бесконечный цикл**", а не "защита от медленного fetchTasks".
 * Дедлайн на **повторы**, не на **текущую проверку**.
 *
 * @param deadlineMs
 * @param logOutputChannel
 *
 * @throws { Error } Выбрасывает наверх ошибки {@linkcode EligibleTask.fetchTasks}.
 * @throws { Error } Если система не стабилизировалась за `deadlineMs`. */
async function fetchEligibleTasksUntilStable(
    deadlineMs: number,
    logOutputChannel: LifecycleOmitted<LogOutputChannel>
): Promise<Immutable<Array<EligibleTask>>> {

    let isTimedOut = false;
    // Маркер, что состояние изменилось **пока идет** fetchTasks()
    let taskEnvChanged: boolean;

    // Общий таймаут на весь процесс запуска.
    // НЕ race между fetchTasks и таймаутом — никаких утверждений
    // о состоянии системы, не дождавшись ответа, делать нельзя.
    // Если fetchTasks висит 3 часа - мы ждем три часа. Если потом
    // isDirty поднят - мы просто не делаем следующую попытку.
    // Если бросить ждать через deadlineMs - где гарантия что
    // fetchTasks не зарезолвился бы через deadlineMs+1 ?
    const timeoutHandle = setTimeout(() => {
        isTimedOut = true;
    }, deadlineMs);

    const disposables: Disposable[] = [];

    // Начинаем следить за изменениями в задачах.
    workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('tasks.tasks')) {
            // изменение в задачах поднимет dirtyFlag
            taskEnvChanged = true;
        }
    }, undefined, disposables);

    workspace.onDidChangeWorkspaceFolders((_event) => {
        // изменение в структуре проекта поднимет dirtyFlag
        taskEnvChanged = true;
    }, undefined, disposables);


    try {

        while (!isTimedOut) { // можно перезапускать только пока время не вышло

            // перед попыткой опускаем флаг
            taskEnvChanged = false;

            // ...и фетчим задачи
            const eligibleTasks = await EligibleTask.fetchTasks();

            // после попытки смотрим на флаг
            if (taskEnvChanged === false) {
                // если успели — возвращаем
                return eligibleTasks;
            }

            // если не успели — уходим на следующий круг

            logOutputChannel.trace(
                `[fetchEligibleTasksUntilStable]: task environment changed mid-request. ${isTimedOut ? 'Deadline expired, will throw.' : 'Retrying.'}`
            );

        }

        // если вывалились за цикл — значит время, выделенное на попытки, вышло
        throw new Error('[fetchEligibleTasksUntilStable]: stabilization attempts aborted — allotted time expired while configuration was still changing');

    }
    finally {
        disposables.forEach((d) => void d.dispose());
        clearTimeout(timeoutHandle);
    }
}


export default ResourceStateCoordinator;
