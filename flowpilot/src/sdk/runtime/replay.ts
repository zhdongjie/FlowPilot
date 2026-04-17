// src/sdk/runtime/replay.ts

import { FlowEngine } from "../core/engine";
import { TraceStore } from "./trace";

import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

export interface ReplayResult {
    engine: FlowEngine;
    trace: TraceStore;
    snapshot: {
        stepId: string;
        index: number;
    };
}

/**
 * Deterministic Replay Engine
 * 只做一件事：重建状态
 */
export class FlowReplayer {

    static replay(
        steps: Step[],
        signals: Signal[]
    ): ReplayResult {

        const engine = new FlowEngine(structuredClone(steps));
        const trace = new TraceStore();

        const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp);

        trace.record({
            type: "RECOMPUTE_START",
            timestamp: Date.now()
        });

        for (const signal of sorted) {

            trace.record({
                type: "SIGNAL_INGEST",
                timestamp: signal.timestamp,
                signalId: signal.id,
                key: signal.key,
                stepId: engine.currentStep?.id
            });

            engine.ingest(signal);
        }

        trace.record({
            type: "RECOMPUTE_END",
            timestamp: Date.now()
        });

        return {
            engine,
            trace,
            snapshot: {
                stepId: engine.currentStep?.id,
                index: (engine as any).currentIndex
            }
        };
    }
}
