// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import { TraceStore } from "./trace";
import { FlowReplayer } from "./replay";

import type { Step, Signal } from "../types";

export interface RuntimeOptions {
    steps: Step[];
    rootStepId: string;
    enableTrace?: boolean;
}

/**
 * Runtime = 唯一对外入口
 * 负责将复杂的 Engine 状态包装为 UI 可用的高级接口，并管理 Trace 审计日志
 */
export class FlowRuntime {
    private readonly engine: FlowEngine;
    private readonly trace?: TraceStore;
    private readonly options: RuntimeOptions;

    constructor(options: RuntimeOptions) {
        this.options = options;
        // 修复报错：传入 steps 和 rootStepId
        this.engine = new FlowEngine(options.steps, options.rootStepId);

        if (options.enableTrace) {
            this.trace = new TraceStore();
        }

        this.log({
            type: "ENGINE_INIT",
            timestamp: Date.now(),
            activeSteps: this.engine.getActiveSteps()
        });
    }

    /**
     * 注入信号并记录状态迁移轨迹
     */
    ingest(signal: Signal) {
        const before = this.engine.getActiveSteps();

        this.log({
            type: "SIGNAL_INGEST",
            timestamp: Date.now(),
            signalId: signal.id,
            key: signal.key,
            activeSteps: before
        });

        this.engine.ingest(signal);

        const after = this.engine.getActiveSteps();

        if (JSON.stringify(before) !== JSON.stringify(after)) {
            this.log({
                type: "STEP_ADVANCE",
                timestamp: Date.now(),
                from: before,
                to: after
            });
        }
    }

    /**
     * 回滚到指定步骤
     * @param stepId 目标步骤 ID
     */
    revert(stepId: string) {
        const before = this.engine.getActiveSteps();

        this.engine.revert(stepId);

        const after = this.engine.getActiveSteps();

        this.log({
            type: "REVERT",
            timestamp: Date.now(),
            targetStep: stepId,
            from: before,
            to: after
        });
    }

    /**
     * 确定性重放
     */
    replay(signals: Signal[]) {
        // 修复报错：传入必须的 rootStepId
        return FlowReplayer.replay(this.options.steps, signals, this.options.rootStepId);
    }

    // -------------------------
    // 状态获取
    // -------------------------

    get activeSteps() {
        return this.engine.getActiveSteps();
    }

    get completedSteps() {
        return this.engine.getCompletedSteps();
    }

    /**
     * 提供给 Debug 面板的完整快照
     */
    debug() {
        return {
            ...this.engine.inspect(),
            trace: this.trace?.all() ?? []
        };
    }

    private log(event: any) {
        this.trace?.record(event);
    }
}
