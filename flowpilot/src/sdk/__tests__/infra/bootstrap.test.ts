import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";

describe("FlowEngine Spec - Bootstrap", () => {

    it("should initialize at first step", () => {

        const engine = new FlowEngine([
            { id: "1", complete: "a" }
        ]);

        expect(engine.currentIndex).toBe(0);
        expect(engine.currentStep?.id).toBe("1");
    });

});
