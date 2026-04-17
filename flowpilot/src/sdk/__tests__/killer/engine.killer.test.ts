// src/sdk/__tests__/killer/temporal.killer.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Signal, Step } from "../../types";

// 严格的辅助函数
function sig(key: string, ts: number): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random().toString(36).substring(7)}`,
        key,
        timestamp: ts
    };
}

describe("FlowEngine Killer Tests (Phase 1+3: Temporal & Safety)", () => {

    /**
     * 🔪 严格测试 1：绝对确定性防线 (Strict Determinism)
     * 验证：没有明确时间戳的脏信号，绝对不允许进入引擎！
     */
    it("Strictness: should CRASH if signal lacks a timestamp", () => {
        const engine = new FlowEngine([{ id: "A", when: { type: "event", key: "a" } }], "A");

        const dirtySignal = { id: "dirty_1", key: "a", type: "interaction" } as Signal;

        expect(() => {
            engine.ingest(dirtySignal);
        }).toThrow(/must have a timestamp/); // 严格断言抛错
    });

    /**
     * 🔪 严格测试 2：时间语义拦截 (Strict Local Time)
     */
    it("Temporal: should IGNORE premature signals that occurred before step activation", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" } }
        ];
        const engine = new FlowEngine(steps, "A");

        engine.ingest(sig("b", 100)); // 早产信号
        engine.ingest(sig("a", 200));

        expect(engine.getCompletedSteps()).toContain("A");
        expect(engine.getActiveSteps()).toContain("B"); // B 激活，且没有被早产的 b 触发

        engine.ingest(sig("b", 300)); // 合法信号
        expect(engine.getCompletedSteps()).toContain("B");
    });

    /**
     * 🔪 严格测试 3：精确的时间切片回溯 (Strict Time-Slice Revert)
     * 验证：revert("2") 必须回到步骤 2 完成的 200ms 瞬间！
     */
    it("Revert: should strictly slice time back to the COMPLETION moment of the target step", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
            { id: "2", when: { type: "event", key: "b" }, next: ["3"] },
            { id: "3", when: { type: "event", key: "c" } }
        ];
        const engine = new FlowEngine(steps, "1");

        // 严格时间线
        engine.ingest(sig("a", 100)); // 1完成(100ms)，2激活(100ms)
        engine.ingest(sig("b", 200)); // 2完成(200ms)，3激活(200ms)
        engine.ingest(sig("c", 300));
        engine.ingest(sig("a", 400));
        engine.ingest(sig("b", 500));

        // 目标：回退到步骤 2 完成的节点
        engine.revert("2");

        const state = engine.inspect();

        // 【严格断言】
        // 时间停在 200ms。
        // 此时 1 和 2 都已经完成，3 刚刚登场等待操作。
        expect(state.completedSteps).toEqual(["1", "2"]);
        expect(state.activeSteps).toEqual(["3"]);

        // 未来的事件 (c, 以及乱入的 a, b) 必须被彻底斩断
        // 事实库里只剩下 100ms 的 a 和 200ms 的 b
        expect(state.eventCount).toBe(2);
        expect(state.factMap["a"]).toBe(1);
        expect(state.factMap["b"]).toBe(1);
        expect(state.factMap["c"]).toBeUndefined();
    });
});
