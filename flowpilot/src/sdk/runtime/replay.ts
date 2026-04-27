// src/sdk/runtime/replay.ts

import { FlowEngine } from "../core/engine";
import { TraceStore } from "./trace";
import type { Step, Signal } from "../types";

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
        rootStepId: string
    ): ReplayResult {
        const engine = new FlowEngine(structuredClone(steps), rootStepId, { mode: "replay"});
        const traceScope = engine.getTrace();

        const sorted = [...signals].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        traceScope.record({
            type: "REPLAY_START",
            timestamp: Date.now()
        });

        for (const signal of sorted) {
            traceScope.record({
                type: "SIGNAL_INGEST",
                timestamp: signal.timestamp,
                signalId: signal.id,
                meta: {
                    key: signal.key,
                    // 👉 适配：记录当前所有的活跃步骤 ID
                    activeSteps: engine.getActiveSteps()
                }
            });

            engine.ingest(signal);
        }

        traceScope.record({
            type: "REPLAY_END",
            timestamp: Date.now()
        });

        return {
            engine: engine,
            trace: traceScope.raw(),
            state: {
                activeSteps: engine.getActiveSteps(),
                completedSteps: engine.getCompletedSteps()
            }
        };
    }
}
