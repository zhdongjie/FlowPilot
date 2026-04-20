// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import { TraceStore } from "../runtime/trace";
import type { Condition, DiagnosticNode, EvalContext, EventCondition, SequenceCondition, Signal, Step } from "../types";
import { FlowParser } from "../compiler/parser";
import { ConditionCompiler } from "../compiler/condition";

export interface IndexedEvent {
    ts: number;
    id: string;
}

export class FlowEngine {
    private readonly store = new SignalStore();
    private readonly trace = new TraceStore();
    private readonly stepsMap: Map<string, Step> = new Map();

    // O(1) 的全局事实索引
    private readonly factMap = new Map<string, number>();

    // 👉 Phase 1: 记录每个步骤的激活时间，支撑 Temporal 逻辑
    private readonly activatedAt = new Map<string, number>();
    private readonly completedAt = new Map<string, number>();

    private readonly eventIndex = new Map<string, IndexedEvent[]>();

    private readonly pendingSteps = new Set<string>();   // 等待 enterWhen 满足
    private readonly activeSteps = new Set<string>();    // 活跃中，等待 when 满足
    private readonly completedSteps = new Set<string>(); // 成功完成
    private readonly cancelledSteps = new Set<string>(); // 被 cancelWhen 终止

    private readonly rootStepId: string;

    private readonly evalCtx: EvalContext;

    constructor(steps: Step[], rootStepId: string) {
        steps.forEach(rawStep => {
            // 1. 解析阶段：DSL 字符串 -> AST
            const step = this.preprocessStep(rawStep);

            // 2. 编译阶段：AST -> O(1) 闭包函数
            step.compiledWhen = ConditionCompiler.compile(step.when);
            if (step.enterWhen) {
                step.compiledEnterWhen = ConditionCompiler.compile(step.enterWhen);
            }
            if (step.cancelWhen) {
                step.compiledCancelWhen = ConditionCompiler.compile(step.cancelWhen);
            }

            this.stepsMap.set(step.id, step);
        });
        this.rootStepId = rootStepId;

        // 👉 Phase 3: 构造期静态校验，彻底把烂配置挡在门外
        this.validateDAG();

        this.trace.record({
            type: "ENGINE_INIT",
            timestamp: 0,
            meta: {stepsCount: steps.length, rootStepId}
        });

        this.evalCtx = {
            factMap: this.factMap,
            eventIndex: this.eventIndex,
            activatedAt: this.activatedAt,
            completedSteps: this.completedSteps,
            currentStepId: "",
            currentEventTs: 0,
            lowerBound: this.lowerBound.bind(this)
        };

        this.resetState();
    }

    /**
     * 将用户写的 DSL 字符串转换为标准 AST
     */
    private preprocessStep(step: any): Step {
        const processed = {...step};
        if (typeof processed.when === 'string') {
            processed.when = FlowParser.parse(processed.when);
        }
        if (typeof processed.enterWhen === 'string') {
            processed.enterWhen = FlowParser.parse(processed.enterWhen);
        }
        if (typeof processed.cancelWhen === 'string') {
            processed.cancelWhen = FlowParser.parse(processed.cancelWhen);
        }
        return processed as Step;
    }

    /**
     * 每次判定时，动态生成传递给闭包的只读上下文
     */
    private buildContext(stepId: string, currentEventTs: number): EvalContext {
        this.evalCtx.currentStepId = stepId;
        this.evalCtx.currentEventTs = currentEventTs;
        return this.evalCtx;
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
        this.pendingSteps.clear();
        this.activeSteps.clear();
        this.completedSteps.clear();
        this.cancelledSteps.clear();
        this.factMap.clear();
        this.activatedAt.clear();
        this.completedAt.clear();
        this.eventIndex.clear();

        if (this.rootStepId) {
            // 1. 起点节点先进入 pending 状态
            this.pendingSteps.add(this.rootStepId);

            // 2. 赋予基准时间 0，强制引擎做一次空转 (脉冲)
            // 这样，只要 root 节点没有 enterWhen 拦截，它就会瞬间从 pending 跃迁到 active
            this.evaluateLoop(0);
        }
    }

