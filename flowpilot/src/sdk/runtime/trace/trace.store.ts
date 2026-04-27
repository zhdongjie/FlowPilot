// src/sdk/runtime/trace/trace.store.ts

import type { TraceEvent } from "./trace.types";

export class TraceStore {
    private readonly logs: TraceEvent[] = [];
    private muted = false;

    record(event: TraceEvent) {
        if (this.muted) return;

        this.logs.push(event);
    }

    all() {
        return this.logs;
    }

    since(index: number) {
        return this.logs.slice(index);
    }

    length() {
        return this.logs.length;
    }

    clear() {
        this.logs.length = 0;
    }

    truncate(ts: number) {
        let i = this.logs.length - 1;

        while (i >= 0 && this.logs[i].timestamp > ts) {
            i--;
        }

        this.logs.length = i + 1;
    }

    setMuted(value: boolean) {
        this.muted = value;
    }

    getMuted() {
        return this.muted;
    }

    mute() {
        this.muted = true;
    }

    unmute() {
        this.muted = false;
    }

    getByStep(stepId: string) {
        return this.logs.filter(e => e.stepId === stepId);
    }

    getBySignal(signalId: string) {
        return this.logs.filter(e => e.signalId === signalId);
    }
}
