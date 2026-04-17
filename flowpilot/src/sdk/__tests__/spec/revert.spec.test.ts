// src/sdk/__tests__/spec/revert.spec.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type {Step} from "../../types";

describe("FlowEngine Spec - Revert Semantics (v1.5)", () => {

    const steps: Step[] = [
        { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
        { id: "2", when: { type: "event", key: "b" }, next: ["3"] },
        { id: "3", when: { type: "event", key: "c" } }
    ];

    it("REVERT: 应该基于 stepId 重置状态并正确重算", () => {

        const engine = new FlowEngine(steps, "1");

        // 模拟两个信号
        engine.ingest({ id: "s1", key: "a", timestamp: 100 });
        engine.ingest({ id: "s2", key: "b", timestamp: 200 });

        expect(engine.getCompletedSteps()).toContain("2");

        // 动作：回退到步骤 1
        // 语义：回到步骤 1 刚刚完成的时刻（100ms）
        engine.revert("1");

        // ✅ 修正断言 1：步骤 1 应该是已完成状态
        expect(engine.getCompletedSteps()).toEqual(["1"]);

        // ✅ 修正断言 2：步骤 2 应该是当前活跃状态（等待 b 信号）
        expect(engine.getActiveSteps()).toEqual(["2"]);
    });
});
