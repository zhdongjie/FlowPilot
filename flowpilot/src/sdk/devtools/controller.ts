// src/sdk/devtools/controller.ts
import type { FlowRuntime } from "../runtime/runtime";
import { DevToolsStore } from "./store";
import type { TraceEvent } from "../runtime/trace";

export class FlowDevTools {
    private store = new DevToolsStore();
    private unsubscribe: (() => void) | null = null;
    private onUpdateCallback?: () => void;
    // 🌟 缓存 runtime 实例
    private runtime: FlowRuntime | null = null;

    connect(runtime: FlowRuntime, onUpdate?: () => void) {
        this.runtime = runtime;
        this.onUpdateCallback = onUpdate;
        const traceStream = runtime.getTraceStream();

        const history = traceStream.all();
        history.forEach(e => this.store.push(e));

        this.unsubscribe = traceStream.subscribe((event: TraceEvent) => {
            this.store.push(event);
            this.onUpdateCallback?.();
        });

        this.onUpdateCallback?.();
    }

    disconnect() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.runtime = null;
    }

    getEvents() {
        return this.store.getAll();
    }

    // 🌟 新增：由核心控制器直接暴露当前活跃节点的诊断树
    getActiveDiagnostics() {
        if (!this.runtime) return [];
        // 提取 engine 实例 (避免业务直接操作引擎内部)
        const engine = (this.runtime as any).engine;
        if (!engine) return [];

        const activeIds = engine.getActiveSteps();
        return activeIds.map((stepId: string) => ({
            stepId,
            tree: engine.explain(stepId)
        })).filter((diag: any) => diag.tree !== null);
    }

    rewindTime(runtime: FlowRuntime, targetTs: number) {
        runtime.revertToTime(targetTs);

        this.store.clear();
        const freshTimeline = runtime.getTraceStream().all();
        freshTimeline.forEach(e => this.store.push(e));

        this.onUpdateCallback?.();
    }

    public isRewinding(runtime: FlowRuntime): boolean {
        // 在内部访问私有属性是允许的
        const trace = (runtime as any).engine.trace.all();
        return trace.length > 0 && trace[trace.length - 1].type === 'REVERT';
    }

}
