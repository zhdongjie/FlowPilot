// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type { Step, Signal } from "../types";

export class FlowRuntime {
    private readonly engine: FlowEngine;
    private timer: any = null;

    constructor(options: { steps: Step[], rootStepId: string }) {
        this.engine = new FlowEngine(options.steps, options.rootStepId);
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
    }

    // -------------------------
    // 🚀 接口对接
    // -------------------------

    start() {
        this.engine.tick(Date.now());
        this.scheduleNext();
    }

    stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    dispatch(signal: Signal) {
        this.engine.ingest(signal);
        // 信号可能导致新步骤激活或旧步骤完成，必须重新排期
        this.scheduleNext();
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
}
