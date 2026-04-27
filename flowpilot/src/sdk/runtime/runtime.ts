// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type {FlowConfig, FlowPlugin, Signal, Step} from "../types";
import { EventEmitter } from "../utils/emitter";
import { PluginManager } from "./plugin-manager";

export class FlowRuntime {
    public engine: FlowEngine;

    private timer: any = null;
    private readonly config: FlowConfig;

    // 🌟 状态广播器（唯一数据出口）
    private readonly stateEmitter = new EventEmitter<void>();

    private readonly pluginManager = new PluginManager();
    private hasReportedFlowFinish = false;

    constructor(options: { steps: Step[], rootStepId: string, config: FlowConfig, plugins?: FlowPlugin[] }) {
        this.engine = new FlowEngine(options.steps, options.rootStepId, { mode: "runtime"});
        this.config = options.config;

        // 1.初始化插件上下文
        this.initPluginContext();

        // 2.注册插件
        if (options.plugins?.length) {
            this.pluginManager.register(options.plugins);
        }

        // 3.初始化插件
        this.pluginManager.setup(this.pluginManager["ctx"]);

        // 4.监听引擎状态变化
        this.bindEngineStateChange();
    }

    /**
     * 提取上下文初始化逻辑，方便 reset 时重建
     */
    private initPluginContext() {
        this.pluginManager.setup({
            runtime: this,
            engine: this.engine,
            config: this.config,

            // 暴露信号发射权
            dispatch: (signal) => this.dispatch(signal),

            // 状态快照
            getState: () => ({
                activeSteps: this.engine.getActiveSteps(),
                completedSteps: this.engine.getCompletedSteps(),
                isFinished: this.isFlowFinished()
            }),
            now: () => Date.now(),

            // 注入跨插件通信能力，代理到 pluginManager 的 EventBus 上
            emit: (event, payload) => this.pluginManager.emitEvent(event, payload),
            on: (event, cb) => this.pluginManager.onEvent(event, cb)
        });
    }

    private isFlowFinished() {
        return this.engine.getActiveSteps().length === 0 &&
            this.engine.getPendingSteps().length === 0 &&
            this.engine.getCompletedSteps().length > 0;
    }

    private bindEngineStateChange() {
        this.engine.onStateChange = () => {
            this.handleEngineStateChange();
        };
    }

    private handleEngineStateChange() {
        this.syncFlowCompletionState();
        this.stateEmitter.emit();
        this.pluginManager.emitHook("onRender");
    }

    private syncFlowCompletionState() {
        const { persistence } = this.config.runtime;
        const isFinished = this.isFlowFinished();

        if (!isFinished) {
            this.hasReportedFlowFinish = false;

            if (persistence.enabled) {
                localStorage.removeItem(`${persistence.key}_finished`);
            }
            return;
        }

        if (persistence.enabled) {
            localStorage.setItem(`${persistence.key}_finished`, "true");
        }

        if (!this.hasReportedFlowFinish) {
            this.hasReportedFlowFinish = true;
            this.pluginManager.emitHook("onFlowComplete");
        }
    }

    // =========================
    // 📢 订阅机制（唯一 UI 入口）
    // =========================

    public subscribe(callback: () => void): () => void {
        return this.stateEmitter.subscribe(callback);
    }

    // =========================
    // ⏰ 调度器
    // =========================

    private scheduleNext() {
        if (this.timer) clearTimeout(this.timer);

        const next = this.engine.peekNextTimer();
        if (!next) return;

        const delay = Math.max(0, next.ts - Date.now());

        this.timer = setTimeout(() => {
            this.runDueTasks();
        }, delay);
    }

    private runDueTasks() {
        const now = Date.now();

        while (true) {
            const next = this.engine.peekNextTimer();
            if (!next || next.ts > now) break;

            this.engine.popNextTimer();

            if (this.engine.getActiveSteps().includes(next.stepId)) {
                this.engine.tick(next.ts);
            }
        }

        this.scheduleNext();
        this.saveProgress();
    }

