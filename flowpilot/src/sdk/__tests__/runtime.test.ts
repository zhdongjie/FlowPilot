import { describe, it, expect } from "vitest";
import { FlowRuntime } from "../runtime/runtime";
import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

function steps(): Step[] {
    return [
        { id: "1", complete: "a" },
        { id: "2", complete: "b" },
        { id: "3", complete: "c" }
    ];
}

function event(key: string): Signal {
    return {
        id: `e_${key}`,
        key,
        type: "interaction",
        mode: "event",
        timestamp: Date.now()
    };
}

describe("FlowRuntime - Contract Boundary", () => {

    it("should expose engine state correctly", () => {
        const rt = new FlowRuntime({ steps: steps() });

        expect(rt.currentStep.id).toBe("1");
    });

    it("should advance through runtime without extra logic", () => {
        const rt = new FlowRuntime({ steps: steps() });

        rt.ingest(event("a"));

        expect(rt.currentStep.id).toBe("2");
    });

    it("should NOT mutate step logic itself", () => {
        const rt = new FlowRuntime({ steps: steps() });

        const before = rt.currentStep.id;

        rt.ingest(event("unknown"));

        expect(rt.currentStep.id).toBe(before);
    });

});
