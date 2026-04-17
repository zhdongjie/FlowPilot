// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import { TraceStore } from "./trace";
import { FlowReplayer } from "./replay";

import type { Step, Signal } from "../types";

export interface RuntimeOptions {
    steps: Step[];
    enableTrace?: boolean;
}

/**
 * Runtime = 唯一对外入口
 */
export class FlowRuntime {
    private engine: FlowEngine;
    private trace?: TraceStore;

    constructor(options: RuntimeOptions) {
        this.engine = new FlowEngine(options.steps);

        if (options.enableTrace) {
            this.trace = new TraceStore();
        }

        this.log({
            type: "ENGINE_INIT",
            timestamp: Date.now(),
            stepId: this.engine.currentStep?.id
        });
    }

    ingest(signal: Signal) {

        this.log({
            type: "SIGNAL_INGEST",
            timestamp: Date.now(),
            signalId: signal.id,
            key: signal.key,
            stepId: this.engine.currentStep?.id
        });

        const before = this.engine.currentStep?.id;

        this.engine.ingest(signal);

        const after = this.engine.currentStep?.id;

        if (before !== after) {
            this.log({
                type: "STEP_ADVANCE",
                timestamp: Date.now(),
                fromStep: before,
                toStep: after,
                stepId: after
            });
        }
    }

    revert(index: number) {
        const before = this.engine.currentStep?.id;

        this.engine.revert(index);

        const after = this.engine.currentStep?.id;

        this.log({
            type: "REVERT",
            timestamp: Date.now(),
            fromStep: before,
            toStep: after,
            stepId: after
        });
    }

    replay(signals: Signal[]) {
        return FlowReplayer.replay(this.engine.steps, signals);
    }

    get currentStep() {
        return this.engine.currentStep;
    }

    debug() {
        return {
            currentStep: this.engine.currentStep,
            index: (this.engine as any).currentIndex,
            trace: this.trace?.all() ?? []
        };
    }

    private log(event: any) {
        this.trace?.record(event);
    }
}
