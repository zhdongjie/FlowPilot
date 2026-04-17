// src/sdk/core/store.ts

import type { Signal } from "../types/signal";

export class SignalStore {
    events: Signal[] = [];
    facts: Set<string> = new Set();

    push(signal: Signal) {
        if (signal.mode === "event") {
            this.events.push(signal);
        }

        if (signal.mode === "fact") {
            this.facts.add(signal.key);
        }
    }

    hasFact(key: string) {
        return this.facts.has(key);
    }

    getEvents() {
        return this.events;
    }

    lastTimestamp(): number {
        return this.events.length
            ? this.events[this.events.length - 1].timestamp
            : 0;
    }
}
