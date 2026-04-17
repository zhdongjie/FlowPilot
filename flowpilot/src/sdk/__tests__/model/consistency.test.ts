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

describe("Consistency Layer", () => {

    it("should be idempotent under duplicate ingestion", () => {

        const steps = [
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ];

        const engine = new FlowEngine(structuredClone(steps));

        const s = sig("a", 1);

        engine.ingest(s);
        engine.ingest(s);
        engine.ingest(s);

        expect(engine.currentStep?.id).toBe("2");
    });

    it("should maintain deterministic ordering under same inputs", () => {

        const steps = [
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ];

        const engine1 = new FlowEngine(structuredClone(steps));
        const engine2 = new FlowEngine(structuredClone(steps));

        const signals = [sig("a", 1), sig("b", 2)];

        signals.forEach(s => {
            engine1.ingest(s);
            engine2.ingest(s);
        });

        expect(engine1.currentStep?.id).toBe(engine2.currentStep?.id);
    });

});
