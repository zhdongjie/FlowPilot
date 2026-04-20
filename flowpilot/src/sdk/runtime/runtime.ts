// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type { Step, Signal } from "../types";

export interface RuntimeOptions {
    steps: Step[];
    rootStepId: string;
    // 调度器心跳频率 (毫秒)
    tickInterval?: number;
}

/**
 * FlowRuntime (V2)
 * 核心职责：作为唯一对外的高级 API 入口，接管真实时间驱动，激活 Temporal 时间轴
 */
export class FlowRuntime {
    private readonly engine: FlowEngine;
    private readonly options: RuntimeOptions;

    private ticker: any = null;

    constructor(options: RuntimeOptions) {
        this.options = options;

        // 1. 初始化 V2 纯净内核（内部自带了 Trace 和预编译闭包）
        this.engine = new FlowEngine(options.steps, options.rootStepId);
    }

    // -------------------------
    // ⏰ 时间调度器 (Scheduler)
    // -------------------------

    /**
     * 启动工作流：让时间流逝真正介入状态机
     */
    start() {
        if (this.ticker) return;

        const interval = this.options.tickInterval || 1000; // 默认 1 秒滴答一次

        // 赋予绝对起跑时间
        this.engine.tick(Date.now());

        // 启动心跳，自动触发 cancelWhen 等超时校验
        this.ticker = setInterval(() => {
            this.engine.tick(Date.now());
        }, interval);

        console.log(`[FlowRuntime] Started with tick interval ${interval}ms`);
    }

    /**
     * 暂停调度
     */
    stop() {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = null;
            console.log("[FlowRuntime] Stopped");
        }
    }

    // -------------------------
    // 🚀 核心交互 API
    // -------------------------

    /**
     * 发送业务信号（UI 层只需要传 id 和 key，时间戳由 Runtime 自动打上绝对时间）
     */
    dispatch(signal: Omit<Signal, 'timestamp'>) {
        this.engine.ingest({
            ...signal,
            timestamp: Date.now() // 强制统一现实时间
        });
    }

    /**
     * 时空回溯：回滚到目标步骤完成那一刻
     */
    revert(stepId: string) {
        this.engine.revert(stepId);
    }

    // -------------------------
    // 📊 状态读取与诊断
    // -------------------------

    get activeSteps() {
        return this.engine.getActiveSteps();
    }

    get completedSteps() {
        return this.engine.getCompletedSteps();
    }

    /**
     * 获取完整引擎快照与 V2 底层 Trace 日志
     */
    debug() {
        return this.engine.inspect();
    }

    /**
     * 对外暴露引擎实例（高级用法）
     */
    getEngine() {
        return this.engine;
    }
}
