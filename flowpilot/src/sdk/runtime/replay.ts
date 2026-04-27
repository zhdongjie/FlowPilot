// src/sdk/runtime/replay.ts

import { FlowEngine } from "../core/engine";
import { TraceStore } from "./trace";
import type { Step, Signal } from "../types";
import type { TraceMode } from "./trace";
import { cloneStepSnapshots } from "./step-snapshot";

export interface ReplayResult {
    engine: FlowEngine;
    trace: TraceStore;
    state: {
        activeSteps: string[];
        completedSteps: string[];
    };
}

export class FlowReplayer {
    static replay(
        steps: Step[],
        signals: Signal[],
        rootStepId: string,
        options?: {
            mode?: TraceMode;
        }
    ): ReplayResult {
        const engine = new FlowEngine(cloneStepSnapshots(steps), rootStepId, {
            mode: options?.mode ?? "replay"
        });
        const traceScope = engine.getTrace();

        const sorted = [...signals].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        traceScope.record({
            type: "REPLAY_START",
            timestamp: Date.now()
        });

        for (const signal of sorted) {
            engine.ingest(signal);
        }

        traceScope.record({
            type: "REPLAY_END",
            timestamp: Date.now()
        });

        return {
            engine,
            trace: traceScope.raw(),
            state: {
                activeSteps: engine.getActiveSteps(),
                completedSteps: engine.getCompletedSteps()
            }
        };
    }
}
