import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";

function s(key: string, ts: number) {
    return {
        id: Math.random().toString(),
        key,
        type: "interaction" as const,
        timestamp: ts
    };
}

describe("FlowEngine Spec - Determinism", () => {

    it("should produce same result for same signals order", () => {

        const steps = [
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ];

        const engine1 = new FlowEngine(structuredClone(steps));
        const engine2 = new FlowEngine(structuredClone(steps));

        const signals = [
            s("a", 1),
            s("b", 2)
        ];

        signals.forEach(sig => {
            engine1.ingest(sig);
            engine2.ingest(sig);
        });

        expect(engine1.currentStep?.id).toBe(engine2.currentStep?.id);
    });

});
