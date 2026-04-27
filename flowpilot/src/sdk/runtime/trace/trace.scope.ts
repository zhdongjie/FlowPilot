// src/sdk/runtime/trace/trace.scope.ts

import { TraceStore } from "./trace.store";
import type { TraceEvent } from "./trace.types";

export type TraceMode = "runtime" | "replay" | "devtools";

export class TraceScope {
    constructor(
        public readonly mode: TraceMode,
        private readonly store: TraceStore
    ) {}

    record(
        event: Omit<TraceEvent, "id" | "timestamp"> & {
            timestamp?: number;
        }
    ) {
        if (this.store.getMuted()) return;

        const ts = event.timestamp ?? Date.now();

        this.store.record({
            id: `t_${ts}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: ts,

            stepId: event.stepId,
            signalId: event.signalId,
            type: event.type,

            meta: {
                ...event.meta,
                scope: this.mode
            }
        });
    }

    clear() {
        this.store.clear();
    }

    raw() {
        return this.store;
    }
}
