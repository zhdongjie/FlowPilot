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

describe("FlowEngine Spec - Revert Semantics", () => {

    it("REVERT: should reset state and recompute correctly", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" },
            { id: "3", complete: "c" }
        ]);

        engine.ingest(s("a", 1));
        engine.ingest(s("b", 2));

        expect(engine.currentStep?.id).toBe("3");

        engine.revert(0);

        expect(engine.currentStep?.id).toBe("1");
    });

    it("REVERT: should not be affected by future signals", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        engine.ingest(s("a", 1));
        engine.ingest(s("b", 2));

        engine.revert(0);

        expect(engine.currentStep?.id).toBe("1");
    });

});
