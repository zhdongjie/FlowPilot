// src/sdk/__tests__/killer/engine.killer.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Signal, Step } from "../../types";

/**
 * 辅助函数：生成符合 v1.5+ 规范的 Signal
 * @param key 信号标识
 * @param ts 时间戳（增加默认值，方便快速生成测试数据）
 */
function sig(key: string, ts: number = Date.now()): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random().toString(36).substring(7)}`,
        key,
        timestamp: ts
    };
}

describe("FlowEngine Killer Tests (v1.6.1 Production Grade)", () => {

    /**
     * 1. DAG 汇聚测试 (B + C -> D)
     * 验证：多个前置节点指向同一个节点时，AND 逻辑是否能正确拦截。
     * 这种“汇聚”是旧版线性引擎绝对做不到的。
     */
    it("Convergence: should only activate D when both B AND C are completed", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "start" }, next: ["B", "C"] },
            { id: "B", when: { type: "event", key: "b" }, next: ["D"] },
            { id: "C", when: { type: "event", key: "c" }, next: ["D"] },
            { id: "D", when: {
                    type: "and",
                    conditions: [
                        { type: "event", key: "b" },
                        { type: "event", key: "c" }
                    ]
                }}
        ];
        // 显式指定起点 A
        const engine = new FlowEngine(steps, "A");

        // 启动流程
        engine.ingest(sig("start"));

        // 注入 b，此时 B 完成。
        // D 被激活（进入 activeSteps），但因为 when 条件是 AND，它不应进入 completedSteps。
        engine.ingest(sig("b"));

        expect(engine.getCompletedSteps()).toContain("B");
        expect(engine.getActiveSteps()).toContain("C");
        expect(engine.getActiveSteps()).toContain("D");
        expect(engine.getCompletedSteps()).not.toContain("D");

        // 注入 c，此时 C 完成。
        // evaluateLoop 再次触发，发现 D 的 AND 条件终于满足了。
        engine.ingest(sig("c"));

        expect(engine.getCompletedSteps()).toContain("C");
        expect(engine.getCompletedSteps()).toContain("D");
        expect(engine.getActiveSteps()).toHaveLength(0);
    });

    /**
     * 2. 幂等性与 FactMap 计数压测
     * 验证：重复信号不会导致 Fact 计数膨胀，从而破坏逻辑判定。
     */
    it("Idempotency: should ignore 100x duplicate signals and maintain fact count", () => {
        const engine = new FlowEngine([{ id: "1", when: { type: "event", key: "a" } }], "1");

        // 构造一个固定的信号对象（ID 相同）
        const signal = sig("a");

        // 疯狂注入 100 次
        for (let i = 0; i < 100; i++) {
            engine.ingest(signal);
        }

        const report = engine.inspect();
        // 关键断言：虽然调了 100 次 ingest，但 Store 应该拦截了 99 次，FactMap 里的计数必须是 1
        expect(report.factMap["a"]).toBe(1);
        expect(report.eventCount).toBe(1);
    });

    /**
     * 3. 复杂回溯 (Time-Travel Consistency)
     * 验证：在包含“逻辑循环”的信号序列中，First-hit Revert 能否精准截断“未来的信号”。
     */
    it("Revert: should truncate signals correctly in a cyclic data flow", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
            { id: "2", when: { type: "event", key: "b" }, next: ["3"] },
            { id: "3", when: { type: "event", key: "c" } }
        ];
        const engine = new FlowEngine(steps, "1");

        // 模拟时间线：a(100) -> b(200) -> c(300) -> 乱入的 a(400) -> 乱入的 b(500)
        engine.ingest(sig("a", 100));
        engine.ingest(sig("b", 200));
        engine.ingest(sig("c", 300));
        engine.ingest(sig("a", 400));
        engine.ingest(sig("b", 500));

        // 目标：回退到步骤 2 完成的瞬间（即刚刚收到第一个 b(200) 的时刻）
        engine.revert("2");

        const state = engine.inspect();

        // 1. 状态必须回退到：1, 2 已完成，3 正在活跃
        expect(state.completedSteps).toEqual(["1", "2"]);
        expect(state.activeSteps).toEqual(["3"]);

        // 2. 事实库必须被清理：此时不应该存在事件 c，也不应该存在 400ms 和 500ms 的干扰信号
        expect(state.factMap["c"]).toBeUndefined();
        expect(state.eventCount).toBe(2); // 只剩下 [a(100), b(200)]
    });
});
