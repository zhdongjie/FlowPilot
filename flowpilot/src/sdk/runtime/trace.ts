// src/sdk/runtime/trace.ts

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
}

/**
 * 🧠 唯一真相源：事件因果记录器
 */
export class TraceStore {
    private logs: TraceEvent[] = [];

    record(event: TraceEvent) {
        this.logs.push(event);
    }

    all(): TraceEvent[] {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }

    getStepTimeline(stepId: string) {
        return this.logs.filter(e =>
            e.stepId === stepId ||
            e.fromStep === stepId ||
            e.toStep === stepId
        );
    }

    getCausalChain(signalId: string) {
        return this.logs.filter(e => e.signalId === signalId);
    }

    timeline() {
        return this.logs.map(e => ({
            t: e.type,
            step: e.stepId,
            key: e.key,
            time: e.timestamp
        }));
    }
}