    // =========================
    // 🚀 生命周期
    // =========================

    public start() {
        const { persistence } = this.config.runtime;

        // 🌟 恢复历史进度
        if (persistence.enabled) {
            const saved = localStorage.getItem(persistence.key);

            if (saved) {
                try {
                    const completedIds: string[] = JSON.parse(saved);

                    completedIds.forEach(id => {
                        this.engine.forceComplete(id);
                    });

                } catch {
                    localStorage.removeItem(persistence.key);
                }
            }
        }

        this.engine.tick(Date.now());
        this.scheduleNext();
        this.syncFlowCompletionState();

        // 🌟 首次广播
        this.stateEmitter.emit();

        this.pluginManager.emitHook("onStart");
    }

    public stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;

        this.engine.stop();

        this.pluginManager.emitHook("onStop");
    }

    // =========================
    // 📡 信号入口（唯一入口）
    // =========================

    public dispatch(signal: Signal) {
        // 通过插件链过滤信号
        const shouldPass = this.pluginManager.emitSignal(signal);

        // 🛡如果有任何一个插件明确返回 false，直接熔断，丢弃该信号！
        if (!shouldPass) {
            return;
        }

        // 放行，进入核心引擎
        this.engine.ingest(signal);

        this.scheduleNext();
        this.saveProgress();

        // 🌟 强制广播（保证 timeline 更新）
        // this.stateEmitter.emit();
    }

    // =========================
    // ⏪ 回溯能力（核心）
    // =========================

    public revert(stepId: string) {
        this.engine.revert(stepId);

        this.scheduleNext();
        this.saveProgress();
        this.syncFlowCompletionState();
        this.stateEmitter.emit();
        this.pluginManager.emitHook("onRender");
    }

    public revertToTime(targetTs: number) {
        this.engine.revertToTime(targetTs);

        this.scheduleNext();

        this.saveProgress();
        this.syncFlowCompletionState();

        this.stateEmitter.emit();

        this.pluginManager.emitHook("onRender");
    }

    public revertToStep(stepId: string) {
        const traceLogs = this.engine.getTraceStore().all();

        const activateEvent = traceLogs.find(
            (e: any) =>
                e.type === "STEP_ACTIVATE" &&
                e.stepId === stepId
        );

        if (activateEvent) {
            this.revertToTime(activateEvent.timestamp);
        } else {
            console.warn(
                `[FlowPilot] 未找到步骤 '${stepId}'，回退至起点`
            );
            this.revertToTime(0);
        }
    }

    // =========================
    // 💾 持久化
    // =========================

    private saveProgress() {
        const { persistence } = this.config.runtime;

        if (!persistence.enabled) return;

        localStorage.setItem(
            persistence.key,
            JSON.stringify(this.engine.getCompletedSteps())
        );
    }

    public clearCache() {
        const { persistence } = this.config.runtime;
        this.hasReportedFlowFinish = false;

        if (!persistence.enabled) return;

        const key = persistence.key;

        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_finished`);
    }

    public reset() {
        this.clearCache();
        this.stop();

        const { steps, rootStepId } = this.engine.getConfigSnap();
        this.engine.stop();

        this.engine = new FlowEngine(steps, rootStepId, { mode: "runtime" });
        this.bindEngineStateChange();

        this.initPluginContext();

        this.start();
    }

    // =========================
    // 🔍 只读数据接口（DevTools 用）
    // =========================

    public getTraceStream() {
        return this.engine.getTraceStore();
    }

    public getSignals() {
        return this.engine.getSignals();
    }

    public getEngineConfig() {
        return this.engine.getConfigSnap();
    }

    public getConfig() {
        return this.config;
    }

    // =========================
    // 📊 状态快照
    // =========================

    get activeSteps(): string[] {
        return this.engine.getActiveSteps();
    }

    get completedSteps(): string[] {
        return this.engine.getCompletedSteps();
    }

    public debug() {
        return this.engine.inspect();
    }
}
