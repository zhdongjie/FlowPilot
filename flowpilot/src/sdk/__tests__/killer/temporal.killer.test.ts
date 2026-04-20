// src/sdk/__tests__/killer/temporal.killer.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FlowEngine } from "../../core/engine";
import { FlowRuntime } from "../../runtime/runtime";
import type { Signal, Step } from "../../types";

/**
 * 辅助函数：生成带时间戳的信号
 */
function sig(key: string, ts: number): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random().toString(36).substring(7)}`,
        key,
        timestamp: ts
    };
}

// =================================================================
// 第一部分：FlowEngine 核心时序与安全性测试 (Phase 1 + 3)
// =================================================================
describe("FlowEngine Killer Tests (Temporal & Safety)", () => {

    /**
     * 验证：发生在步骤激活之前的“早产信号”必须被忽略。
     */
    it("Temporal: should IGNORE premature signals that occurred before step activation", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" } }
        ];
        const engine = new FlowEngine(steps, "A");

        engine.ingest(sig("b", 100)); // 提前发生的 b
        engine.ingest(sig("a", 200)); // 激活 B 的 a

        expect(engine.getCompletedSteps()).toContain("A");
        expect(engine.getCompletedSteps()).not.toContain("B"); // B 应该忽略 ts=100 的信号
        expect(engine.getActiveSteps()).toContain("B");
    });

    /**
     * 验证：通过 afterStep 可以回溯更早的时间线。
     */
    it("Temporal: should ACCEPT historical signals if explicitly defined in afterStep", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" }, next: ["C"] },
            { id: "C", when: { type: "event", key: "x", afterStep: "A" } }
        ];
        const engine = new FlowEngine(steps, "A");

        engine.ingest(sig("a", 100));
        engine.ingest(sig("x", 150)); // 在 C 激活前发生的信号
        engine.ingest(sig("b", 200));

        // 因为 C 声明了 afterStep="A" (ts=0)，所以 ts=150 有效
        expect(engine.getCompletedSteps()).toContain("C");
    });

    /**
     * 验证：静态拓扑防火墙（环路与悬空指针）。
     */
    it("Safety: should CRASH instantly upon initialization if DAG is invalid", () => {
        const cyclicSteps: Step[] = [
            { id: "A", when: "a", next: ["B"] },
            { id: "B", when: "b", next: ["A"] }
        ];
        expect(() => new FlowEngine(cyclicSteps, "A")).toThrow(/Cycle detected/);
    });

    /**
     * 验证：二分查找索引在大规模数据下的性能。
     */
    it("Performance: should handle 10k events instantly via Binary Search Index", () => {
        const steps: Step[] = [
            { id: "A", when: "start", next: ["B"] },
            { id: "B", when: "target" }
        ];
        const engine = new FlowEngine(steps, "A");
        engine.ingest(sig("start", 1));

        for (let i = 2; i <= 10000; i++) {
            engine.ingest(sig(`noise_${i}`, i));
        }

        engine.ingest(sig("target", 10001));
        expect(engine.getCompletedSteps()).toContain("B");
    });
});

// =================================================================
// 第二部分：FlowRuntime 精准调度器测试 (Phase 4)
// =================================================================
describe("FlowRuntime Scheduler Killer Tests", () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * 验证：即便没有任何信号输入，超时逻辑也应自动触发。
     */
    it("Scheduler: should automatically cancel step after 2000ms of silence", () => {
        const steps: Step[] = [
            { id: "A", when: "start", next: ["B"] },
            { id: "B", when: "pay", cancelWhen: "!pay within(2000)" }
        ];

        const runtime = new FlowRuntime({ steps, rootStepId: "A" });
        runtime.start();

        // t=1000 触发开始
        const startTime = 1000;
        vi.setSystemTime(startTime);

        runtime.dispatch({ id: "s1", key: "start", timestamp: startTime });
        expect(runtime.activeSteps).toContain("B");

        // 快进到 3100ms (1000 + 2000 + 100)
        vi.advanceTimersByTime(2100);

        expect(runtime.activeSteps).not.toContain("B");
        const snapshot = runtime.debug();
        const lastTrace = snapshot.trace[snapshot.trace.length - 1];
        expect(lastTrace.meta).toBeDefined();
        expect(lastTrace.meta!.reason).toBe("CANCELLED_BY_CONDITION");
    });

    /**
     * 验证：回溯 (Revert) 后，计时器是否能重新正确排期。
     */
    it("Scheduler: should reconstruct timers correctly after Revert", () => {
        const steps: Step[] = [
            { id: "A", when: "start", next: ["B"] },
            { id: "B", when: "pay", cancelWhen: "!pay within(5000)" }
        ];

        const runtime = new FlowRuntime({ steps, rootStepId: "A" });
        runtime.start();

        runtime.dispatch({ id: "s1", key: "start", timestamp: 1000 });

        // 5秒后 B 自动取消
        vi.advanceTimersByTime(6000);
        expect(runtime.activeSteps).not.toContain("B");

        // ⚡ 回溯到 A 完成时
        runtime.revert("A");
        expect(runtime.activeSteps).toContain("B");

        // 再次等待 5 秒，B 应该再次被自动取消
        vi.advanceTimersByTime(6000);
        expect(runtime.activeSteps).not.toContain("B");
    });
});
