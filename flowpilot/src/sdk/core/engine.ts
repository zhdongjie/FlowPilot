// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import type {Step, Condition, Signal, SequenceCondition, EventCondition} from "../types";

export class FlowEngine {
    private readonly store = new SignalStore();
    private readonly stepsMap: Map<string, Step> = new Map();

    // O(1) 的全局事实索引
    private readonly factMap = new Map<string, number>();

    // 👉 Phase 1: 记录每个步骤的激活时间，支撑 Temporal 逻辑
    private readonly activatedAt = new Map<string, number>();
    private readonly completedAt = new Map<string, number>();

    private readonly eventIndex = new Map<string, number[]>();

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
        this.eventIndex.clear();
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

        this.updateIndex(signal);
    }



    private updateIndex(signal: Signal) {
        let list = this.eventIndex.get(signal.key);
        if (!list) {
            list = [];
            this.eventIndex.set(signal.key, list);
        }

        const ts = signal.timestamp;

        const len = list.length;
        if (len === 0 || list[len - 1] <= ts) {
            list.push(ts);
            return;
        }

        let i = list.length - 1;
        // 从尾部往前找插入点
        while (i >= 0 && list[i] > ts) {
            i--;
        }

        list.splice(i + 1, 0, ts);
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

    // 工业级二分查找底座
    private lowerBound(list: number[], target: number): number {
        let l = 0;
        let r = list.length;
        while (l < r) {
            const mid = (l + r) >> 1;
            if (list[mid] < target) l = mid + 1;
            else r = mid;
        }
        return l;
    }

    // 增强版 Event 判断 (带滑动窗口防漏)
    private evaluateEvent(cond: EventCondition, currentStepId: string): boolean {
        if (!this.factMap.has(cond.key)) return false;

        const referenceStepId = cond.afterStep || currentStepId;
        const cutoff = this.activatedAt.get(referenceStepId) ?? 0;

        const list = this.eventIndex.get(cond.key);
        if (!list || list.length === 0) return false;

        const start = this.lowerBound(list, cutoff);
        if (start >= list.length) return false;

        const requiredCount = cond.count || 1;

        // 数量根本不够，直接短路
        if (list.length - start < requiredCount) return false;

        if (cond.within) {
            if (requiredCount === 1) {
                // 单次事件：必须在 cutoff 之后的 within 时间内发生
                return list[start] - cutoff <= cond.within;
            } else {
                // 👉 修正雷区：滑动窗口！寻找任意连续 requiredCount 个事件是否都在 within 窗口内
                for (let i = start; i <= list.length - requiredCount; i++) {
                    const firstTs = list[i];
                    const lastTs = list[i + requiredCount - 1];
                    if (lastTs - firstTs <= cond.within) {
                        return true;
                    }
                }
                return false;
            }
        }

        return true;
    }

    private evaluateSequence(cond: SequenceCondition, currentStepId: string): boolean {
        const referenceStepId = cond.afterStep || currentStepId;
        const cutoff = this.activatedAt.get(referenceStepId) ?? 0;

        let currentTs = cutoff;

        for (const key of cond.keys) {
            const list = this.eventIndex.get(key);
            if (!list) return false;

            const idx = this.lowerBound(list, currentTs);
            if (idx >= list.length) return false;

            const ts = list[idx];

            // Sequence 的 within 语义：整个序列的最后一个事件必须在 cutoff 后的 within 毫秒内完成
            if (cond.within && ts - cutoff > cond.within) {
                return false;
            }

            currentTs = ts + 1; // 保证严格递增（同一个时间戳不能被复用为两个步骤）
        }

        return true;
    }

    // 核心替换：总 evaluate 分发器
    private evaluate(cond: Condition, currentStepId: string): boolean {
        if (!cond) return false;
        switch (cond.type) {
            case "event":
                return this.evaluateEvent(cond, currentStepId);
            case "sequence":
                return this.evaluateSequence(cond, currentStepId);
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
