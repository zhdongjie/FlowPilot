import { describe, it, expect } from "vitest";
import { FlowReplayer } from "../../runtime/replay";
import type { Signal } from "../../types/signal.ts";
import type { Step } from "../../types/step.ts";

describe("FlowPilot Spec - Replay System", () => {

    it("should replay signals into correct final state", () => {

        const steps : Step[] = [
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ];

        const signals : Signal[] = [
            {
                id: "s1",
                key: "a",
                type: "interaction",
                timestamp: 1
            },
            {
                id: "s2",
                key: "b",
                type: "interaction",
                timestamp: 2
            }
        ];

        const result = FlowReplayer.replay(steps, signals);

        expect(result.engine.currentStep?.id).toBe("2");
    });

});
