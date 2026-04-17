// src/sdk/__tests__/infra/runtime.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step, Signal } from "../../types";

/**
 * 辅助函数：生成符合 v1.5 规范的 Signal
 */
function sig(key: string, ts: number): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random()}`,
        key,
        timestamp: ts
    };
}

describe("Runtime Layer (v1.5 DAG Implementation)", () => {

    it("should execute full runtime flow correctly", () => {
        // 适配新版 Step 结构与 DAG 后继逻辑
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

        // 构造函数明确传入起点
        const engine = new FlowEngine(steps, "1");

        engine.ingest(sig("a", 1));
        engine.ingest(sig("b", 2));

        // 验证状态：步骤 1 和 2 都已进入完成集合
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toContain("2");
        // 验证活跃状态：所有步骤已走完，活跃集合应为空
        expect(engine.getActiveSteps()).toHaveLength(0);
    });

    it("should support partial progression and continue correctly", () => {
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

        // 1. 处理第一步
        engine.ingest(sig("a", 1));

        // 验证部分推进：步骤 1 完成，步骤 2 激活
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getActiveSteps()).toContain("2");
        expect(engine.getActiveSteps()).not.toContain("3");

        // 2. 继续处理后续信号
        engine.ingest(sig("b", 2));

        // 验证状态：步骤 2 完成，步骤 3 激活
        expect(engine.getCompletedSteps()).toContain("2");
        expect(engine.getActiveSteps()).toContain("3");
    });

});
