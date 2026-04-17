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
        rootStepId: string // ✅ 显式要求起点
    ): ReplayResult {
        const engine = new FlowEngine(structuredClone(steps), rootStepId);
        const trace = new TraceStore();

        const sorted = [...signals].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        trace.record({ type: "RECOMPUTE_START", timestamp: Date.now() });

        for (const signal of sorted) {
            trace.record({
                type: "SIGNAL_INGEST",
                timestamp: signal.timestamp,
                signalId: signal.id,
                key: signal.key,
                // 👉 适配：记录当前所有的活跃步骤 ID
                activeSteps: engine.getActiveSteps()
            });

            engine.ingest(signal);
        }

        trace.record({ type: "RECOMPUTE_END", timestamp: Date.now() });

        return {
            engine,
            trace,
            state: {
                activeSteps: engine.getActiveSteps(),
                completedSteps: engine.getCompletedSteps()
            }
        };
    }
}
