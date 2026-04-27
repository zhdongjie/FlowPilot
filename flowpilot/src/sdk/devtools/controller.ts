// src/sdk/devtools/controller.ts
import type { FlowRuntime } from "../runtime/runtime";
import { DevToolsStore } from "./store";
import { EventEmitter } from "../utils/emitter";
import { FlowEngine } from "../core/engine.ts";

export class FlowDevTools {
    private readonly store = new DevToolsStore();
    private runtimeSub: (() => void) | null = null;

    public readonly emitter = new EventEmitter<void>();
    private debugEngine: FlowEngine | null = null;
    private hoveredEventKey: string | null = null;
    private hoveredHistoryStepId: string | null = null;

    connect(runtime: FlowRuntime) {
        this.runtimeSub = runtime.subscribe(() => {
            this.syncFromRealWorld(runtime);
        });

        this.syncFromRealWorld(runtime);
    }

    disconnect() {
        this.runtimeSub?.();
        this.runtimeSub = null;
        this.debugEngine?.stop();
        this.debugEngine = null;
        this.emitter.clear();
    }

    /**
     * Keep the timeline in sync from real trace data, then rebuild a shadow
     * engine from real signals so DAG diagnostics stay trustworthy.
     */
    private syncFromRealWorld(runtime: FlowRuntime) {
        const traceHistory = runtime.getTraceStream().all();
        this.store.clear();
        traceHistory.forEach(event => this.store.push(event));

        const { steps, rootStepId } = runtime.getEngineConfig();
        const shadowEngine = new FlowEngine(steps, rootStepId, {
            mode: "devtools"
        });

        const realSignals = [...runtime.getSignals()]
            .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        for (const signal of realSignals) {
            shadowEngine.ingest(signal);
        }

        shadowEngine.tick(Date.now());

        this.debugEngine?.stop();
        this.debugEngine = shadowEngine;
        this.emitter.emit();
    }

    getEvents() {
        return this.store.getAll();
    }

    getActiveDiagnostics() {
        if (!this.debugEngine) return [];

        return this.debugEngine.getActiveSteps()
            .map(stepId => this.getDiagnostic(stepId))
            .filter((diag): diag is NonNullable<typeof diag> => diag !== null);
    }

    getDiagnostic(stepId: string) {
        if (!this.debugEngine) return null;

        const history = this.store.getAll().filter(event => event.stepId === stepId);

        return {
            stepId,
            history,
            tree: this.debugEngine.explain(stepId)
        };
    }

    isRewinding(runtime: FlowRuntime): boolean {
        const trace = runtime.getTraceStream().all();
        return trace.length > 0 && trace[trace.length - 1].type === "REVERT";
    }

    rewindTime(runtime: FlowRuntime, targetTs: number) {
        runtime.revertToTime(targetTs);
    }

    setHoveredEventKey(key: string | null) {
        this.hoveredEventKey = key;
    }

    getHoveredEventKey() {
        return this.hoveredEventKey;
    }

    setHoveredHistoryStepId(stepId: string | null) {
        this.hoveredHistoryStepId = stepId;
    }

    getHoveredHistoryStepId() {
        return this.hoveredHistoryStepId;
    }

    getDebugEngine() {
        return this.debugEngine;
    }

    isFlowFinished(): boolean {
        if (!this.debugEngine) return false;

        return this.debugEngine.getActiveSteps().length === 0 &&
            this.debugEngine.getPendingSteps().length === 0 &&
            this.debugEngine.getCompletedSteps().length > 0;
    }
}
