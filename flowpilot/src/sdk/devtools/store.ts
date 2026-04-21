// src/sdk/devtools/store.ts
import type { TraceEvent } from "../runtime/trace";

export class DevToolsStore {
    private events: TraceEvent[] = [];

    push(event: TraceEvent) {
        this.events.push(event);
    }

    getAll() {
        return this.events;
    }

    clear() {
        this.events = [];
    }
}
