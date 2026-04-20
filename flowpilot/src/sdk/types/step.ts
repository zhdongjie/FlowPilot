// src/sdk/types/step.ts

import type { Condition } from "./condition";
import type { CompiledCondition } from "./runtime";

export interface Step {
    id: string;

    /**
     * 完成条件（Condition 逻辑树）
     * 不再是简单的字符串匹配，支持并发/组合判定
     */
    when: Condition | string;

    /**
     * 后继节点 ID 列表
     * 用于描述图（DAG）的边关系
     */
    next?: string[];

    /**
     * 如果存在，即使父节点完成，该节点也会处于 idle 状态，
     * 直到 enterWhen 满足，才真正进入 activeSteps
     */
    enterWhen?: Condition | string;

    /**
     * 在 active 期间，如果满足该条件，节点直接失效（移出 activeSteps）
     * 且不会触发 next，相当于切断了该分支的执行流
     */
    cancelWhen?: Condition | string;

    compiledWhen?: CompiledCondition;

    compiledEnterWhen?: CompiledCondition;

    compiledCancelWhen?: CompiledCondition;

}

export interface ParsedStep extends Step {
    when: Condition;
    enterWhen?: Condition;
    cancelWhen?: Condition;
}
