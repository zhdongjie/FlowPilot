// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import { TraceService, TraceScope, TraceMode } from "../runtime/trace";
import type {
    Condition,
    DiagnosticNode,
    EvalContext,
    EventCondition,
    ParsedStep,
    SequenceCondition,
    Signal,
    Step
} from "../types";
import { FlowParser } from "../compiler/parser";
import { ConditionCompiler } from "../compiler/condition";
import { TimerScheduler } from "../runtime/scheduler";
import { FlowState } from "./flow-state.ts";
import { FlowExecutor } from "./flow-executor.ts";
import { StatePatch } from "./flow-executor.types.ts";

export interface IndexedEvent {
    ts: number;
    id: string;
}

export class FlowEngine {
    private readonly mode : TraceMode;
    private readonly store = new SignalStore();
    private readonly trace: TraceScope;
    private readonly stepsMap: Map<string, ParsedStep> = new Map();

    // O(1) 的全局事实索引
    private readonly factMap = new Map<string, number>();

    private readonly eventIndex = new Map<string, IndexedEvent[]>();

    public state: FlowState;

    private readonly rootStepId: string;

    private readonly scheduler = new TimerScheduler();

    private heartbeatTimer: any = null;
    public onStateChange?: () => void;
    private readonly executor: FlowExecutor;

