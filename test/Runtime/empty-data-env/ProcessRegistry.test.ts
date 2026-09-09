/** @file Runtime/ProcessRegistry.test.ts */
/** @internal */

import assert from 'node:assert/strict';
import type { Disposable } from 'vscode';
import type TaskProcessId from '../../../src/Runtime/TaskProcessId';
import type OriginKey from '../../../src/OriginKey';
import type TaskName from '../../../src/TaskName';
import type RequestId from '../../../src/Runtime/RequestId';
import type Immutable from '../../../src/utils/Immutable';
import TaskProcessRegistry from '../../../src/Runtime/TaskProcessRegistry';
import LogOutputChannel from '../../../src/extension/LogOutputChannel';


function hashDjb2(s: string): number {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i);
    }
    return hash >>> 0;
}

const producePid = (seed: string) => hashDjb2(seed) as TaskProcessId;
const produceOriginKey = (originKey: string) => originKey as OriginKey;

const tp = (originKey: string, taskName: string, pidSeed: string) => {
    const ok = produceOriginKey(originKey);
    const tn = taskName as TaskName;
    const pid = producePid(pidSeed);
    return {
        originKey: ok,
        taskName: tn,
        pid,
        args: (stamp: RequestId) => [stamp, ok, tn, pid] as const,
        taskId: () => [ok, tn] as const,
    };
};

let _mono = 0;
const mono = () => ++_mono as RequestId;

// `${/*N=0*/'000'/**/}`

