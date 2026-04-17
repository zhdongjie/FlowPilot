// src/sdk/__tests__/killer/temporal.killer.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Signal, Step } from "../../types";

function sig(key: string, ts: number): Signal {
    return {
        id: `sig_${key}_${ts}_${Math.random().toString(36).substring(7)}`,
        key,
        timestamp: ts
    };
}

describe("FlowEngine Killer Tests (Phase 1+3: Temporal & Safety)", () => {

    /**
     * 🔪 Killer Test 1: 严格时序语义 (Strict Local Time)
     * 验证：发生在步骤激活之前的“早产信号”必须被忽略，防止用户乱点历史按钮污染当前流程。
     */
    it("Temporal: should IGNORE premature signals that occurred before step activation", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" } }
        ];
        // A 的激活时间戳被定为 0
        const engine = new FlowEngine(steps, "A");

        // 1. 捣乱：用户一上来就提前触发了 b (ts=100)
        engine.ingest(sig("b", 100));

        // 2. 正常流程：用户完成了 a (ts=200)
        engine.ingest(sig("a", 200));

        // 此时 A 完成，B 被激活。B 继承了激活时间基准线 ts=200。
        // 因为之前的 b 发生在 ts=100，小于 200，被 Temporal 逻辑无情拦截！
        expect(engine.getCompletedSteps()).toContain("A");
        expect(engine.getCompletedSteps()).not.toContain("B"); // B 被拦住了
        expect(engine.getActiveSteps()).toContain("B"); // B 仍在等待合法的 b

        // 3. 用户在 B 激活后，老老实实触发了 b (ts=300)
        engine.ingest(sig("b", 300));

        // 300 >= 200，有效！B 完成。
        expect(engine.getCompletedSteps()).toContain("B");
    });

    /**
     * 🔪 Killer Test 2: 自定义时间窗口 (afterStep Override)
     * 验证：通过 afterStep，可以让步骤继承之前某个祖先节点的时间线，实现“回顾历史事实”。
     */
    it("Temporal: should ACCEPT historical signals if explicitly defined in afterStep", () => {
        const steps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            // B 的任务比较长
            { id: "B", when: { type: "event", key: "b" }, next: ["C"] },
            // C 只需要确认 x 发生过，且只要在流程启动 (A 激活) 之后发生的 x 都算数
            { id: "C", when: { type: "event", key: "x", afterStep: "A" } }
        ];
        const engine = new FlowEngine(steps, "A"); // A 的激活时间 = 0

        engine.ingest(sig("a", 100)); // A 完成，B 激活 (基准线=100)

        // 在 B 进行期间，用户做了一个支线操作 x (ts=150)
        engine.ingest(sig("x", 150));

        engine.ingest(sig("b", 200)); // B 完成，C 激活 (本来基准线应为200)

        // 验证：虽然 x(150) 发生在 C 激活(200) 之前，
        // 但 C 声明了 afterStep="A" (基准线=0)。因为 150 >= 0，判定通过！C 会自动连跳完成。
        expect(engine.getCompletedSteps()).toContain("C");
        expect(engine.getActiveSteps()).toHaveLength(0);
    });

    /**
     * 🔪 Killer Test 3: 静态拓扑防火墙 (Static DAG Validation)
     * 验证：彻底堵死烂配置，不给它们进入引擎运转的机会。
     */
    it("Safety: should CRASH instantly upon initialization if DAG is invalid", () => {

        // 场景 1：悬空指针 (Dangling Pointer)
        const danglingSteps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["GHOST_STEP"] }
        ];

        expect(() => {
            new FlowEngine(danglingSteps, "A");
        }).toThrowError(/Dangling reference/);

        // 场景 2：无限环路 (Cyclic Dependency)
        const cyclicSteps: Step[] = [
            { id: "A", when: { type: "event", key: "a" }, next: ["B"] },
            { id: "B", when: { type: "event", key: "b" }, next: ["C"] },
            { id: "C", when: { type: "event", key: "c" }, next: ["A"] } // 致命回旋
        ];

        expect(() => {
            new FlowEngine(cyclicSteps, "A");
        }).toThrowError(/Cycle detected/);
    });

});
