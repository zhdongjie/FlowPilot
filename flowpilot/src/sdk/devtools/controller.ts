// src/sdk/devtools/controller.ts
import type { FlowRuntime } from "../runtime/runtime";
import { FlowEngine } from "../core/engine";
import { DevToolsStore } from "./store";
import { EventEmitter } from "../utils/emitter";

export class FlowDevTools {
    private readonly store = new DevToolsStore();
    private runtimeSub: (() => void) | null = null;

    // 🌟 暴露出 DevTools 自己的订阅器，供 Vue / React 监听
    public readonly emitter = new EventEmitter<void>();

    // 🌟 核心：影子引擎（平行宇宙），专供沙盘推演和诊断获取，绝对隔离
    private debugEngine: FlowEngine | null = null;

    /**
     * 连接到真实环境的 Runtime
     */
    connect(runtime: FlowRuntime) {
        // 1. 获取真实引擎的配置，开辟一个一模一样的“平行宇宙”
        const config = runtime.getEngineConfig();
        this.debugEngine = new FlowEngine(config.steps, config.rootStepId);

        // 2. 监听真实世界的广播 (Pull 模型)
        this.runtimeSub = runtime.subscribe(() => {
            this.syncFromRealWorld(runtime);
        });

        // 3. 立即主动同步一次初始状态
        this.syncFromRealWorld(runtime);
    }

    disconnect() {
        this.runtimeSub?.();
        this.runtimeSub = null;
        this.debugEngine = null;
        this.emitter.clear();
    }

    /**
     * 🌟 Pull 模型核心：主动拉取真实世界的数据，重建案发现场
     */
    private syncFromRealWorld(runtime: FlowRuntime) {
        if (!this.debugEngine) return;

        // A. 拉取真实 Trace (用于时间轴显示)
        const traceHistory = runtime.getTraceStream().all();
        this.store.clear();
        traceHistory.forEach(e => this.store.push(e));

        // B. 拉取真实 Signal，喂给影子引擎
        const realSignals = runtime.getSignals();
        (this.debugEngine as any).replay(realSignals);

        // 🌟🌟🌟 核心补丁：时钟同步 🌟🌟🌟
        // 信号重放完毕后，必须强行把影子引擎的时间推到“现实的这一刻”。
        // 否则影子引擎的时间永远停留在最后一个 click 信号处，永远无法触发 timer(3000)！
        this.debugEngine.tick(Date.now());

        // C. 通知 UI 渲染壳子来拉取更新
        this.emitter.emit();
    }

    // ------------------------------------------------
    // 🔍 供外部 UI (Vue/React) Pull 拉取的接口
    // ------------------------------------------------

    getEvents() {
        return this.store.getAll();
    }

    getActiveDiagnostics() {
        if (!this.debugEngine) return [];

        // 🌟 全部从影子引擎中提取，100% 安全！真实引擎的执行毫无波澜！
        const activeIds = this.debugEngine.getActiveSteps();

        return activeIds.map((stepId: string) => ({
            stepId,
            tree: this.debugEngine!.explain(stepId)
        })).filter((diag: any) => diag.tree !== null);
    }

    isRewinding(runtime: FlowRuntime): boolean {
        // 直接看真实引擎的历史，判断当前是否处于回溯状态
        const trace = runtime.getTraceStream().all();
        return trace.length > 0 && trace[trace.length - 1].type === 'REVERT';
    }

    /**
     * 时空穿梭按钮：这个动作是唯一需要“打破次元壁”，去影响真实世界的操作
     */
    rewindTime(runtime: FlowRuntime, targetTs: number) {
        // 回拨真实世界的时间，触发真实 runtime 的 stateEmitter 广播
        // 然后 DevTools 监听到广播后，又会自动执行 syncFromRealWorld
        runtime.revertToTime(targetTs);
    }
}
