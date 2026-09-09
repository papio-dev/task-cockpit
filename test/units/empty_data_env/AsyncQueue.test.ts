import * as assert from 'assert';
import AsyncQueue from '../../../src/utils/AsyncQueue';
import LogOutputChannel from '../../../src/extension/LogOutputChannel';


// `${/*N=0*/'000'/**/}`

suite('Unit', function () {

    let logOutputChannel: LogOutputChannel;
    suiteSetup(function () {
        logOutputChannel = LogOutputChannel.createLogger('AsyncQueue.test');
    });

    suiteTeardown(function () {
        logOutputChannel.dispose();
    });

    suite('utils', function () {

        suite('AsyncQueue', function () {

            let queue: AsyncQueue;

            setup(() => {
                queue = AsyncQueue.create(logOutputChannel);
            });

            test(`${/*++N*/'001'/**/} выполняет операции последовательно`, async function () {

                const order: number[] = [];

                await Promise.all([
                    queue.enqueue(async () => { order.push(1); }),
                    queue.enqueue(async () => { order.push(2); }),
                    queue.enqueue(async () => { order.push(3); }),
                ]);

                assert.deepEqual(order, [1, 2, 3]);
            });

            test(`${/*++N*/'002'/**/} возвращает промис конкретной операции`, async function () {
                let resolved = false;

                // вторая операция не должна влиять на резолв первой
                const first = queue.enqueue(async () => { resolved = true; });
                queue.enqueue(async () => { /* висит после */ });

                await first;
                assert.strictEqual(resolved, true);
            });

            test(`${/*++N*/'003'/**/} пробрасывает ошибку вызывающему`, async function () {
                await assert.rejects(
                    queue.enqueue(async () => { throw new Error('boom'); }),
                    /boom/
                );
            });

            test(`${/*++N*/'004'/**/} ошибка в операции не блокирует очередь`, async function () {
                const results: string[] = [];

                await queue.enqueue(async () => { throw new Error('poison'); }).catch(() => { });
                await queue.enqueue(async () => { results.push('survived'); });

                assert.deepEqual(results, ['survived']);
            });
        });
    });
});
