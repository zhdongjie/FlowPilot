// src/sdk/runtime/runtime.ts

import { FlowEngine } from "../core/engine";
import type { Step, Signal, FlowConfig } from "../types";

export class FlowRuntime {
    // 公开 engine 以便 DevTools 内部深度获取数据，或者你也可以保持 private 提供 getter
    public readonly engine: FlowEngine;
    private timer: any = null;
    private readonly config: FlowConfig;

    // 🌟 新增：订阅者集合，用于通知 Vue/React 等外部 UI 刷新
    private readonly subscribers: Set<Function> = new Set();

    constructor(options: { steps: Step[], rootStepId: string, config: FlowConfig }) {
        this.engine = new FlowEngine(options.steps, options.rootStepId);
        this.config = options.config;
        this.engine.onStateChange ??= () => {
            this.notifySubscribers();
        };
    }

    // -------------------------
    // 📢 状态广播与订阅机制 (大喇叭)
    // -------------------------

    /**
     * 提供给外部（如 App.vue 或 DevTools）订阅状态变化的接口
     * @returns 取消订阅的函数
     */
    public subscribe(callback: Function): () => void {
        this.subscribers.add(callback);
        // 立即触发一次，保证订阅者拿到初始状态
        callback();

        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * 内部方法：通知所有监听者
     */
    private notifySubscribers() {
        this.subscribers.forEach(cb => cb());
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

        // 常规启动
        this.engine.tick(Date.now());
        this.scheduleNext();

        // 🌟 启动后通知 UI 刷新
        this.notifySubscribers();
    }

    stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        // 如果引擎支持 stop，最好也调一下 this.engine.stop()
    }

    dispatch(signal: Signal) {
        this.engine.ingest(signal);
        this.scheduleNext();
        this.saveProgress();

        // 🌟 信号打入后，即便没有触发步骤切关，时间轴也多了条数据，必须通知 UI 更新！
        this.notifySubscribers();
    }

    revert(stepId: string) {
        this.engine.revert(stepId);
        this.scheduleNext();
        this.notifySubscribers(); // 🌟 通知更新
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

    /** 👉 获取引擎的实时事件流 */
    public getTraceStream() {
        return this.engine.getTraceStore();
    }

    /** 👉 提供给 DevTools 的上帝模式：绝对时间轴回放 */
    public revertToTime(targetTs: number) {
        this.engine.revertToTime(targetTs);
        this.scheduleNext(); // 回放后时间轴变了，重新排期定时器
        this.notifySubscribers(); // 🌟 通知更新
    }
}
