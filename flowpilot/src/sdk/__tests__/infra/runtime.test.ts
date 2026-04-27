// src/sdk/__tests__/infra/runtime.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FlowEngine } from "../../core/engine";
import { FlowRuntime } from "../../runtime/runtime";
import { DEFAULT_CONFIG } from "../../types";
import type { Step, Signal, FlowPlugin } from "../../types";

function sig(key: string, ts: number): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random()}`,
        key,
        timestamp: ts
    };
}

function createRuntimeConfig(key: string) {
    return {
        ...DEFAULT_CONFIG,
        runtime: {
            ...DEFAULT_CONFIG.runtime,
            persistence: {
                enabled: true,
                key
            }
        }
    };
}

describe("Runtime Layer", () => {
    const runtimes: FlowRuntime[] = [];

    const trackRuntime = (runtime: FlowRuntime) => {
        runtimes.push(runtime);
        return runtime;
    };

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        while (runtimes.length > 0) {
            runtimes.pop()?.stop();
        }
        vi.useRealTimers();
        localStorage.clear();
    });

    it("should execute a full runtime flow correctly", () => {
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

        engine.ingest(sig("a", 1));
        engine.ingest(sig("b", 2));

        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toContain("2");
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

        engine.ingest(sig("a", 1));

        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getActiveSteps()).toContain("2");
        expect(engine.getActiveSteps()).not.toContain("3");

        engine.ingest(sig("b", 2));

        expect(engine.getCompletedSteps()).toContain("2");
        expect(engine.getActiveSteps()).toContain("3");
    });

    it("should persist a finished marker and emit flow-complete only once", () => {
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

        let flowCompleteCalls = 0;
        const plugin: FlowPlugin = {
            name: "finish-tracker",
            onFlowComplete() {
                flowCompleteCalls++;
            }
        };

        const storageKey = "flowpilot_runtime_finish_marker";
        const runtime = trackRuntime(new FlowRuntime({
            steps,
            rootStepId: "1",
            config: createRuntimeConfig(storageKey),
            plugins: [plugin]
        }));

        runtime.start();
        runtime.dispatch(sig("a", 1));
        runtime.dispatch(sig("b", 2));

        expect(JSON.parse(localStorage.getItem(storageKey) ?? "[]")).toEqual(
            expect.arrayContaining(["1", "2"])
        );
        expect(localStorage.getItem(`${storageKey}_finished`)).toBe("true");
        expect(flowCompleteCalls).toBe(1);

        runtime.engine.tick(3);
        expect(flowCompleteCalls).toBe(1);

        runtime.revertToTime(1);
        expect(localStorage.getItem(`${storageKey}_finished`)).toBeNull();
    });

    it("should restore a gated pending step from persistence and only start timeout after enterWhen", () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);

        const steps: Step[] = [
            {
                id: "A",
                when: { type: "event", key: "start" },
                next: ["B"]
            },
            {
                id: "B",
                enterWhen: { type: "event", key: "ready" },
                when: { type: "event", key: "pay" },
                cancelWhen: "!pay within(2000)"
            }
        ];

        const storageKey = "flowpilot_runtime_enterwhen_persistence_timer";

        const runtime1 = trackRuntime(new FlowRuntime({
            steps,
            rootStepId: "A",
            config: createRuntimeConfig(storageKey)
        }));
        runtime1.start();
        runtime1.dispatch(sig("start", Date.now()));

        expect(runtime1.completedSteps).toContain("A");
        expect(runtime1.activeSteps).not.toContain("B");
        expect(runtime1.debug().pendingSteps).toContain("B");
        expect(localStorage.getItem(`${storageKey}_finished`)).toBeNull();
        expect(JSON.parse(localStorage.getItem(storageKey) ?? "[]")).toEqual(
            expect.arrayContaining(["A"])
        );

        runtime1.stop();

        const runtime2 = trackRuntime(new FlowRuntime({
            steps,
            rootStepId: "A",
            config: createRuntimeConfig(storageKey)
        }));
        runtime2.start();

        expect(runtime2.completedSteps).toContain("A");
        expect(runtime2.activeSteps).not.toContain("B");
        expect(runtime2.debug().pendingSteps).toContain("B");
        expect(localStorage.getItem(`${storageKey}_finished`)).toBeNull();

        vi.advanceTimersByTime(4000);
        expect(runtime2.activeSteps).not.toContain("B");
        expect(runtime2.debug().pendingSteps).toContain("B");

        runtime2.dispatch(sig("pay", Date.now()));
        expect(runtime2.completedSteps).not.toContain("B");
        expect(runtime2.activeSteps).not.toContain("B");
        expect(runtime2.debug().pendingSteps).toContain("B");

        vi.advanceTimersByTime(1000);
        runtime2.dispatch(sig("ready", Date.now()));

        expect(runtime2.activeSteps).toContain("B");
        expect(runtime2.completedSteps).not.toContain("B");
        expect(runtime2.debug().pendingSteps).not.toContain("B");

        vi.advanceTimersByTime(1500);
        expect(runtime2.activeSteps).toContain("B");

        vi.advanceTimersByTime(700);
        expect(runtime2.activeSteps).not.toContain("B");

        const trace = runtime2.debug().trace;
        const lastTrace = trace[trace.length - 1];
        expect(lastTrace.meta?.reason).toBe("CANCELLED_BY_CONDITION");
    });

    it("should require a fresh post-activation signal after restoring a gated step", () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);

        const steps: Step[] = [
            {
                id: "A",
                when: { type: "event", key: "start" },
                next: ["B"]
            },
            {
                id: "B",
                enterWhen: { type: "event", key: "ready" },
                when: { type: "event", key: "pay" },
                cancelWhen: "!pay within(2000)"
            }
        ];

        const storageKey = "flowpilot_runtime_enterwhen_restore_fresh_signal";

        const runtime1 = trackRuntime(new FlowRuntime({
            steps,
            rootStepId: "A",
            config: createRuntimeConfig(storageKey)
        }));
        runtime1.start();
        runtime1.dispatch(sig("start", Date.now()));
        runtime1.stop();

        const runtime2 = trackRuntime(new FlowRuntime({
            steps,
            rootStepId: "A",
            config: createRuntimeConfig(storageKey)
        }));
        runtime2.start();

        vi.advanceTimersByTime(500);
        runtime2.dispatch(sig("pay", Date.now()));
        expect(runtime2.completedSteps).not.toContain("B");
        expect(runtime2.activeSteps).not.toContain("B");

        vi.advanceTimersByTime(500);
        runtime2.dispatch(sig("ready", Date.now()));
        expect(runtime2.activeSteps).toContain("B");
        expect(runtime2.completedSteps).not.toContain("B");

        vi.advanceTimersByTime(100);
        runtime2.dispatch(sig("pay", Date.now()));
        expect(runtime2.completedSteps).toContain("B");
        expect(runtime2.activeSteps).not.toContain("B");
        expect(localStorage.getItem(`${storageKey}_finished`)).toBe("true");
    });
});
