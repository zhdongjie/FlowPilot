// src/sdk/core/store.ts

import type { Signal } from "../types/signal";

export class SignalStore {
    private events: Signal[] = [];

    push(signal: Signal) {
        this.events.push(signal);
    }

    getEvents(): Signal[] {
        return this.events;
    }

    clear() {
        this.events = [];
    }

}
