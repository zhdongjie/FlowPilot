// src/sdk/core/store.ts

import type { Signal } from "../types";

export class SignalStore {
    private events: Signal[] = [];
    private seen = new Set<string>();

    push(signal: Signal) {
        if (this.seen.has(signal.id)) return;

        this.events.push(signal);
        this.seen.add(signal.id);
    }

    getEvents(): Signal[] {
        return this.events;
    }

    clear() {
        this.events = [];
        this.seen.clear();
    }

}
