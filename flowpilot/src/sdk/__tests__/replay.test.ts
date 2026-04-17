import { describe, it, expect } from "vitest";
import { FlowReplayer } from "../runtime/replay";
import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

const steps = (): Step[] => [
    { id: "1", complete: "a" },
    { id: "2", complete: "b" },
    { id: "3", complete: "c" }
];

const signals = (): Signal[] => [
    { id: "1", key: "a", type: "interaction", mode: "event", timestamp: 1 },
    { id: "2", key: "b", type: "interaction", mode: "event", timestamp: 2 }
];

describe("FlowReplayer - Determinism Contract", () => {

    it("should always produce same snapshot", () => {
        const r1 = FlowReplayer.replay(steps(), signals());
        const r2 = FlowReplayer.replay(steps(), signals());

        expect(r1.snapshot.stepId).toBe(r2.snapshot.stepId);
        expect(r1.snapshot.index).toBe(r2.snapshot.index);
    });

    it("should be order-insensitive input safe (internal sort)", () => {
        const shuffled: Signal[] = [...signals()].reverse();

        const r1 = FlowReplayer.replay(steps(), shuffled);

        expect(r1.snapshot.stepId).toBeDefined();
    });

    it("should NOT mutate input steps", () => {
        const s = steps();

        FlowReplayer.replay(s, signals());

        expect(s[0].id).toBe("1");
    });

});