suite('ProcessRegistry', function () {

    let logOutputChannel: LogOutputChannel;
    suiteSetup(function () {
        logOutputChannel = LogOutputChannel.createLogger('ProcessRegistry.test');
    });

    suiteTeardown(function () {
        logOutputChannel.dispose();
    });


    let registry: TaskProcessRegistry;
    let disposables: Disposable[];

    setup(function () {
        registry = new TaskProcessRegistry(logOutputChannel);
        disposables = [registry];
    });

    teardown(function () {
        disposables.forEach((d) => void d.dispose());
    });


    // --------------------------------------------------------------------------
    suite('register', function () {

        test(`${/*++N*/'001'/**/} процесс добавляется в состоянии running`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            assert.equal(registry.getTaskProcessStates(...p.taskId())?.get(p.pid)?.running, true);
        });

        test(`${/*++N*/'002'/**/} корректные поля после регистрации`, function () {
            const before = Date.now();
            const stamp = mono();
            const p = tp('ws', 't1', 'p1');

            registry.register(...p.args(stamp));

            const entry = registry.getTaskProcessStates(...p.taskId())?.get(p.pid);
            assert.ok(entry, 'запись должна существовать');
            assert.equal(entry.running, true);
            assert.equal(entry.requestId, stamp);
            assert.ok(before <= entry.registerTimestamp && entry.registerTimestamp <= Date.now());
        });

        test(`${/*++N*/'003'/**/} дубликат processId — ошибка`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            assert.throws(() => {
                registry.register(...p.args(mono()));
            }, /* @todo */);
        });

        test(`${/*++N*/'004'/**/} отправляет уведомление с идентификатором задачи`, function () {
            const p = tp('ws', 't1', 'p1');
            const fired: Array<boolean | undefined> = [];

            registry.onDidChangeTaskProcesses((e) => {
                if (!e.get(p.originKey)?.has(p.taskName)) { return; }
                fired.push(registry.getTaskProcessStates(...p.taskId())?.get(p.pid)?.running);
            }, undefined, disposables);

            registry.register(...p.args(mono()));

            assert.deepStrictEqual(fired, [true]);
        });

    });


    // --------------------------------------------------------------------------
    suite('markCompleted', function () {

        test(`${/*++N*/'005'/**/} процесс остаётся в реестре, running переходит в false`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            registry.markCompleted(mono(), new Set([p.pid]));
            assert.equal(registry.getTaskProcessStates(...p.taskId())?.get(p.pid)?.running, false);
        });

        test(`${/*++N*/'006'/**/} незарегистрированный процесс — НЕ ошибка`, function () {
            assert.doesNotThrow(() => {
                registry.markCompleted(mono(), new Set([producePid('ghost')]));
            });
        });

        test(`${/*++N*/'007'/**/} только указанные процессы переходят в completed`, function () {
            const p1 = tp('ws', 't1', 'p1');
            const p2 = tp('ws', 't2', 'p2');
            const p3 = tp('ws', 't3', 'p3');

            registry.register(...p1.args(mono()));
            registry.register(...p2.args(mono()));
            registry.register(...p3.args(mono()));

            registry.markCompleted(mono(), new Set([p2.pid]));

            assert.equal(registry.getTaskProcessStates(...p1.taskId())?.get(p1.pid)?.running, true, 'p1 не тронут');
            assert.equal(registry.getTaskProcessStates(...p2.taskId())?.get(p2.pid)?.running, false, 'p2 завершён');
            assert.equal(registry.getTaskProcessStates(...p3.taskId())?.get(p3.pid)?.running, true, 'p3 не тронут');
        });

        test(`${/*++N*/'008'/**/} отправляет уведомление при регистрации и при завершении`, function () {
            const p = tp('ws', 't1', 'p1');
            const states: Array<boolean | undefined> = [];

            registry.onDidChangeTaskProcesses((e) => {
                if (!e.get(p.originKey)?.has(p.taskName)) { return; }
                states.push(registry.getTaskProcessStates(...p.taskId())?.get(p.pid)?.running);
            }, undefined, disposables);

            registry.register(...p.args(mono()));
            registry.markCompleted(mono(), new Set([p.pid]));

            assert.deepStrictEqual(states, [true, false]);
        });

        test(`${/*++N*/'009'/**/} повторный markCompleted на уже-completed — ошибка`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            registry.markCompleted(mono(), new Set([p.pid]));
            assert.throws(() => {
                registry.markCompleted(mono(), new Set([p.pid]));
            }, /* @todo */);
        });

        test(`${/*++N*/'010'/**/} событие содержит только затронутые задачи`, function () {
            const originKey = produceOriginKey('ws');
            const p1 = tp(originKey, 't1', 'p1');
            const p2 = tp(originKey, 't2', 'p2');
            registry.register(...p1.args(mono()));
            registry.register(...p2.args(mono()));

            let payload: Immutable<Map<OriginKey, Set<TaskName>>> | undefined;
            registry.onDidChangeTaskProcesses((e) => { payload = e; }, undefined, disposables);

            registry.markCompleted(mono(), new Set([p1.pid]));

            assert.ok(payload?.size == 1);
            assert.equal(payload?.get(originKey)?.size, 1);
            assert.ok(payload?.get(p1.originKey)?.has(p1.taskName), 'p1 в payload');
            assert.ok(!payload?.get(p2.originKey)?.has(p2.taskName), 'p2 не в payload');
        });

    });


    // --------------------------------------------------------------------------
    suite('reconcile', function () {

        test(`${/*++N*/'011'/**/} процесс, отсутствующий в снапшоте и не новее него — удаляется`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            registry.reconcile(mono(), new Set());
            assert.equal(registry.getTaskProcessStates(...p.taskId()), undefined);
        });

        test(`${/*++N*/'012'/**/} процесс, присутствующий в снапшоте — не удаляется`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            registry.reconcile(mono(), new Set([p.pid]));
            assert.ok(registry.getTaskProcessStates(...p.taskId())?.get(p.pid));
        });

        test(`${/*++N*/'013'/**/} процесс новее снапшота — не удаляется`, function () {
            const snapshotId = mono();
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono())); // requestId > snapshotId
            registry.reconcile(snapshotId, new Set());
            assert.ok(registry.getTaskProcessStates(...p.taskId())?.get(p.pid));
        });

        test(`${/*++N*/'014'/**/} процесс с requestId == snapshot requestId — удаляется (не новее)`, function () {
            const stamp = mono();
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(stamp));
            registry.reconcile(stamp, new Set());
            assert.equal(registry.getTaskProcessStates(...p.taskId()), undefined);
        });

        test(`${/*++N*/'015'/**/} смешанный: старый удаляется, новый остаётся`, function () {
            const stampOld = mono();
            const stampMid = mono();
            const stampNew = mono();
            const old = tp('ws', 't1', 'old');
            const fresh = tp('ws', 't1', 'new');

            registry.register(...old.args(stampOld));
            registry.register(...fresh.args(stampNew));

            registry.reconcile(stampMid, new Set());

            assert.equal(registry.getTaskProcessStates(...old.taskId())?.get(old.pid), undefined, 'old удалён');
            assert.ok(registry.getTaskProcessStates(...fresh.taskId())?.get(fresh.pid), 'fresh остался');
        });

        test(`${/*++N*/'016'/**/} удаляет процесс в любом состоянии (running и completed)`, function () {
            const p1 = tp('ws', 't1', 'p1');
            const p2 = tp('ws', 't1', 'p2');

            registry.register(...p1.args(mono()));
            registry.register(...p2.args(mono()));
            registry.markCompleted(mono(), new Set([p1.pid]));

            registry.reconcile(mono(), new Set());

            assert.equal(registry.getTaskProcessStates(...p1.taskId()), undefined);
        });

        test(`${/*++N*/'017'/**/} отправляет уведомление с идентификаторами удалённых задач`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));

            let payload: Immutable<Map<OriginKey, Set<TaskName>>> | undefined;
            registry.onDidChangeTaskProcesses((e) => { payload = e; }, undefined, disposables);

            registry.reconcile(mono(), new Set());

            assert.ok(payload?.get(p.originKey)?.has(p.taskName));
        });

        test(`${/*++N*/'018'/**/} событие охватывает все затронутые задачи`, function () {
            const p1 = tp('ws', 't1', 'p1');
            const p2 = tp('ws', 't2', 'p2');
            registry.register(...p1.args(mono()));
            registry.register(...p2.args(mono()));

            let payload: Immutable<Map<OriginKey, Set<TaskName>>> | undefined;
            registry.onDidChangeTaskProcesses((e) => { payload = e; }, undefined, disposables);

            registry.reconcile(mono(), new Set());

            assert.ok(payload?.get(p1.originKey)?.has(p1.taskName));
            assert.ok(payload?.get(p2.originKey)?.has(p2.taskName));
        });

        test(`${/*++N*/'019'/**/} не отправляет уведомление если ничего не удалено`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));

            let firedCount = 0;
            registry.onDidChangeTaskProcesses(() => { firedCount++; }, undefined, disposables);

            registry.reconcile(mono(), new Set([p.pid]));

            assert.equal(firedCount, 0);
        });

        test(`${/*++N*/'020'/**/} незарегистрированные процессы в снапшоте игнорируются`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));

            registry.reconcile(mono(), new Set([producePid('ghost'), p.pid]));

            assert.ok(registry.getTaskProcessStates(...p.taskId())?.get(p.pid));
        });

        test(`${/*++N*/'021'/**/} markCompleted после reconcile — НЕ ошибка`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            registry.reconcile(mono(), new Set());
            assert.doesNotThrow(() => {
                registry.markCompleted(mono(), new Set([p.pid]));
            });
        });

    });


    // --------------------------------------------------------------------------
    suite('getTaskProcessStates', function () {

        test(`${/*++N*/'022'/**/} возвращает undefined если у задачи нет процессов`, function () {
            assert.equal(registry.getTaskProcessStates('ws' as OriginKey, 'T' as TaskName), undefined);
        });

        test(`${/*++N*/'023'/**/} содержит все процессы задачи`, function () {
            const p1 = tp('ws', 't1', 'p1');
            const p2 = tp('ws', 't1', 'p2');

            registry.register(...p1.args(mono()));
            registry.register(...p2.args(mono()));

            const states = registry.getTaskProcessStates(...p1.taskId());
            assert.ok(states);
            assert.equal(states.size, 2);
            assert.ok(states.has(p1.pid) && states.has(p2.pid));
        });

        test(`${/*++N*/'024'/**/} не смешивает процессы разных задач`, function () {
            const p1 = tp('ws', 't1', 'p1');
            const p2 = tp('ws', 't2', 'p2');

            registry.register(...p1.args(mono()));
            registry.register(...p2.args(mono()));

            const states = registry.getTaskProcessStates(...p1.taskId());
            assert.ok(states?.has(p1.pid));
            assert.ok(!states?.has(p2.pid));
        });

        test(`${/*++N*/'025'/**/} после удаления всех процессов задачи — undefined`, function () {
            const p = tp('ws', 't1', 'p1');
            registry.register(...p.args(mono()));
            registry.reconcile(mono(), new Set());
            assert.equal(registry.getTaskProcessStates(...p.taskId()), undefined);
        });

        test(`${/*++N*/'026'/**/} forward isolation — ранее полученный Map не меняется при новой регистрации`, function () {
            const p1 = tp('ws', 't1', 'p1');
            const p2 = tp('ws', 't1', 'p2');

            registry.register(...p1.args(mono()));

            const snap = registry.getTaskProcessStates(...p1.taskId());
            assert.equal(snap?.size, 1);

            registry.register(...p2.args(mono()));

            assert.equal(snap?.size, 1);                                          // snap — копия
            assert.equal(registry.getTaskProcessStates(...p1.taskId())?.size, 2); // свежий вызов видит оба

            assert.ok(snap?.has(p1.pid));
            assert.ok(!snap?.has(p2.pid));
        });

    });

});
