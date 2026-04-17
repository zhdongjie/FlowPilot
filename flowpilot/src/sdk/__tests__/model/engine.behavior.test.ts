// src/sdk/__tests__/model/engine.behavior.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step, Signal } from "../../types";

/**
 * 辅助函数：生成符合 v1.5 规范的 Signal
 */
function sig(key: string, ts = 1): Signal {
    return {
        id: `sig_${key}_${Math.random().toString(36).substring(7)}`,
        key,
        timestamp: ts
    };
}

describe("Engine Behavior Layer (v1.5 DAG Implementation)", () => {

    it("should not advance on unrelated signal", () => {
        // 1. 适配新版 Step 结构
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" }
            }
        ];

        // 2. 传入 rootStepId
        const engine = new FlowEngine(steps, "1");

        // 注入无关信号
        engine.ingest(sig("x"));

        // 验证：步骤 1 仍处于活跃状态，未完成
        expect(engine.getActiveSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toHaveLength(0);
    });

    it("should advance only on matching signal", () => {
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

        // 注入匹配信号
        engine.ingest(sig("a"));

        // 验证状态迁移：1 完成，2 激活
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getActiveSteps()).toContain("2");
    });

    it("should support multi-step progression", () => {
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" },
                next: ["2"]
            },
            {
                id: "2",
                when: { type: "event", key: "b" },
                next: ["3"]
            },
            {
                id: "3",
                when: { type: "event", key: "c" }
            }
        ];

        const engine = new FlowEngine(steps, "1");

        // 依次注入信号
        engine.ingest(sig("a"));
        engine.ingest(sig("b"));
        engine.ingest(sig("c"));

        // 验证：所有步骤均已完成
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toContain("2");
        expect(engine.getCompletedSteps()).toContain("3");
        expect(engine.getActiveSteps()).toHaveLength(0);
    });

});
