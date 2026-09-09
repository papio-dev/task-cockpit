/** @file extension/IdleTracker.ts */

import {
    EventEmitter
} from 'vscode';

// итоговое состояние: true только когда все подсистемы простаивают и никакие обновления не ожидаются.

class IdleTracker<T extends string> {

    #isIdle: boolean;
    #states = new Map<T, boolean>();
    readonly #onDidIdleChange = new EventEmitter<boolean>();
    readonly onDidIdleChange = this.#onDidIdleChange.event;

    constructor(initialComponents: T[], initialIdle: boolean = true) {
        initialComponents.forEach(c => this.#states.set(c, initialIdle));
        this.#isIdle = [...this.#states.values()].every(Boolean);
    }

    dispose() {
        this.#onDidIdleChange.dispose();
    }

    get isIdle(): boolean {
        return this.#isIdle;
    }

    setComponentIdle(component: T, idle: boolean): void {

        if (this.#states.get(component) === idle) { return; };

        this.#states.set(component, idle);

        const isIdle = [...this.#states.values()].every(Boolean);

        if (this.#isIdle !== isIdle) {
            this.#isIdle = isIdle;
            this.#onDidIdleChange.fire(this.#isIdle);
        }
    }

    markBusy(component: T) { this.setComponentIdle(component, false); }
    markIdle(component: T) { this.setComponentIdle(component, true); }
}


export default IdleTracker;
