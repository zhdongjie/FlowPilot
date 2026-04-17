import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";

function sig(key: string, ts = 1) {
    return {
        id: Math.random().toString(),
        key,
        type: "interaction" as const,
        timestamp: ts
    };
}

describe("Engine Behavior Layer", () => {

    it("should not advance on unrelated signal", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" }
        ]);

        engine.ingest(sig("x"));

        expect(engine.currentStep?.id).toBe("1");
    });

    it("should advance only on matching signal", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        engine.ingest(sig("a"));

        expect(engine.currentStep?.id).toBe("2");
    });

    it("should support multi-step progression", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" },
            { id: "3", complete: "c" }
        ]);

        engine.ingest(sig("a"));
        engine.ingest(sig("b"));
        engine.ingest(sig("c"));

        expect(engine.currentStep?.id).toBe("3");
    });

});
