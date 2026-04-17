// src/sdk/__tests__/model/consistency.test.ts

import { describe, it, expect } from "vitest";
import { FlowEngine } from "../../core/engine";
import type { Step, Signal } from "../../types";

/**
 * 辅助函数：生成符合 v1.5 规范的 Signal
 */
function sig(key: string, ts: number): Signal {
    return {
        // 使用固定的 ID 或可预测的 ID 以测试幂等性
        id: `sig_fixed_id_${key}`,
        key,
        timestamp: ts
    };
}

describe("Consistency Layer (v1.5 DAG Implementation)", () => {

    it("should be idempotent under duplicate ingestion", () => {
        // 1. 适配新版 Step 结构与 Condition
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" },
                next: ["2"]
            },
            {
                id: "2",
                when: { type: "event", key: "b" }
            }
        ];

        // 2. 构造函数传入 rootStepId
        const engine = new FlowEngine(steps, "1");

        const s = sig("a", 1);

        // 3. 连续注入完全相同的信号对象
        engine.ingest(s);
        engine.ingest(s);
        engine.ingest(s);

        // 验证状态：由于幂等性，Step 1 应只完成一次，Step 2 被激活
        expect(engine.getCompletedSteps()).toContain("1");
        expect(engine.getCompletedSteps()).toHaveLength(1);
        expect(engine.getActiveSteps()).toContain("2");
    });

    it("should maintain deterministic ordering under same inputs", () => {
        const steps: Step[] = [
            {
                id: "1",
                when: { type: "event", key: "a" },
                next: ["2"]
            },
            {
                id: "2",
                when: { type: "event", key: "b" }
            }
        ];

        // 创建两个独立的引擎实例
        const engine1 = new FlowEngine(structuredClone(steps), "1");
        const engine2 = new FlowEngine(structuredClone(steps), "1");

        // 生成两组 ID 相同但实例不同的信号
        const signals = [
            { id: "id_1", key: "a", timestamp: 1 },
            { id: "id_2", key: "b", timestamp: 2 }
        ];

        signals.forEach(s => {
            engine1.ingest(s);
            engine2.ingest(s);
        });

        // 验证确定性：两个引擎的活跃步骤与完成步骤集合必须完全一致
        expect(engine1.getActiveSteps()).toEqual(engine2.getActiveSteps());
        expect(engine1.getCompletedSteps()).toEqual(engine2.getCompletedSteps());
    });

});
