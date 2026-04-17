// src/sdk/__tests__/spec/determinism.spec.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step, Signal } from "../../types";

/**
 * 辅助函数：生成符合 v1.5 规范的 Signal
 */
function s(key: string, ts: number): Signal {
    return {
        // 确定性测试需要固定的 ID，确保幂等层不会干扰比对
        id: `sig_${key}_${ts}`,
        key,
        timestamp: ts
    };
}

describe("FlowEngine Spec - Determinism (v1.5 DAG Implementation)", () => {

    it("should produce same result for same signals order", () => {
        // 1. 适配新版 Step 结构：使用 when 条件与 next 拓扑
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

        // 2. 构造函数传入 rootStepId
        const engine1 = new FlowEngine(structuredClone(steps), "1");
        const engine2 = new FlowEngine(structuredClone(steps), "1");

        const signals = [
            s("a", 1),
            s("b", 2)
        ];

        // 3. 执行相同的信号流注入
        signals.forEach(sig => {
            engine1.ingest(sig);
            engine2.ingest(sig);
        });

        // 4. 验证确定性：
        // 在 v1.5 中，不再比对 currentIndex，而是比对 active 和 completed 集合

        // 验证活跃步骤集合一致
        expect(engine1.getActiveSteps()).toEqual(engine2.getActiveSteps());

        // 验证已完成步骤集合一致
        expect(engine1.getCompletedSteps()).toEqual(engine2.getCompletedSteps());

        // 验证最终状态：两个引擎都应该走完流程（活跃集为空，完成集包含 1 和 2）
        expect(engine1.getActiveSteps()).toHaveLength(0);
        expect(engine1.getCompletedSteps()).toContain("1");
        expect(engine1.getCompletedSteps()).toContain("2");
    });

});
