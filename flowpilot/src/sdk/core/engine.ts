// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import type { Step, Condition, Signal } from "../types";

export class FlowEngine {
    private readonly store = new SignalStore();
    private readonly stepsMap: Map<string, Step> = new Map();

    // O(1) 的全局事实索引
    private readonly factMap = new Map<string, number>();

    // 👉 Phase 1: 记录每个步骤的激活时间，支撑 Temporal 逻辑
    private readonly activatedAt = new Map<string, number>();
    private readonly completedAt = new Map<string, number>();

    private readonly activeSteps = new Set<string>();
    private readonly completedSteps = new Set<string>();
    private readonly rootStepId: string;

    constructor(steps: Step[], rootStepId: string) {
        steps.forEach(s => this.stepsMap.set(s.id, s));
        this.rootStepId = rootStepId;

        // 👉 Phase 3: 构造期静态校验，彻底把烂配置挡在门外
        this.validateDAG();

        this.resetState();
    }

    /**
     * 静态校验：DFS 深度优先检测悬空指针与环路
     */
    private validateDAG() {
        const visited = new Set<string>();
        const stack = new Set<string>();

        const dfs = (id: string) => {
            if (stack.has(id)) {
                throw new Error(`[FlowPilot Engine] Critical: DAG Cycle detected at node '${id}'`);
            }
            if (visited.has(id)) return;

            const step = this.stepsMap.get(id);
            if (!step) {
                throw new Error(`[FlowPilot Engine] Critical: Dangling reference. Step '${id}' is referenced but not defined.`);
            }

            visited.add(id);
            stack.add(id);

            step.next?.forEach(nextId => dfs(nextId));

            stack.delete(id);
        };

        dfs(this.rootStepId);
    }

    private resetState() {
        this.activeSteps.clear();
        this.completedSteps.clear();
        this.factMap.clear();
        this.activatedAt.clear();
        this.completedAt.clear();
        if (this.rootStepId) {
            // 初始化时赋予基准时间 0，确保 Replay 的绝对确定性
            this.activateStep(this.rootStepId, 0);
        }
    }

    private activateStep(stepId: string, timestamp: number) {
        this.activeSteps.add(stepId);
        this.activatedAt.set(stepId, timestamp);
    }

    // -------------------------
    // PUBLIC & DEBUG
    // -------------------------
    inspect() {
        return {
            activeSteps: [...this.activeSteps],
            completedSteps: [...this.completedSteps],
            factMap: Object.fromEntries(this.factMap),
            activatedAt: Object.fromEntries(this.activatedAt),
            eventCount: this.store.getEvents().length
        };
    }

    getActiveSteps() { return [...this.activeSteps]; }
    getCompletedSteps() { return [...this.completedSteps]; }

    // -------------------------
    // INGEST (幂等对齐)
    // -------------------------
    ingest(signal: Signal) {
        if (signal.timestamp == null) {
            throw new Error("[FlowPilot Engine] Critical: Signal must have a timestamp to guarantee determinism.");
        }
        // 核心：若 store 拦截了重复信号，直接短路返回
        const inserted = this.store.push(signal);
        if (!inserted) return;

        this.updateFact(signal);
        // 将当前驱动引擎的信号时间戳传入，作为下一步激活的基准线
        this.evaluateLoop(signal.timestamp);
    }

    private updateFact(signal: Signal) {
        const count = this.factMap.get(signal.key) || 0;
        this.factMap.set(signal.key, count + 1);
    }

    // -------------------------
    // CORE LOOP (安全性 + 拓扑推进)
    // -------------------------
    private evaluateLoop(currentEventTs: number) {
        let changed = true;
        let guard = 0;
        const MAX_LOOP = 1000;

        while (changed) {
            if (++guard > MAX_LOOP) {
                throw new Error("[FlowPilot Engine] Critical: Infinite loop detected during evaluation.");
            }

            changed = false;
            // 核心：安全的镜像迭代，防踩雷
            const currentActives = [...this.activeSteps];

            for (const stepId of currentActives) {
                const step = this.stepsMap.get(stepId);
                if (!step) continue;

                if (this.evaluate(step.when, stepId)) {
                    this.completedSteps.add(stepId);
                    this.activeSteps.delete(stepId);

                    this.completedAt.set(stepId, currentEventTs);

                    step.next?.forEach(nextId => {
                        // 防止并发分支导致的重复激活
                        if (!this.completedSteps.has(nextId) && !this.activeSteps.has(nextId)) {
                            this.activateStep(nextId, currentEventTs);
                        }
                    });

                    changed = true;
                }
            }
        }
    }

    /**
     * 👉 Phase 1: 带有时间语义的 Condition 解析器
     */
    private evaluate(cond: Condition, currentStepId: string): boolean {
        if (!cond) return false;
        switch (cond.type) {
            case "event": {
                // 性能防线：如果全局字典里压根没发生过，直接 O(1) 短路，免去遍历
                if (!this.factMap.has(cond.key)) return false;

                // 时间语义防线：确定时间切断点（cutoff）
                const referenceStepId = cond.afterStep || currentStepId;
                const cutoff = this.activatedAt.get(referenceStepId) ?? 0;

                // O(n) Fallback 遍历：确保该事实发生在基准线之后
                return this.store.getEvents().some(
                    e => e.key === cond.key && (e.timestamp ?? 0) >= cutoff
                );
            }
            case "and":
                return cond.conditions.every(c => this.evaluate(c, currentStepId));
            case "or":
                return cond.conditions.some(c => this.evaluate(c, currentStepId));
            default:
                return false;
        }
    }

    // -------------------------
    // RECOMPUTE & REVERT (时空回溯)
    // -------------------------
    recompute() {
        const events = [...this.store.getEvents()];
        this.store.clear();
        this.replay(events);
    }

    private replay(events: Signal[]) {
        this.resetState();
        const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
        for (const e of sorted) {
            // 纯净状态下手动推进，不触发无用副作用
            this.store.push(e);
            this.updateFact(e);
            this.evaluateLoop(e.timestamp ?? 0);
        }
    }

    /**
     * 底层能力：回溯到指定的绝对时间点
     * 语义：抹除 targetTs 之后发生的所有“未来事件”
     */
    revertToTime(targetTs: number) {
        const events = [...this.store.getEvents()];

        const validEvents = events.filter(e => e.timestamp <= targetTs);

        this.store.clear();
        this.replay(validEvents);
    }

    revert(targetStepId: string) {
        const targetTs = this.completedAt.get(targetStepId);

        if (targetTs === undefined) {
            throw new Error(`[FlowPilot Engine] Cannot revert. Step '${targetStepId}' is not in the current timeline history.`);
        }

        // 2. 直接调用底层的时间切片方法进行绝对回滚
        this.revertToTime(targetTs);
    }
}
