// src/sdk/__tests__/spec/engine.spec.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step, Signal } from "../../types";

describe("FlowEngine Spec - Engine Core Transition (v1.5 DAG)", () => {
    const makeSignal = (key: string): Signal => ({
        id: Math.random().toString(36),
        key,
        timestamp: Date.now()
    });

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

    let engine: FlowEngine;

    beforeEach(() => {
        engine = new FlowEngine(steps, "1");
    });

    it("INIT: 应该激活初始根步骤", () => {
        // 以前是 expect(engine.currentIndex).toBe(0)
        expect(engine.getActiveSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toHaveLength(0);
    });

    it("EVENT: 当条件满足时应该推进状态", () => {
        engine.ingest(makeSignal("a"));

        // 步骤 1 完成，步骤 2 激活
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getActiveSteps()).toContain("2");
    });

    it("EVENT: 应该忽略不相关的信号", () => {
        engine.ingest(makeSignal("wrong_key"));

        expect(engine.getCompletedSteps()).toHaveLength(0);
        expect(engine.getActiveSteps()).toContain("1");
    });

    it("CHAIN: 应该支持连续推进（Fact 补算）", () => {
        // 预存信号 a, b, c
        engine.ingest(makeSignal("a"));
        engine.ingest(makeSignal("b"));
        engine.ingest(makeSignal("c"));

        expect(engine.getCompletedSteps()).toContain("3");
        expect(engine.getActiveSteps()).toHaveLength(0);
    });
});
