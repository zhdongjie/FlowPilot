// src/sdk/__tests__/chaos/engine.chaos.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step, Signal } from "../../types";

/**
 * 辅助函数：生成符合 v1.5 规范的 Signal
 */
function sig(key: string, ts: number): Signal {
    return {
        id: Math.random().toString(36).substring(7),
        key,
        timestamp: ts
    };
}

describe("Engine Chaos Layer (v1.5 DAG)", () => {

    it("should ignore random noise signals", () => {
        // Step 定义适配 v1.5 Condition 结构
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" }
            }
        ];

        // 构造函数明确传入 rootStepId
        const engine = new FlowEngine(steps, "1");

        engine.ingest(sig("noise1", 1));
        engine.ingest(sig("noise2", 2));
        engine.ingest(sig("noise3", 3));

        // 验证状态：不相关的信号不应触发推进，步骤 1 仍应活跃
        expect(engine.getActiveSteps()).toContain("1");
        expect(engine.getCompletedSteps()).not.toContain("1");
    });

    it("should not crash under high-frequency ingestion", () => {
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "target" }
            }
        ];
        const engine = new FlowEngine(steps, "1");

        // 模拟高频大量无效信号注入
        for (let i = 0; i < 100; i++) {
            engine.ingest(sig("noise_" + i, i));
        }

        // 注入有效信号
        engine.ingest(sig("target", 101));

        // 验证状态：高频注入后引擎依然能正常工作并完成步骤
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getActiveSteps()).toHaveLength(0);
    });

    it("should remain stable under mixed signals", () => {
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" },
                next: ["2"]
            },
            {
                id: "2",
                when: { type: "event", key: "b" }
            }
        ];

        const engine = new FlowEngine(steps, "1");

        const inputs = [
            sig("noise_pre", 1),
            sig("a", 2),         // 触发 1 完成，激活 2
            sig("noise_mid", 3),
            sig("b", 4)          // 触发 2 完成
        ];

        inputs.forEach(s => engine.ingest(s));

        // 验证状态：混合信号后，两个步骤均应完成
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toContain("2");
        expect(engine.getActiveSteps()).toHaveLength(0);
    });

});
