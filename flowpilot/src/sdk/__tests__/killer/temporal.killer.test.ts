// src/sdk/__tests__/killer/temporal.killer.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FlowEngine } from "../../core/engine";
import { FlowRuntime } from "../../runtime/runtime";
import { DEFAULT_CONFIG, Signal, Step } from "../../types";

function sig(key: string, ts: number): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random().toString(36).substring(7)}`,
        key,
        timestamp: ts
    };
}

describe("FlowEngine Killer Tests (Temporal & Safety)", () => {
    it("Temporal: should IGNORE premature signals that occurred before step activation", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" } }
        ];
        const engine = new FlowEngine(steps, "A");

        engine.ingest(sig("b", 100));
        engine.ingest(sig("a", 200));

        expect(engine.getCompletedSteps()).toContain("A");
        expect(engine.getCompletedSteps()).not.toContain("B");
        expect(engine.getActiveSteps()).toContain("B");
    });

    it("Temporal: should ACCEPT historical signals if explicitly defined in afterStep", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" }, next: ["C"] },
            { id: "C", when: { type: "event", key: "x", afterStep: "A" } }
        ];
        const engine = new FlowEngine(steps, "A");

        engine.ingest(sig("a", 100));
        engine.ingest(sig("x", 150));
        engine.ingest(sig("b", 200));

        expect(engine.getCompletedSteps()).toContain("C");
    });

    it("Safety: should CRASH instantly upon initialization if DAG is invalid", () => {
        const cyclicSteps: Step[] = [
            { id: "A", when: "a", next: ["B"] },
            { id: "B", when: "b", next: ["A"] }
        ];
        expect(() => new FlowEngine(cyclicSteps, "A")).toThrow(/Cycle detected/);
    });

    it("Performance: should handle 10k events instantly via Binary Search Index", () => {
        const steps: Step[] = [
            { id: "A", when: "start", next: ["B"] },
            { id: "B", when: "target" }
        ];
        const engine = new FlowEngine(steps, "A");
        engine.ingest(sig("start", 1));

        for (let i = 2; i <= 10000; i++) {
            engine.ingest(sig(`noise_${i}`, i));
        }

        engine.ingest(sig("target", 10001));
        expect(engine.getCompletedSteps()).toContain("B");
    });
});

describe("FlowRuntime Scheduler Killer Tests", () => {
    let runtime: FlowRuntime | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        runtime = null;
    });

    afterEach(() => {
        runtime?.stop();
        runtime = null;
        vi.useRealTimers();
        localStorage.clear();
    });

    it("Scheduler: should automatically cancel step after 2000ms of silence", () => {
        const steps: Step[] = [
            { id: "A", when: "start", next: ["B"] },
            { id: "B", when: "pay", cancelWhen: "!pay within(2000)" }
        ];

        runtime = new FlowRuntime({ steps, rootStepId: "A", config: DEFAULT_CONFIG });
        runtime.start();

        const startTime = 1000;
        vi.setSystemTime(startTime);

        runtime.dispatch({ id: "s1", key: "start", timestamp: startTime });
        expect(runtime.activeSteps).toContain("B");

        vi.advanceTimersByTime(2100);

        expect(runtime.activeSteps).not.toContain("B");
        const snapshot = runtime.debug();
        const lastTrace = snapshot.trace[snapshot.trace.length - 1];
        expect(lastTrace.meta).toBeDefined();
        expect(lastTrace.meta!.reason).toBe("CANCELLED_BY_CONDITION");
    });

    it("Scheduler: should reconstruct timers correctly after Revert", () => {
        const steps: Step[] = [
            { id: "A", when: "start", next: ["B"] },
            { id: "B", when: "pay", cancelWhen: "!pay within(5000)" }
        ];

        runtime = new FlowRuntime({ steps, rootStepId: "A", config: DEFAULT_CONFIG });
        runtime.start();

        runtime.dispatch({ id: "s1", key: "start", timestamp: 1000 });

        vi.advanceTimersByTime(6000);
        expect(runtime.activeSteps).not.toContain("B");

        runtime.revert("A");
        expect(runtime.activeSteps).toContain("B");

        vi.advanceTimersByTime(6000);
        expect(runtime.activeSteps).not.toContain("B");
    });
});
