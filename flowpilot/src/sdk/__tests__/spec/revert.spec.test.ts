// src/sdk/__tests__/spec/revert.spec.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type {Step} from "../../types";

describe("FlowEngine Spec - Revert Semantics (v1.5)", () => {
    const s = (key: string): any => ({
        id: `sig_${key}_${Math.random()}`,
        key,
        timestamp: Date.now()
    });

    const steps: Step[] = [
        { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
        { id: "2", when: { type: "event", key: "b" }, next: ["3"] },
        { id: "3", when: { type: "event", key: "c" } }
    ];

    it("REVERT: 应该基于 stepId 重置状态并正确重算", () => {
        const engine = new FlowEngine(steps, "1");
        engine.ingest(s("a"));
        engine.ingest(s("b"));

        expect(engine.getActiveSteps()).toContain("3");

        // 回滚到步骤 1
        // 注意：新版 revert(stepId) 会清空该步骤之后的事件并重算
        engine.revert("1");

        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getActiveSteps()).toContain("2");
    });
});
