// src/sdk/__tests__/spec/replay.spec.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import { FlowReplayer } from "../../runtime/replay";
import type { Signal } from "../../types/signal";
import type { Step } from "../../types/step";

describe("FlowPilot Spec - Replay System", () => {
    it("should replay signals into the correct final state", () => {
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

        const result = FlowReplayer.replay(steps, signals, "1");

        expect(result.state.completedSteps).toContain("1");
        expect(result.state.completedSteps).toContain("2");
        expect(result.state.activeSteps).toHaveLength(0);
    });

    it("should stop at an intermediate state if signals are partial", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
            { id: "2", when: { type: "event", key: "b" } }
        ];

        const signals: Signal[] = [
            { id: "s1", key: "a", timestamp: 1 }
        ];

        const result = FlowReplayer.replay(steps, signals, "1");

        expect(result.state.completedSteps).toContain("1");
        expect(result.state.activeSteps).toContain("2");
    });

    it("should keep replay lifecycle events without duplicating ingested signals", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
            { id: "2", when: { type: "event", key: "b" } }
        ];

        const signals: Signal[] = [
            { id: "s1", key: "a", timestamp: 1 },
            { id: "s2", key: "b", timestamp: 2 }
        ];

        const result = FlowReplayer.replay(steps, signals, "1");
        const trace = result.trace.all();

        expect(trace.filter(event => event.type === "REPLAY_START")).toHaveLength(1);
        expect(trace.filter(event => event.type === "REPLAY_END")).toHaveLength(1);
        expect(trace.filter(event => event.type === "SIGNAL_INGEST")).toHaveLength(signals.length);
    });

    it("should allow replay callers to preserve a custom trace scope", () => {
        const steps: Step[] = [
            { id: "1", when: { type: "event", key: "a" }, next: ["2"] },
            { id: "2", when: { type: "event", key: "b" } }
        ];

        const signals: Signal[] = [
            { id: "s1", key: "a", timestamp: 1 }
        ];

        const result = FlowReplayer.replay(steps, signals, "1", {
            mode: "devtools"
        });
        const ingestTrace = result.trace.all().find(event => event.type === "SIGNAL_INGEST");

        expect(ingestTrace?.meta?.scope).toBe("devtools");
    });

    it("should replay a serializable config snapshot exported from a live engine", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "start" }, next: ["B"] },
            {
                id: "B",
                enterWhen: { type: "event", key: "ready" },
                when: { type: "event", key: "pay" },
                cancelWhen: "!pay within(2000)"
            }
        ];

        const engine = new FlowEngine(steps, "A");
        engine.ingest({ id: "s1", key: "start", timestamp: 1 });

        const { steps: configSteps, rootStepId } = engine.getConfigSnap();

        expect(() => structuredClone(configSteps)).not.toThrow();

        const result = FlowReplayer.replay(
            configSteps,
            engine.getSignals(),
            rootStepId,
            { mode: "devtools" }
        );

        expect(result.state.completedSteps).toContain("A");
        expect(result.state.activeSteps).not.toContain("B");

        engine.stop();
        result.engine.stop();
    });
});
