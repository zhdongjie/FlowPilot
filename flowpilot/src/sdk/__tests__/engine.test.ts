import { describe, it, expect } from "vitest";
import { FlowEngine } from "../core/engine";
import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

function createSteps(): Step[] {
    return [
        { id: "1", complete: "a" },
        { id: "2", complete: "b" },
        { id: "3", complete: "c" }
    ];
}

function createEngine() {
    return new FlowEngine(createSteps());
}

function makeEvent(key: string, ts = Date.now()): Signal {
    return {
        id: `e_${key}_${ts}`,
        key,
        type: "interaction",
        mode: "event",
        timestamp: ts
    };
}

function makeFact(key: string): Signal {
    return {
        id: `f_${key}_${Date.now()}`,
        key,
        type: "custom",
        mode: "fact",
        timestamp: Date.now()
    };
}

describe("FlowEngine - Phase 3.9 Frozen Spec", () => {

    // ---------------------------
    // 1. 启动行为
    // ---------------------------
    it("INIT: should start at first unresolved step", () => {
        const engine = createEngine();

        expect(engine.currentStep.id).toBe("1");
        expect(engine.currentStep.activatedAt).toBeDefined();
    });

    // ---------------------------
    // 2. Event 推进
    // ---------------------------
    it("EVENT: should advance step when event matches current step", () => {
        const engine = createEngine();

        engine.ingest(makeEvent("a"));

        expect(engine.currentStep.id).toBe("2");
    });

    // ---------------------------
    // 3. 时间隔离（核心）
    // ---------------------------
    it("EVENT: should ignore stale event (timestamp < activatedAt)", () => {
        const engine = createEngine();

        const barrier = engine.currentStep.activatedAt!;

        engine.ingest({
            id: "old_event",
            key: "a",
            type: "interaction",
            mode: "event",
            timestamp: barrier - 100
        });

        expect(engine.currentStep.id).toBe("1");
    });

    // ---------------------------
    // 4. Fact 自动跳跃
    // ---------------------------
    it("FACT: should skip steps if fact already exists", () => {
        const engine = createEngine();

        engine.ingest(makeFact("b"));

        expect(engine.currentStep.id).toBe("1");

        engine.ingest(makeEvent("a"));

        expect(engine.currentStep.id).toBe("3");
    });

    // ---------------------------
    // 5. recompute 幂等性
    // ---------------------------
    it("RECOMPUTE: should be idempotent under repeated fact ingestion", () => {
        const engine = createEngine();

        engine.ingest(makeFact("b"));
        engine.ingest(makeFact("b"));
        engine.ingest(makeFact("b"));

        expect(engine.currentStep.id).toBe("1");
    });

    // ---------------------------
    // 6. 多 step 连跳（fact驱动）
    // ---------------------------
    it("CHAIN: should support multi-step skip via recompute", () => {
        const engine = createEngine();

        engine.ingest(makeFact("b"));
        engine.ingest(makeFact("c"));

        engine.ingest(makeEvent("a"));

        expect(engine.currentStep.id).toBe("3");
    });

    // ---------------------------
    // 7. revert 行为
    // ---------------------------
    it("REVERT: should reset position and re-evaluate", () => {
        const engine = createEngine();

        engine.ingest(makeEvent("a"));
        expect(engine.currentStep.id).toBe("2");

        engine.revert(0);

        expect(engine.currentStep.id).toBe("1");
    });

    // ---------------------------
    // 8. revert + 历史信号隔离
    // ---------------------------
    it("REVERT: should not be affected by old signals", () => {
        const engine = createEngine();

        const t1 = Date.now();

        engine.ingest({
            id: "old",
            key: "a",
            type: "interaction",
            mode: "event",
            timestamp: t1
        });

        engine.revert(0);

        const barrier = engine.currentStep.activatedAt!;

        engine.ingest({
            id: "ghost",
            key: "a",
            type: "interaction",
            mode: "event",
            timestamp: barrier - 100
        });

        expect(engine.currentStep.id).toBe("1");
    });

    // ---------------------------
    // 9. fact + event 并发语义
    // ---------------------------
    it("CONCURRENCY: fact + event ordering should be stable", () => {
        const engine = createEngine();

        const now = Date.now();

        engine.ingest({
            id: "event",
            key: "a",
            type: "interaction",
            mode: "event",
            timestamp: now
        });

        engine.ingest({
            id: "fact",
            key: "b",
            type: "custom",
            mode: "fact",
            timestamp: now
        });

        expect(engine.currentStep.id).toBe("3");
    });

});
