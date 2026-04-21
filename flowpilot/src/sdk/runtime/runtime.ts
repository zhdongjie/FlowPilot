// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type { FlowConfig, Signal, Step } from "../types";
import { EventEmitter } from "../utils/emitter";

export class FlowRuntime {
    public readonly engine: FlowEngine;
    private timer: any = null;
    private readonly config: FlowConfig;

    // 🌟 纯正的事件分发器 (替代了旧的 Set<Function>)
    private readonly stateEmitter = new EventEmitter<void>();

    constructor(options: { steps: Step[], rootStepId: string, config: FlowConfig }) {
        this.engine = new FlowEngine(options.steps, options.rootStepId);
        this.config = options.config;

        // 引擎内部发生流转时，触发广播
        this.engine.onStateChange ??= () => {
            this.stateEmitter.emit();
        };
    }

    // -------------------------
    // 📢 状态广播与订阅机制
    // -------------------------

    public subscribe(callback: () => void): () => void {
        return this.stateEmitter.subscribe(callback);
    }

    // -------------------------
    // ⏰ 精准调度器逻辑
    // -------------------------

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

    // -------------------------
    // 🚀 接口对接
    // -------------------------

    start() {
        const { persistence } = this.config.runtime;
        if (persistence.enabled) {
            const saved = localStorage.getItem(persistence.key);
            if (saved) {
                try {
                    const completedIds: string[] = JSON.parse(saved);
                    completedIds.forEach(id => {
                        this.engine.forceComplete(id);
                    });

                    if (this.config.debug) {
                        console.log(`[FlowPilot] 💾 已跳过历史步骤: ${completedIds.join(', ')}`);
                    }
                } catch (e) {
                    localStorage.removeItem(persistence.key);
                }
            }
        }

        this.engine.tick(Date.now());
        this.scheduleNext();
        this.stateEmitter.emit(); // 🌟 启动后广播
    }

    stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.engine.stop();
    }

    dispatch(signal: Signal) {
        this.engine.ingest(signal);
        this.scheduleNext();
        this.saveProgress();
        this.stateEmitter.emit(); // 🌟 强行广播（保证 Timeline 记录纯信号事件）
    }

    revert(stepId: string) {
        this.engine.revert(stepId);
        this.scheduleNext();
        this.stateEmitter.emit(); // 🌟 回溯后广播
    }

    revertToTime(targetTs: number) {
        this.engine.revertToTime(targetTs);
        this.scheduleNext();
        this.stateEmitter.emit(); // 🌟 回溯后广播
    }

    get activeSteps(): string[] {
        return this.engine.getActiveSteps();
    }

    get completedSteps(): string[] {
        return this.engine.getCompletedSteps();
    }

    public debug() {
        return this.engine.inspect();
    }

    private saveProgress() {
        if (this.config.runtime.persistence.enabled) {
            localStorage.setItem(
                this.config.runtime.persistence.key,
                JSON.stringify(this.engine.getCompletedSteps())
            );
        }
    }

    // -------------------------
    // 🔍 提供给外部 Pull (拉取) 的只读接口
    // -------------------------
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
}
