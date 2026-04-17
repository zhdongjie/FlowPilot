// src/sdk/__tests__/spec/replay.spec.test.ts

import { describe, it, expect } from "vitest";
import { FlowReplayer } from "../../runtime/replay";
import type { Signal } from "../../types/signal";
import type { Step } from "../../types/step";

describe("FlowPilot Spec - Replay System (v1.5 DAG)", () => {

    it("should replay signals into correct final state", () => {
        // 1. 适配 v1.5 数据结构：使用 when 条件和 next 拓扑
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

        const signals: Signal[] = [
            {
                id: "s1",
                key: "a",
                type: "interaction",
                timestamp: 1
            },
            {
                id: "s2",
                key: "b",
                type: "interaction",
                timestamp: 2
            }
        ];

        // 2. 适配 API：显式传入 rootStepId
        const result = FlowReplayer.replay(steps, signals, "1");

        // 3. 适配断言：验证步骤 1 和 2 均已完成
        // 在该测试用例中，注入 a 和 b 后，1 和 2 都应该进入完成集合
        expect(result.state.completedSteps).toContain("1");
        expect(result.state.completedSteps).toContain("2");

        // 验证活跃集合：流程结束，活跃集应为空
        expect(result.state.activeSteps).toHaveLength(0);
    });

    it("should stop at intermediate state if signals are partial", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
            { id: "2", when: { type: "event", key: "b" } }
        ];

        const signals: Signal[] = [
            { id: "s1", key: "a", timestamp: 1 }
        ];

        const result = FlowReplayer.replay(steps, signals, "1");

        // 验证部分重放：步骤 1 完成，步骤 2 激活
        expect(result.state.completedSteps).toContain("1");
        expect(result.state.activeSteps).toContain("2");
    });

});