    private activateStep(stepId: string, timestamp: number) {
        this.activeSteps.add(stepId);
        this.activatedAt.set(stepId, timestamp);

        this.trace.record({
            type: "STEP_ACTIVATE",
            timestamp,
            stepId,
            activeSteps: [...this.activeSteps]
        });
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
            eventCount: this.store.getEvents().length,
            trace: this.trace.all()
        };
    }

    getTrace() {
        return this.trace;
    }

    getActiveSteps() {
        return [...this.activeSteps];
    }

    getCompletedSteps() {
        return [...this.completedSteps];
    }

    // -------------------------
    // INGEST (幂等对齐)
    // -------------------------
    ingest(signal: Signal) {
        if (signal.timestamp == null) {
            throw new Error("[FlowPilot Engine] Critical: Signal must have a timestamp to guarantee determinism.");
        }

        this.trace.record({
            type: "SIGNAL_INGEST",
            timestamp: signal.timestamp,
            signalId: signal.id,
            key: signal.key,
            activeSteps: [...this.activeSteps]
        });

        // 核心：若 store 拦截了重复信号，直接短路返回
        const inserted = this.store.push(signal);
        if (!inserted) return;

        this.updateFact(signal);
        // 将当前驱动引擎的信号时间戳传入，作为下一步激活的基准线
        this.evaluateLoop(signal.timestamp);
    }

    /**
     * 主动时间滴答：驱动引擎检查那些“没有新事件，但时间已经流逝”的条件
     * 比如: cancelWhen: !pay within(5000)
     */
    public tick(now: number = Date.now()) {
        // 赋予引擎当前最新的绝对时间，强制它进行一次全盘扫描
        this.evaluateLoop(now);
    }

    private updateFact(signal: Signal) {
        const count = this.factMap.get(signal.key) || 0;
        this.factMap.set(signal.key, count + 1);

        this.updateIndex(signal);

        this.trace.record({
            type: "FACT_APPLIED",
            timestamp: signal.timestamp,
            key: signal.key,
            signalId: signal.id
        });
    }

    private updateIndex(signal: Signal) {
        let list = this.eventIndex.get(signal.key);
        if (!list) {
            list = [];
            this.eventIndex.set(signal.key, list);
        }

        // 1. 创建符合 IndexedEvent 接口的对象
        const item: IndexedEvent = {ts: signal.timestamp, id: signal.id};

        const len = list.length;

        // 2. 修正比较逻辑：必须访问 list[len - 1].ts
        // 3. 修正存储逻辑：必须 push(item) 对象
        if (len === 0 || list[len - 1].ts <= item.ts) {
            list.push(item);
            return;
        }

        // 4. 修正插入排序逻辑：从尾部向前查找时也需要访问 .ts
        let i = len - 1;
        while (i >= 0 && list[i].ts > item.ts) {
            i--;
        }

        // 在正确的位置插入对象
        list.splice(i + 1, 0, item);
    }

    // -------------------------
    // CORE LOOP (安全性 + 拓扑推进)
    // -------------------------
    // -------------------------
    // CORE LOOP (V2 工业级重构版)
    // -------------------------
    private evaluateLoop(currentEventTs: number) {
        let changed = true;
        let guard = 0;
        const MAX_LOOP = 1000;

        while (changed) {
            if (++guard > MAX_LOOP) {
                throw new Error("[FlowPilot Engine] Critical: Infinite loop detected during evaluation.");
            }

            // 使用短路或 (||) 汇聚阶段变更
            // 注意：必须依次执行完，只要有任何一个阶段发生了变更，就继续下一轮循环
            const pendingChanged = this.processPendingSteps(currentEventTs);
            const activeChanged = this.processActiveSteps(currentEventTs);

            changed = pendingChanged || activeChanged;
        }
    }

    // 🟢 阶段 1：处理 Pending -> Active 的跃迁
    private processPendingSteps(currentEventTs: number): boolean {
        let changed = false;
        for (const stepId of [...this.pendingSteps]) {
            const step = this.stepsMap.get(stepId);
            if (!step) continue;

            const ctx = this.buildContext(stepId, currentEventTs);
            // 👉 O(1) 闭包调用！
            if (!step.compiledEnterWhen || step.compiledEnterWhen(ctx)) {
                this.pendingSteps.delete(stepId);
                this.activateStep(stepId, currentEventTs);
                changed = true;
            }
        }
        return changed;
    }

    // 🔵 阶段 2：处理 Active -> Cancelled / Completed 的跃迁
    private processActiveSteps(currentEventTs: number): boolean {
        let changed = false;
        for (const stepId of this.activeSteps) {
            const step = this.stepsMap.get(stepId);
            if (!step) continue;

            // 优先判定是否被取消
            if (this.tryCancelStep(step, stepId, currentEventTs)) {
                changed = true;
                continue;
            }

            // 判定是否完成
            if (this.tryCompleteStep(step, stepId, currentEventTs)) {
                changed = true;
            }
        }
        return changed;
    }

    // ☠️ 死亡判定
    private tryCancelStep(step: Step, stepId: string, currentEventTs: number): boolean {
        const ctx = this.buildContext(stepId, currentEventTs);
        // 👉 O(1) 闭包调用！
        if (!step.compiledCancelWhen || !step.compiledCancelWhen(ctx)) {
            return false;
        }

        this.activeSteps.delete(stepId);
        this.cancelledSteps.add(stepId);

        this.trace.record({
            type: "STEP_ADVANCE" as any,
            timestamp: currentEventTs,
            stepId,
            meta: {reason: "CANCELLED_BY_CONDITION"}
        });

        return true;
    }

    // ✅ 完成判定
    private tryCompleteStep(step: Step, stepId: string, currentEventTs: number): boolean {
        const ctx = this.buildContext(stepId, currentEventTs);
        // 👉 O(1) 闭包调用！
        if (!step.compiledWhen || !step.compiledWhen(ctx)) {
            return false;
        }

        this.trace.record({
            type: "STEP_ADVANCE",
            timestamp: currentEventTs,
            stepId,
            toStep: step.next?.join(','),
            meta: {conditionType: step.when.type}
        });

        this.completedSteps.add(stepId);
        this.activeSteps.delete(stepId);
        this.completedAt.set(stepId, currentEventTs);

        this.activateNextSteps(step.next);
        return true;
    }

    // 🚀 拓扑扩散
    private activateNextSteps(nextIds?: string[]) {
        if (!nextIds) return;

        for (const nextId of nextIds) {
            const isUntouched =
                !this.completedSteps.has(nextId) &&
                !this.activeSteps.has(nextId) &&
                !this.pendingSteps.has(nextId) &&
                !this.cancelledSteps.has(nextId);

            if (isUntouched) {
                this.pendingSteps.add(nextId);
            }
        }
    }

    // 工业级二分查找底座
    private lowerBound(list: IndexedEvent[], target: number): number {
        let l = 0;
        let r = list.length;
        while (l < r) {
            const mid = (l + r) >> 1;
            if (list[mid].ts < target) l = mid + 1;
            else r = mid;
        }
        return l;
    }

    /**
     * 对特定步骤的条件进行深度扫描，返回诊断树
     */
    public explain(stepId: string): DiagnosticNode | null {
        const step = this.stepsMap.get(stepId);
        if (!step) return null;
        return this.traceCondition(step.when, stepId);
    }

    private traceCondition(cond: Condition, stepId: string): DiagnosticNode {
        switch (cond.type) {
            case "event":
                return this.traceEvent(cond, stepId);
            case "sequence":
                return this.traceSequence(cond, stepId);

            // 👉 V2 新增：After 时间锚点诊断
            case "after": {
                const passed = this.completedSteps.has(cond.stepId);
                return {
                    type: "after",
                    passed,
                    reason: passed ? "PREVIOUS_STEP_COMPLETED" : "WAITING_FOR_STEP",
                    details: {targetStep: cond.stepId}
                };
            }

            // 👉 V2 新增：Not 逻辑非诊断
            case "not": {
                // 递归向下拿到内部条件的诊断树
                const innerTrace = this.traceCondition(cond.condition, stepId);
                // NOT 的精髓：结果反转
                const passed = !innerTrace.passed;
                return {
                    type: "not",
                    passed,
                    reason: passed ? "INNER_CONDITION_FAILED_AS_EXPECTED" : "INNER_CONDITION_MET_UNEXPECTEDLY",
                    children: [innerTrace] // 把子原因附带上，方便排查
                };
            }

            case "and": {
                const results = cond.conditions.map(c => this.traceCondition(c, stepId));
                return {
                    type: "and",
                    passed: results.every(r => r.passed),
                    reason: results.every(r => r.passed) ? "ALL_MET" : "SOME_CONDITIONS_FAILED",
                    children: results
                };
            }
            case "or": {
                const results = cond.conditions.map(c => this.traceCondition(c, stepId));
                return {
                    type: "or",
                    passed: results.some(r => r.passed),
                    reason: results.some(r => r.passed) ? "ANY_MET" : "ALL_CONDITIONS_FAILED",
                    children: results
                };
            }

            default:
                // 防御性容错，彻底消除 Vue/TS 的 "lacks ending return" 警告
                return {type: "event", passed: false, reason: "UNKNOWN_CONDITION_TYPE"};
        }
    }

    private traceEvent(cond: EventCondition, currentStepId: string): DiagnosticNode {
        const referenceStepId = cond.afterStep || currentStepId;
        const cutoff = this.activatedAt.get(referenceStepId) ?? 0;
        const list = this.eventIndex.get(cond.key) || [];
        const start = this.lowerBound(list, cutoff);
        const availableEvents = list.slice(start);

        const requiredCount = cond.count || 1;
        const hasEnoughCount = availableEvents.length >= requiredCount;

        // 检查滑动窗口
        let windowPassed = true;
        let actualElapsed = 0;
        if (hasEnoughCount && cond.within) {
            windowPassed = false;
            for (let i = 0; i <= availableEvents.length - requiredCount; i++) {
                const elapsed = availableEvents[i + requiredCount - 1].ts - availableEvents[i].ts;
                if (elapsed <= cond.within) {
                    windowPassed = true;
                    break;
                }
                actualElapsed = elapsed; // 记录最后一个尝试的间隔供参考
            }
        }

        const passed = hasEnoughCount && windowPassed;

        if (!hasEnoughCount) {
            return {
                type: "event",
                passed,
                reason: "COUNT_NOT_MET",
                details: {
                    key: cond.key,
                    current: availableEvents.length,
                    required: requiredCount,
                    elapsed: actualElapsed,
                    limit: cond.within
                }
            };
        }

        return {
            type: "event",
            passed,
            reason: windowPassed ? "CONDITION_MET" : "TIME_WINDOW_EXCEEDED",
            details: {
                key: cond.key,
                current: availableEvents.length,
                required: requiredCount,
                elapsed: actualElapsed,
                limit: cond.within
            }
        };
    }

    private traceSequence(cond: SequenceCondition, currentStepId: string): DiagnosticNode {
        const referenceStepId = cond.afterStep || currentStepId;
        const cutoff = this.activatedAt.get(referenceStepId) ?? 0;
        let currentTs = cutoff;
        let lastTs = cutoff;
        let failedAtKey: string | null = null;

        for (const key of cond.keys) {
            const list = this.eventIndex.get(key) || [];
            const idx = this.lowerBound(list, currentTs);
            if (idx >= list.length) {
                failedAtKey = key;
                break;
            }
            lastTs = list[idx].ts;
            currentTs = lastTs + 1;
        }

        const timeInWindow = cond.within ? (lastTs - cutoff <= cond.within) : true;
        const passed = !failedAtKey && timeInWindow;

        if (failedAtKey) {
            return {
                type: "sequence",
                passed,
                reason: `BROKEN_AT_${failedAtKey}`,
                details: {
                    keys: cond.keys,
                    failedAt: failedAtKey,
                    totalElapsed: lastTs - cutoff,
                    limit: cond.within
                }
            };
        }

        return {
            type: "sequence",
            passed,
            reason: timeInWindow ? "SEQUENCE_MET" : "SEQUENCE_TIMEOUT",
            details: {
                keys: cond.keys,
                failedAt: failedAtKey,
                totalElapsed: lastTs - cutoff,
                limit: cond.within
            }
        };
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
        this.trace.record({
            type: "REVERT",
            timestamp: Date.now(),
            meta: {targetTs}
        });

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
