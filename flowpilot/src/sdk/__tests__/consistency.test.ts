import { describe, it, expect } from "vitest";
import { FlowEngine } from "../core/engine";
import { FlowRuntime } from "../runtime/runtime";
import { FlowReplayer } from "../runtime/replay";
import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

function steps(): Step[] {
    return [
        { id: "1", complete: "a" },
        { id: "2", complete: "b" },
        { id: "3", complete: "c" }
    ];
}

function signals(): Signal[] {
    return [
        { id: "e1", key: "a", type: "interaction", mode: "event", timestamp: 1 },
        { id: "e2", key: "b", type: "interaction", mode: "event", timestamp: 2 }
    ];
}

describe("System Consistency - Engine / Runtime / Replay", () => {

    it("ENGINE == RUNTIME final state", () => {
        const engine = new FlowEngine(steps());

        signals().forEach(s => engine.ingest(s));

        const rt = new FlowRuntime({ steps: steps() });

        signals().forEach(s => rt.ingest(s));

        expect(engine.currentStep.id)
            .toBe(rt.currentStep.id);
    });

    it("REPLAY == ENGINE (deterministic contract)", () => {
        const engine = new FlowEngine(steps());
        signals().forEach(s => engine.ingest(s));

        const replay = FlowReplayer.replay(steps(), signals());

        expect(replay.snapshot.stepId)
            .toBe(engine.currentStep.id);
    });

    it("REPLAY == RUNTIME", () => {
        const rt = new FlowRuntime({ steps: steps() });
        signals().forEach(s => rt.ingest(s));

        const replay = FlowReplayer.replay(steps(), signals());

        expect(replay.snapshot.stepId)
            .toBe(rt.currentStep.id);
    });

});
