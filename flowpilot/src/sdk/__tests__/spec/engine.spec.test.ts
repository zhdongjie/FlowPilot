import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";

function makeSignal(key: string, ts = 1) {
    return {
        id: Math.random().toString(),
        key,
        type: "interaction" as const,
        timestamp: ts
    };
}

describe("FlowEngine Spec - Engine Core Transition", () => {

    it("INIT: should start at first unresolved step", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        expect(engine.currentStep?.id).toBe("1");
    });

    it("EVENT: should advance when step condition is met", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        engine.ingest(makeSignal("a"));

        expect(engine.currentStep?.id).toBe("2");
    });

    it("EVENT: should ignore unrelated signal", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        engine.ingest(makeSignal("x"));

        expect(engine.currentStep?.id).toBe("1");
    });

    it("CHAIN: should support multi-step progression", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" },
            { id: "3", complete: "c" }
        ]);

        engine.ingest(makeSignal("a"));
        engine.ingest(makeSignal("b"));
        engine.ingest(makeSignal("c"));

        expect(engine.currentStep?.id).toBe("3");
    });

});
