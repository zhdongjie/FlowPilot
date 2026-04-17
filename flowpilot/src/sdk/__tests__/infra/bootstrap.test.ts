// src/sdk/__tests__/infra/bootstrap.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step } from "../../types";

describe("FlowEngine Spec - Bootstrap (v1.5 DAG)", () => {

    it("should initialize at first step", () => {
        // 1. 适配新版 Step 结构：使用 when 条件对象
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" }
            }
        ];

        // 2. 适配构造函数：显式传入 rootStepId
        const engine = new FlowEngine(steps, "1");

        // 3. 适配状态断言：检查 activeSteps 集合
        // 引擎初始化后，rootStepId 必须处于 active 状态
        expect(engine.getActiveSteps()).toContain("1");

        // 初始状态下，已完成列表应当为空
        expect(engine.getCompletedSteps()).toHaveLength(0);
    });

    it("should fail to initialize if rootStepId is missing in steps", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" } }
        ];

        // 测试异常路径：传入一个不存在的 rootId
        const engine = new FlowEngine(steps, "non-existent-id");

        expect(engine.getActiveSteps()).not.toContain("1");
        expect(engine.getActiveSteps()).toContain("non-existent-id");
    });

});