    constructor(
        steps: Step[],
        rootStepId: string,
        options?: {
            trace?: TraceScope;
            mode?: TraceMode;
        }
    ) {
        this.mode = options?.mode ?? "runtime";
        this.trace = options?.trace ?? TraceService.createScope(this.mode);
        this.state = new FlowState();

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
            meta: {
                stepsCount: steps.length,
                rootStepId
            }
        });

        this.executor = new FlowExecutor({
            state: this.state,
            stepsMap: this.stepsMap,
            trace: this.trace,
            scheduler: this.scheduler,
            createContext: this.createContext.bind(this)
        });

        this.resetState();
        this.startHeartbeat();
    }

    /**
     * 将用户写的 DSL 字符串转换为标准 AST
     */
    private preprocessStep(step: any): ParsedStep {
        const processed = { ...step };
        if (typeof processed.when === 'string') {
            processed.when = FlowParser.parse(processed.when);
        }
        if (typeof processed.enterWhen === 'string') {
            processed.enterWhen = FlowParser.parse(processed.enterWhen);
        }
        if (typeof processed.cancelWhen === 'string') {
            processed.cancelWhen = FlowParser.parse(processed.cancelWhen);
        }
        return processed as ParsedStep;
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

    private resetState(initialTs: number = 0) {
        this.state.pendingSteps.clear();
        this.state.activeSteps.clear();
        this.state.completedSteps.clear();
        this.state.cancelledSteps.clear();
        this.state.activatedAt.clear();
        this.state.completedAt.clear();

        this.factMap.clear();
        this.eventIndex.clear();
        this.scheduler.clear();

        if (this.rootStepId) {
            // 1. 起点节点先进入 pending 状态
            this.state.pendingSteps.add(this.rootStepId);

            // 2. 赋予基准时间 0，强制引擎做一次空转 (脉冲)
            // 这样，只要 root 节点没有 enterWhen 拦截，它就会瞬间从 pending 跃迁到 active
            this.evaluateLoop(initialTs);
        }
    }

    // -------------------------
    // PUBLIC & DEBUG
    // -------------------------
    inspect() {
        return {
            activeSteps: [...this.state.activeSteps],
            pendingSteps: [...this.state.pendingSteps],
            completedSteps: [...this.state.completedSteps],
            factMap: Object.fromEntries(this.factMap),
            activatedAt: Object.fromEntries(this.state.activatedAt),
            eventCount: this.store.getEvents().length,
            trace: this.trace.raw().all()
        };
    }

    getTrace() {
        return this.trace;
    }

    getActiveSteps() {
        return [...this.state.activeSteps];
    }

    getCompletedSteps() {
        return [...this.state.completedSteps];
    }

    getPendingSteps() {
        return [...this.state.pendingSteps];
    }

    // 供 Runtime 使用的 API
    peekNextTimer() { return this.scheduler.peek(); }

    popNextTimer() { return this.scheduler.pop(); }

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
            meta: {
                key: signal.key,
                activeSteps: [...this.state.activeSteps]
            }
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
            signalId: signal.id,
            meta: {
                key: signal.key,
            }
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

    private evaluateLoop(currentEventTs: number) {
        this.startHeartbeat();

        let changed = true;
        let didStateChange = false;
        let guard = 0;             // 👉 加回防暴毙护卫
        const MAX_LOOP = 1000;     // 👉 加回防暴毙护卫

        while (changed) {
            if (++guard > MAX_LOOP) {
                throw new Error("[FlowPilot Engine] Critical: Infinite loop detected during state patch.");
            }
            changed = false;

            // =========================
            // 1. flush timers（只消费，不改 state）
            // =========================
            this.flushTimers(currentEventTs);

            // =========================
            // 2. executor 产出 patch
            // =========================
            const pendingPatch = this.executor.processPendingSteps(
                this.state,
                currentEventTs
            );

            const activePatch = this.executor.processActiveSteps(
                this.state,
                currentEventTs
            );

            // =========================
            // 3. merge patch
            // =========================
            const patch = this.mergePatch(pendingPatch, activePatch);

            // =========================
            // 4. 判断是否需要 apply
            // =========================
            if (this.hasPatchEffect(patch)) {
                this.applyPatch(patch, currentEventTs);
                changed = true;
                didStateChange = true;
            }
        }

        // =========================
        // 5. completion check
        // =========================
        if (this.isFlowCompleted()) {
            this.onStateChange?.();
            this.stop();
            return;
        }

        if (didStateChange) {
            this.onStateChange?.();
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

    private hasPatchEffect(patch: StatePatch): boolean {
        return (
            patch.pending.length > 0 ||
            patch.activate.length > 0 ||
            patch.complete.length > 0 ||
            patch.cancel.length > 0 ||
            patch.timers.length > 0 ||
            patch.traces.length > 0
        );
    }

    private isFlowCompleted(): boolean {
        return (
            this.state.activeSteps.size === 0 &&
            this.state.pendingSteps.size === 0
        );
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
                const passed = this.state.completedSteps.has(cond.stepId);
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
        const cutoff = this.state.activatedAt.get(referenceStepId) ?? 0;
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
        const cutoff = this.state.activatedAt.get(referenceStepId) ?? 0;
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
        this.trace.record({
            type: "REPLAY_START",
            timestamp: Date.now()
        });
        this.replay(events);
        this.trace.record({
            type: "REPLAY_END",
            timestamp: Date.now()
        });
    }

    private replay(events: Signal[], settleTs: number = Date.now()) {
        const originalCallback = this.onStateChange;
        this.onStateChange = undefined;
        this.resetState(0);
        const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
        for (const e of sorted) {
            // 纯净状态下手动推进，不触发无用副作用
            this.store.push(e);
            this.updateFact(e);
            this.evaluateLoop(e.timestamp ?? 0);
        }
        // 历史重放完毕：恢复广播，并强制做最后一次对齐到真实世界的时间
        this.onStateChange = originalCallback;
        this.evaluateLoop(settleTs);
    }

    /**
     * 底层能力：回溯到指定的绝对时间点
     * 语义：抹除 targetTs 之后发生的所有“未来事件”
     */
    revertToTime(targetTs: number) {
        // 1. 筛选出目标时间点之前的有效信号
        const events = [...this.store.getEvents()];
        const validEvents = events.filter(e => e.timestamp <= targetTs);

        // 2. 🌟 挥刀斩断时间线：删掉未来的日志
        this.trace.raw().truncate(targetTs);

        // 3. 🌟 刻上时光穿梭的烙印
        this.trace.record({
            type: "REVERT",
            timestamp: Date.now(),
            meta: { targetTs }
        });

        // 4. 🌟 底层状态机静默读档！(必须静音，否则 replay 会产生海量重复日志)
        this.store.clear();
        this.trace.raw().mute();   // 开启静音
        this.replay(validEvents, targetTs);
        this.trace.raw().unmute(); // 读档完毕，解除静音
    }

    revert(targetStepId: string) {
        const targetTs = this.state.completedAt.get(targetStepId);

        if (targetTs === undefined) {
            throw new Error(`[FlowPilot Engine] Cannot revert. Step '${targetStepId}' is not in the current timeline history.`);
        }

        // 2. 直接调用底层的时间切片方法进行绝对回滚
        this.revertToTime(targetTs);
    }

    public forceComplete(stepId: string) {
        // 1. 使用 O(1) 的 Map 查找，而不是数组 find
        const step = this.stepsMap.get(stepId);

        if (step) {
            // 2. 标记为已完成
            this.state.completedSteps.add(stepId);

            // 3. 清理可能残留的旧状态
            this.state.activeSteps.delete(stepId);
            this.state.pendingSteps.delete(stepId);

            // 4. 记录完成时间（恢复现场时的基准时间）
            this.state.completedAt.set(stepId, Date.now());

            // Resume from persistence should continue the flow, not collapse it.
            for (const nextId of step.next ?? []) {
                const isUntouched =
                    !this.state.completedSteps.has(nextId) &&
                    !this.state.activeSteps.has(nextId) &&
                    !this.state.pendingSteps.has(nextId) &&
                    !this.state.cancelledSteps.has(nextId);

                if (isUntouched) {
                    this.state.pendingSteps.add(nextId);
                }
            }

            this.trace.record({
                type: "STEP_COMPLETE",
                timestamp: Date.now(),
                stepId: stepId,
                meta: {
                    toStep: step.next?.join(','),
                    reason: "FORCED_BY_PERSISTENCE"
                }
            });
        } else {
            console.warn(`[FlowPilot Engine] forceComplete failed: Step '${stepId}' not found.`);
        }
    }

    public getTraceStore() {
        return this.trace.raw();
    }

    /** 👉 暴露当前引擎实例的原始配置 (供影子引擎克隆) */
    private createSerializableStepSnapshot(step: ParsedStep): Step {
        return structuredClone({
            id: step.id,
            when: step.when,
            next: step.next ? [...step.next] : undefined,
            enterWhen: step.enterWhen,
            cancelWhen: step.cancelWhen
        } satisfies Step);
    }

    public getConfigSnap() {
        return {
            // 你之前传入 constructor 的步骤
            steps: Array.from(this.stepsMap.values()).map(step =>
                this.createSerializableStepSnapshot(step)
            ),
            rootStepId: this.rootStepId
        };
    }

    /** 👉 暴露所有历史打入的原始信号 (供影子引擎重构案发现场) */
    public getSignals(): Signal[] {
        return this.store.getEvents();
    }

    // -------------------------
    // ENGINE HEARTBEAT
    // -------------------------

    private startHeartbeat() {
        if (this.heartbeatTimer) return;

        this.heartbeatTimer = setInterval(() => {
            this.evaluateLoop(Date.now());
        }, 500);
    }

    // 保持 public，允许业务层在“强行退出页面”时手动销毁
    public stop() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    hydrate(snapshot: {
        activeSteps: string[];
        completedSteps: string[];
        pendingSteps: string[];
    }) {
        this.state.activeSteps = new Set(snapshot.activeSteps);
        this.state.completedSteps = new Set(snapshot.completedSteps);
        this.state.pendingSteps = new Set(snapshot.pendingSteps);
    }

    private mergePatch(a: StatePatch, b: StatePatch): StatePatch {
        return {
            pending: [...a.pending, ...b.pending],
            activate: [...a.activate, ...b.activate],
            complete: [...a.complete, ...b.complete],
            cancel: [...a.cancel, ...b.cancel],
            timers: [...a.timers, ...b.timers],
            traces: [...a.traces, ...b.traces],
        };
    }

    private applyPatch(patch: StatePatch, currentEventTs: number) {
        for (const id of patch.pending || []) {
            this.state.pendingSteps.add(id);
        }
        // activate
        for (const id of patch.activate) {
            this.state.pendingSteps.delete(id);

            const alreadyActive =
                this.state.activeSteps.has(id) ||
                this.state.completedSteps.has(id);

            if (alreadyActive) continue;

            this.state.activeSteps.add(id);
            this.state.activatedAt.set(id, currentEventTs);
        }

        // complete
        for (const id of patch.complete) {
            this.state.completedSteps.add(id);
            this.state.activeSteps.delete(id);
            this.state.pendingSteps.delete(id);
            this.state.completedAt.set(id, currentEventTs);
        }

        // cancel
        for (const id of patch.cancel) {
            this.state.cancelledSteps.add(id);
            this.state.activeSteps.delete(id);
            this.state.pendingSteps.delete(id);
        }

        // timers
        for (const t of patch.timers) {
            this.scheduler.push(t);
        }

        // traces
        for (const tr of patch.traces) {
            this.trace.record(tr);
        }
    }

    private flushTimers(currentEventTs: number): void {
        while (true) {
            const next = this.scheduler.peek();
            if (!next || next.ts > currentEventTs) break;

            const timer = this.scheduler.pop()!;

            this.trace.record({
                type: "TIMER_FIRED",
                timestamp: currentEventTs,
                meta: timer
            });
        }
    }

    public createContext(stepId: string, ts: number): EvalContext {
        return {
            factMap: this.factMap,
            eventIndex: this.eventIndex,
            activatedAt: this.state.activatedAt,
            completedSteps: this.state.completedSteps,
            currentStepId: stepId,
            currentEventTs: ts,
            lowerBound: this.lowerBound.bind(this)
        };
    }

}
