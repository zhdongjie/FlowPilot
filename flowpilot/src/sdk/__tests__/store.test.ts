import { describe, it, expect } from "vitest";
import { SignalStore } from "../core/store";

describe("SignalStore", () => {
    it("stores events in order", () => {
        const store = new SignalStore();

        store.push({
            id: "1",
            key: "click.login",
            type: "interaction",
            mode: "event",
            timestamp: Date.now()
        });

        expect(store.events.length).toBe(1);
    });

    it("stores facts uniquely", () => {
        const store = new SignalStore();

        store.push({
            id: "1",
            key: "login.success",
            type: "custom",
            mode: "fact",
            timestamp: Date.now()
        });

        store.push({
            id: "2",
            key: "login.success",
            type: "custom",
            mode: "fact",
            timestamp: Date.now()
        });

        expect(store.facts.size).toBe(1);
    });
});
