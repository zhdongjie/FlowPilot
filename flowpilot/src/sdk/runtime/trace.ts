// src/sdk/runtime/trace.ts

import { EventEmitter } from "../devtools/emitter.ts";

/**
 * 规则：
 * - 只记录，不参与计算
 * - 不影响 engine state
 * - 不做任何“推导”
 */

export type TraceEventType =
    | "ENGINE_INIT"
    | "SIGNAL_INGEST"
    | "STEP_ACTIVATE"
    | "STEP_ADVANCE"
    | "FACT_APPLIED"
    | "EVENT_MATCH"
    | "REVERT"
    | "RECOMPUTE_START"
    | "RECOMPUTE_END";

export interface TraceEvent {
    type: TraceEventType;
    timestamp: number;

    stepId?: string;
    signalId?: string;
    key?: string;

    fromStep?: string;
    toStep?: string;

    meta?: Record<string, any>;
    activeSteps?: string[];
}

/**
 * 设计目标：
 * - 可回放
 * - 可追踪因果链
 * - 可用于 debug / UI / audit
 */
export class TraceStore {
    private logs: TraceEvent[] = [];

    private readonly emitter = new EventEmitter<TraceEvent>();

    private isMuted = false;

    // -----------------------------
    // write
    // -----------------------------
    record(event: TraceEvent) {
        if (this.isMuted) return;

        this.logs.push(event);
        this.emitter.emit(event);
    }

    // -----------------------------
    // read
    // -----------------------------
    all(): TraceEvent[] {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }

    // -----------------------------
    // query: step timeline
    // -----------------------------
    getStepTimeline(stepId: string): TraceEvent[] {
        return this.logs.filter(e =>
            e.stepId === stepId ||
            e.fromStep === stepId ||
            e.toStep === stepId
        );
    }

    // -----------------------------
    // query: signal causal chain
    // -----------------------------
    getCausalChain(signalId: string): TraceEvent[] {
        return this.logs.filter(e => e.signalId === signalId);
    }

    // -----------------------------
    // debug: simplified timeline
    // -----------------------------
    timeline(): Array<{
        type: TraceEventType;
        step?: string;
        key?: string;
        time: number;
    }> {
        return this.logs.map(e => ({
            type: e.type,
            step: e.stepId,
            key: e.key,
            time: e.timestamp
        }));
    }

    // -----------------------------
    // future extension hook
    // -----------------------------
    groupByStep(): Record<string, TraceEvent[]> {
        const map: Record<string, TraceEvent[]> = {};

        for (const e of this.logs) {
            const key = e.stepId ?? "__global__";
            if (!map[key]) map[key] = [];
            map[key].push(e);
        }

        return map;
    }

    truncate(targetTs: number) {
        this.logs = this.logs.filter(e => e.timestamp <= targetTs);
    }

    subscribe(fn: (event: TraceEvent) => void) {
        return this.emitter.subscribe(fn);
    }

    mute() { this.isMuted = true; }

    unmute() { this.isMuted = false; }

}
