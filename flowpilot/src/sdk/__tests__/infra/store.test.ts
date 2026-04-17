// src/sdk/__tests__/infra/store.test.ts

import { describe, it, expect } from "vitest";
import { SignalStore } from "../../core/store";

describe("SignalStore Spec", () => {

    it("should preserve insertion order", () => {

        const store = new SignalStore();

        store.push({ id: "1", key: "a", type: "interaction", timestamp: 1 });
        store.push({ id: "2", key: "b", type: "interaction", timestamp: 2 });

        const events = store.getEvents();

        expect(events[0].id).toBe("1");
        expect(events[1].id).toBe("2");
    });

});
