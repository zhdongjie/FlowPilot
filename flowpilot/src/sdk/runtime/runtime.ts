// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type { FlowConfig, Signal, Step } from "../types";
import { EventEmitter } from "../utils/emitter";

export class FlowRuntime {
    public engine: FlowEngine;

    private timer: any = null;
    private readonly config: FlowConfig;

    // 🌟 状态广播器（唯一数据出口）
    private readonly stateEmitter = new EventEmitter<void>();

    constructor(options: {
        steps: Step[],
        rootStepId: string,
        config: FlowConfig
    }) {
        this.engine = new FlowEngine(options.steps, options.rootStepId);
        this.config = options.config;

        // 🌟 引擎状态变化 → Runtime 广播
        this.engine.onStateChange ??= () => {
            this.stateEmitter.emit();
        };
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

                    if (this.config.debug) {
                        console.log(
                            `[FlowPilot] 💾 恢复进度: ${completedIds.join(", ")}`
                        );
                    }
                } catch {
                    localStorage.removeItem(persistence.key);
                }
            }
        }

        this.engine.tick(Date.now());
        this.scheduleNext();

        // 🌟 首次广播
        this.stateEmitter.emit();
    }

    public stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;

        this.engine.stop();
    }

    // =========================
    // 📡 信号入口（唯一入口）
    // =========================

    public dispatch(signal: Signal) {
        this.engine.ingest(signal);

        this.scheduleNext();
        this.saveProgress();

        // 🌟 强制广播（保证 timeline 更新）
        this.stateEmitter.emit();
    }

    // =========================
    // ⏪ 回溯能力（核心）
    // =========================

    public revert(stepId: string) {
        this.engine.revert(stepId);

        this.scheduleNext();
        this.stateEmitter.emit();
    }

    public revertToTime(targetTs: number) {
        this.engine.revertToTime(targetTs);

        this.scheduleNext();
        this.stateEmitter.emit();
    }

    /**
     * 🌟 推荐给业务层使用（抽象更高）
     */
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

    /**
     * 🌟 业务 API：清缓存（不再让业务碰 localStorage）
     */
    public clearCache() {
        const { persistence } = this.config.runtime;

        if (!persistence.enabled) return;

        const key = persistence.key;

        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_finished`);
    }

    /**
     * 🌟 可选增强：清缓存 + 重启（推荐你加）
     */
    public reset() {
        // 1. 清缓存
        this.clearCache();

        // 2. 停止当前调度器
        this.stop();

        // 3. 🌟 关键：重建 engine（彻底干净）
        const { steps, rootStepId } = this.engine.getConfigSnap();

        this.engine.stop(); // 确保心跳关掉

        // ⚠️ 直接 new 一个全新的 engine（最干净）
        this.engine = new FlowEngine(steps, rootStepId);

        // 重新绑定事件
        this.engine.onStateChange = () => {
            this.stateEmitter.emit();
        };

        // 4. 重新启动
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
