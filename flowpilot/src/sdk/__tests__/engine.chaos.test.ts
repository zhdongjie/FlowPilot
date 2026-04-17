import { describe, it, expect } from "vitest";
import { FlowEngine } from "../core/engine";
import type { Step } from "../types/step";

describe("FlowEngine v1.1 - Chaos & Robustness Tests", () => {

    const generateSteps = (): Step[] => [
        { id: "1", complete: "a" },
        { id: "2", complete: "b" },
        { id: "3", complete: "c" }
    ];

    it("Chaos 1: 疯狂连击（Idempotency Spam）- 引擎必须具备天然幂等性", () => {
        const engine = new FlowEngine(generateSteps());
        const spamTime = Date.now() + 10;

        // 模拟用户在 1 毫秒内疯狂点击了 100 次按钮
        for (let i = 0; i < 100; i++) {
            engine.ingest({
                id: `spam_${i}`,
                key: "a",
                type: "interaction",
                mode: "event",
                timestamp: spamTime
            });
        }

        // 验证：无论发多少次，Step 1 只会被跨越一次，绝对不能因为相同的事件意外冲到 Step 3
        expect(engine.currentStep.id).toBe("2");
    });

    it("Chaos 2: 噪音注入（Garbage Noise）- 引擎必须对无关信号完全免疫", () => {
        const engine = new FlowEngine(generateSteps());

        // 注入一大堆系统中根本不存在的脏事件和脏事实
        engine.ingest({ id: "noise1", key: "unknown_click", type: "interaction", mode: "event", timestamp: Date.now() });
        engine.ingest({ id: "noise2", key: "x", type: "custom", mode: "fact", timestamp: Date.now() });
        engine.ingest({ id: "noise3", key: "undefined_hover", type: "interaction", mode: "event", timestamp: Date.now() });

        // 验证：引擎如磐石般不动，死死卡在 Step 1
        expect(engine.currentStep.id).toBe("1");
    });

    it("Chaos 3: 时空错乱（Future Event Leakage）- 未来的事件绝不能污染当前等待", () => {
        const engine = new FlowEngine(generateSteps());

        // 场景：引擎刚启动，卡在 Step 1。
        // 此时，系统因为某些 BUG（比如提前渲染了下一步的 DOM），意外发出了 Step 2 的 Event。
        const prematureTime = Date.now() + 10;
        engine.ingest({
            id: "future_event",
            key: "b",
            type: "interaction",
            mode: "event",
            timestamp: prematureTime
        });

        // 验证 1：提前发出的 Event 不能让引擎推进（它现在需要的是 "a"）
        expect(engine.currentStep.id).toBe("1");

        // 后来，用户终于老老实实完成了 Step 1
        engine.ingest({
            id: "correct_event",
            key: "a",
            type: "interaction",
            mode: "event",
            timestamp: Date.now() + 20
        });

        // 验证 2（最核心的防御）：
        // 当引擎推进到 Step 2 时，它会自动重新 activateStep() 更新时间戳。
        // 那个过早触发的 "future_event" 因为 timestamp < Step 2 真正的 activatedAt，
        // 将被「时间隔离机制」完美拦截！引擎绝不会因为历史脏数据自动跳过 Step 2。
        expect(engine.currentStep.id).toBe("2");
    });

    it("Chaos 4: 并发碰撞（Simultaneous Event & Fact Tick）- 处理顺序决议", () => {
        const engine = new FlowEngine(generateSteps());
        const now = Date.now() + 10;

        // 场景：在同一个系统 Tick 内，既触发了当前步的 Event，又推入了下一步的 Fact。
        // 这在异步回调（比如 Promise.all 之后）极其常见。
        engine.ingest({ id: "e", key: "a", type: "interaction", mode: "event", timestamp: now });
        engine.ingest({ id: "f", key: "b", type: "custom", mode: "fact", timestamp: now });

        // 验证：引擎必须能正确解析这种并发流。
        // 1. Event "a" 推倒了 Step 1。
        // 2. 紧接着 Fact "b" 触发全量重算。
        // 3. 稳稳落在 Step 3。不会发生死锁或状态丢失。
        expect(engine.currentStep.id).toBe("3");
    });

    it("Spec 5: Revert（回滚）必须利用时间隔离，免疫历史残影", () => {
        const engine = new FlowEngine([
            { id: "1", complete: "a" },
            { id: "2", complete: "b" }
        ]);

        // 1. 正常推进到 Step 2
        engine.ingest({ id: "e1", key: "a", type: "interaction", mode: "event", timestamp: Date.now() });
        expect(engine.currentStep.id).toBe("2");

        // 2. 用户点击了“上一步”，回滚到 Step 1
        engine.revert(0);
        expect(engine.currentStep.id).toBe("1");

        // 记录此时的时间屏障
        const newBarrier = engine.currentStep.activatedAt!;

        // 3. 极其凶险的场景：
        // 假设因为网络延迟，用户之前在 Step 1 狂点的历史事件，现在才回调并进入引擎！
        engine.ingest({
            id: "ghost_event",
            key: "a",
            type: "interaction",
            mode: "event",
            timestamp: newBarrier - 100 // 这个事件发生在时间屏障之前
        });

        // 验证：引擎如泰山般安稳！
        // 即使 "a" 是当前 Step 1 需要的 Key，但因为它是过去的残影（timestamp < activatedAt），
        // 引擎绝对不会被它二次推进！
        expect(engine.currentStep.id).toBe("1");
    });
});
