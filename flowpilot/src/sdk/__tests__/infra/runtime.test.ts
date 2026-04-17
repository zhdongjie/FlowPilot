import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";

function sig(key: string, ts: number) {
    return {
        id: Math.random().toString(),
        key,
        type: "interaction" as const,
        timestamp: ts
    };
}

describe("Runtime Layer", () => {

    it("should execute full runtime flow correctly", () => {

        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        engine.ingest(sig("a", 1));
        engine.ingest(sig("b", 2));

        expect(engine.currentStep?.id).toBe("2");
    });

    it("should support partial progression and continue correctly", () => {

        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" },
            { id: "3", complete: "c" }
        ]);

        engine.ingest(sig("a", 1));

        expect(engine.currentStep?.id).toBe("2");

        engine.ingest(sig("b", 2));

        expect(engine.currentStep?.id).toBe("3");
    });

});
