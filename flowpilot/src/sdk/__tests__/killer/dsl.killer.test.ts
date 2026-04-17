// src/sdk/__tests__/killer/dsl.killer.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Signal, Step } from "../../types";

function sig(key: string, ts: number): Signal {
    return { id: `sig_${key}_${ts}_${Math.random()}`, key, timestamp: ts };
}

describe("FlowEngine Killer Tests (Phase 11: Condition DSL v1)", () => {

    it("count & sliding window: should require multiple events and handle noise", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a", count: 3, within: 50 } }
        ];
        const engine = new FlowEngine(steps, "A"); // A at 0ms

        engine.ingest(sig("a", 100)); // 噪点，虽然发生早，但后续接不上
        engine.ingest(sig("a", 300));
        engine.ingest(sig("a", 320));

        expect(engine.getCompletedSteps()).toHaveLength(0); // 还没满 3 次

        // 300, 320, 340 这连续的三次正好在 50ms 的滑动窗口内 (340-300=40)
        engine.ingest(sig("a", 340));

        expect(engine.getCompletedSteps()).toContain("A");
    });

    it("within: should enforce time window relative to activation cutoff", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a", within: 50 } } // 必须在 50ms 内响应
        ];
        const engine = new FlowEngine(steps, "A"); // A 激活在 0ms

        engine.ingest(sig("a", 100)); // 超时了 (100 > 50)
        engine.ingest(sig("a", 200)); // 继续超时

        expect(engine.getCompletedSteps()).toHaveLength(0); // 永远无法完成
    });

    it("sequence: should strictly require ordered events and prevent timestamp reuse", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "sequence", keys: ["a", "b", "c"] } }
        ];
        const engine = new FlowEngine(steps, "A");

        // 乱序注入：先 c, 再 a, 再 b
        engine.ingest(sig("c", 100));
        engine.ingest(sig("a", 200));
        engine.ingest(sig("b", 300));

        // a 和 b 有了，但 c 在 100ms 发生，不符合 a->b->c 的顺序
        expect(engine.getCompletedSteps()).toHaveLength(0);

        // 补上一个在 b 之后的 c
        engine.ingest(sig("c", 400));

        expect(engine.getCompletedSteps()).toContain("A"); // 序列达成！
    });

});
