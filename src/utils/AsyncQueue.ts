/** @file utils/AsyncQueue.ts */

import LogOutputChannel from '../extension/LogOutputChannel';
import type LifecycleOmitted from './LifecycleOmitted';

/** Простая последовательная очередь асинхронных операций.
 *
 * Каждая операция, переданная в `enqueue`, выполняется только после
 * завершения предыдущей. В случае ошибки в операции очередь не ломается —
 * ошибка проглатывается, и следующие операции продолжают выполняться.
 *
 * Дополнительно можно дождаться завершения всех операций в очереди
 * с помощью метода `drain()`. */
function create(
    queueName: string,
    logOutputChannel: LifecycleOmitted<LogOutputChannel>
): AsyncQueue {
    /** Цепочка промисов, представляющая конец очереди. */
    let pending: Promise<void> = Promise.resolve();
    return {
        /** Ставит операцию в очередь.
         *
         * Возвращает промис, который разрешится, когда операция будет выполнена
         * (успешно или с ошибкой). Сам факт ошибки не прерывает очередь,
         * вызывающий обязан обрабатывать возвращённый промис, иначе UHR.
         *
         * @param op Асинхронная операция без аргументов, которую нужно выполнить.
         * @returns Промис, отражающий выполнение конкретной операции. */
        enqueue(op: () => PromiseLike<void>): Promise<void> {
            const next = pending.then(op);
            // Заменяем pending на цепочку, которая не падает при ошибке,
            // чтобы следующие операции могли стартовать.
            pending = next.catch((reason: unknown) => {
                logOutputChannel.error(`[${queueName}]`, reason);
            });
            return next;
        },

        /** Ожидает завершения всех операций, уже поставленных в очередь.
         * После вызова `drain()` новые операции могут быть добавлены
         * и не будут учтены этим ожиданием. */
        drain(): Promise<void> {
            return pending;
        }
    };
}

interface AsyncQueue {
    enqueue(op: () => PromiseLike<void>): Promise<void>;
    drain(): Promise<void>;
};

const AsyncQueue = {
    create
} as const;

export default AsyncQueue;
