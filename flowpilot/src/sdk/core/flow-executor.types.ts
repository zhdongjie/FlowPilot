// src/sdk/core/flow-executor.types.ts

import { EvalContext, ParsedStep } from "../types";
import { FlowState } from "./flow-state.ts";
import {TimerEvent} from "./executor-events.ts";
import {TraceEvent} from "../runtime/trace";

export interface FlowExecutorDeps {
    state: FlowState;

    stepsMap: Map<string, ParsedStep>;

    trace: {
        record(event: any): void
    };

    scheduler: {
        push(task: { ts: number; stepId: string; type: string }): void;

        peek(): any;

        pop(): any;
    };

    createContext: (stepId: string, ts: number) => EvalContext;
}

export interface StatePatch {
    pending: string[];
    activate: string[];
    complete: string[];
    cancel: string[];
    timers: TimerEvent[];
    traces: TraceEvent[];
}
