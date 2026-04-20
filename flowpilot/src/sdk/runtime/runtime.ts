// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type { Step, Signal, FlowConfig } from "../types";

export class FlowRuntime {
    private readonly engine: FlowEngine;
    private timer: any = null;
    private readonly config: FlowConfig;

    constructor(options: { steps: Step[], rootStepId: string, config: FlowConfig }) {
        this.engine = new FlowEngine(options.steps, options.rootStepId);
        this.config = options.config;
    }

    // -------------------------
    // ⏰ 精准调度器逻辑
    // -------------------------

    private scheduleNext() {
        if (this.timer) clearTimeout(this.timer);

        const next = this.engine.peekNextTimer();
        if (!next) return;

        // 计算距离触发还有多久
        const delay = Math.max(0, next.ts - Date.now());

        this.timer = setTimeout(() => {
            this.runDueTasks();
        }, delay);
    }

    private runDueTasks() {
        const now = Date.now();

        while (true) {
            const next = this.engine.peekNextTimer();
            // 如果堆顶的任务还没到时间，或者堆空了，退出
            if (!next || next.ts > now) break;

            this.engine.popNextTimer();

            // 防御检查：只有活跃步骤的 Timer 才触发
            if (this.engine.getActiveSteps().includes(next.stepId)) {
                this.engine.tick(next.ts);
            }
        }

        // 递归调度下一个最近的任务
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
                    // 这里存的不再是信号流，而是简单的 ID 数组：["step_1", "step_2"]
                    const completedIds: string[] = JSON.parse(saved);

                    // 关键：强制让引擎标记这些步骤为已完成
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

        // 2. 常规启动
        this.engine.tick(Date.now());
        this.scheduleNext();
    }

    stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    dispatch(signal: Signal) {
        this.engine.ingest(signal);
        this.scheduleNext();
        this.saveProgress();
    }

    revert(stepId: string) {
        this.engine.revert(stepId);
        // 回溯后时间轴变了，重新排期
        this.scheduleNext();
    }

    get activeSteps(): string[] {
        return this.engine.getActiveSteps();
    }

    /**
     * 获取已完成的步骤 ID 列表
     */
    get completedSteps(): string[] {
        return this.engine.getCompletedSteps();
    }

    /**
     * 提供给外部的调试快照
     */
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

}
