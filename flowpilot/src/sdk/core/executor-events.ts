// src/sdk/core/executor-events.ts

export interface TimerEvent {
    ts: number;
    stepId: string;
    type: "timeout";
}
