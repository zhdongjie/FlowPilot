// src/sdk/devtools/controller.ts
import type { FlowRuntime } from "../runtime/runtime";
import { DevToolsStore } from "./store";
import type { TraceEvent } from "../runtime/trace";

export class FlowDevTools {
    private store = new DevToolsStore();
    private unsubscribe: (() => void) | null = null;
    private onUpdateCallback?: () => void;

    /**
     * @param runtime 当前运行的引擎
     * @param onUpdate 外部 UI 传入的刷新回调（比如 Vue 的 triggerRef）
     */
    connect(runtime: FlowRuntime, onUpdate?: () => void) {
        this.onUpdateCallback = onUpdate;
        const traceStream = runtime.getTraceStream();

        // 1. 同步连接前已经发生的历史数据
        const history = traceStream.all();
        history.forEach(e => this.store.push(e));

        // 2. 挂载监听器，开启实时热订阅 (Push 模式的精髓)
        this.unsubscribe = traceStream.subscribe((event: TraceEvent) => {
            this.store.push(event);
            this.onUpdateCallback?.(); // 只要有新事件，立刻通知 UI 刷新
        });

        this.onUpdateCallback?.();
    }

    disconnect() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    getEvents() {
        return this.store.getAll();
    }

    // 调用底层的时空穿梭能力
    rewindTime(runtime: FlowRuntime, targetTs: number) {
        // 1. 触发引擎底层回溯
        runtime.revertToTime(targetTs);

        // 2. 强制洗牌面板：清空当前 UI 列表，重新拉取被截断后的纯净时间轴
        this.store.clear();
        const freshTimeline = runtime.getTraceStream().all();
        freshTimeline.forEach(e => this.store.push(e));

        // 3. 通知 Vue 更新
        this.onUpdateCallback?.();
    }
}
