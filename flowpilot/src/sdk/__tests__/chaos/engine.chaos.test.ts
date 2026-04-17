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

describe("Engine Chaos Layer", () => {

    it("should ignore random noise signals", () => {

        const engine = new FlowEngine([
            { id: "1", complete: "a" }
        ]);

        engine.ingest(sig("noise1", 1));
        engine.ingest(sig("noise2", 2));
        engine.ingest(sig("noise3", 3));

        expect(engine.currentStep).toBeDefined();
    });

    it("should not crash under high-frequency ingestion", () => {

        const engine = new FlowEngine([
            { id: "1", complete: "a" }
        ]);

        for (let i = 0; i < 100; i++) {
            engine.ingest(sig("x" + i, i));
        }

        expect(engine.currentStep).toBeDefined();
    });

    it("should remain stable under mixed signals", () => {

        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        const inputs = [
            sig("x", 1),
            sig("a", 2),
            sig("noise", 3),
            sig("b", 4)
        ];

        inputs.forEach(s => engine.ingest(s));

        expect(engine.currentStep).toBeDefined();
    });

});
