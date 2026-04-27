// src/sdk/runtime/trace/trace.types.ts

export type TraceEventType =
    | "ENGINE_INIT"
    | "SIGNAL_INGEST"
    | "STEP_ACTIVATE"
    | "STEP_COMPLETE"
    | "STEP_CANCEL"
    | "FACT_APPLIED"
    | "REPLAY_START"
    | "REPLAY_END"
    | "REVERT"
    | "TIMER_FIRED"
    ;

export interface TraceEvent {
    id: string;
    type: TraceEventType;
    timestamp: number;

    /**
     * 统一语义字段
     */
    stepId?: string;
    signalId?: string;

    /**
     * 统一扩展入口
     */
    meta?: Record<string, any>;
}
