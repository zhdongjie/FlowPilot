// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import { Projection } from "./projection";
// 👉 适配补全后的类型桶文件
import type { Step, Condition, Signal } from "../types/index";

export class FlowEngine {
    private store = new SignalStore();

    // 将 Step 存储为 Map 以实现 O(1) 的快速 ID 检索
    private steps: Map<string, Step> = new Map();


    // 核心状态：从 currentIndex 切换为并发集合
    private activeSteps = new Set<string>();
    private completedSteps = new Set<string>();

    private rootStepId: string;

    /**
     * @param steps 步骤定义数组
     * @param rootStepId 流程的起点 ID
     */
    constructor(steps: Step[], rootStepId: string) {
        steps.forEach(s => this.steps.set(s.id, s));
        this.rootStepId = rootStepId;

        this.resetState();
    }

    private resetState() {
        this.activeSteps.clear();
        this.completedSteps.clear();

        // 按照 Spec v1.5，初始化时激活根步骤
        this.activeSteps.add(this.rootStepId);
    }

    // -------------------------
    // PUBLIC ACCESSORS
    // -------------------------

    /** 获取当前所有活跃（待完成）的步骤 ID */
    getActiveSteps(): string[] {
        return [...this.activeSteps];
    }

    /** 获取所有已完成的步骤 ID */
    getCompletedSteps(): string[] {
        return [...this.completedSteps];
    }

    getEvents(): Signal[] {
        return this.store.getEvents();
    }

    /**
     * 接收并处理新信号
     * 1. 存入具备幂等性的 SignalStore
     * 2. 触发全局评估循环
     */
    ingest(signal: Signal) {
        this.store.push(signal);
        this.evaluateLoop();
    }

    /**
     * 核心评估循环
     * 只要有步骤完成并激活了后继节点，就持续循环，直到状态不再变化。
     * 这确保了基于历史事实（Facts）的“自动跳步”逻辑。
     */
    private evaluateLoop() {
        const events = this.store.getEvents();
        let changed = true;

        while (changed) {
            changed = false;

            // 使用副本进行迭代，防止在循环中修改集合导致问题
            for (const stepId of [...this.activeSteps]) {
                const step = this.steps.get(stepId);
                if (!step) continue;

                if (this.evaluate(step.when, events)) {
                    this.completedSteps.add(stepId);
                    this.activeSteps.delete(stepId);

                    // 激活该步骤指向的所有后继 DAG 节点
                    step.next?.forEach(nextId => {
                        if (!this.completedSteps.has(nextId)) {
                            this.activeSteps.add(nextId);
                        }
                    });

                    changed = true;
                }
            }
        }
    }

    /**
     * 递归条件解析器
     * 支持 event 匹配、AND 组合、OR 组合
     */
    private evaluate(cond: Condition, events: Signal[]): boolean {
        switch (cond.type) {
            case "event":
                // 委托给 Projection 进行基础信号判定
                return Projection.hasEvent(events, cond.key);

            case "and":
                // 所有子条件必须全部满足
                return cond.conditions.every(c => this.evaluate(c, events));

            case "or":
                // 任意子条件满足即可
                return cond.conditions.some(c => this.evaluate(c, events));

            default:
                return false;
        }
    }

    /**
     * 确定性重算
     * 按照时间戳对历史进行排序并重新推演状态。
     */
    recompute() {
        // 1. 获取当前 Store 中的所有事件并创建副本
        const events = [...this.store.getEvents()];

        // 2. 彻底重置引擎状态和 Store
        this.store.clear();
        this.resetState();

        // 3. 严格按时间戳排序，确保推演结果的确定性
        const sorted = events.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        // 4. 通过 ingest 逐个注入，利用 evaluateLoop 自动推进状态
        for (const e of sorted) {
            this.ingest(e);
        }
    }

    /**
     * 回滚到指定步骤
     * 使用影子引擎（Shadow Engine）模拟推演，找到达到目标状态所需的最小事件副本。
     */
    revert(targetStepId: string) {
        const events = [...this.store.getEvents()];
        const newStoreEvents: Signal[] = [];

        const shadow = new FlowEngine(
            [...this.steps.values()],
            this.rootStepId
        );

        for (const e of events) {
            newStoreEvents.push(e);
            shadow.ingest(e);

            if (shadow.getCompletedSteps().includes(targetStepId)) {
                break;
            }
        }

        // 5. 将截断后的信号集应用到当前引擎并重算
        this.store.clear();
        newStoreEvents.forEach(e => this.store.push(e));
        this.recompute();
    }
}
