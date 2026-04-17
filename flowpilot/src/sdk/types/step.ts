// src/sdk/types/step.ts

export type Condition =
    | { type: "event"; key: string; afterStep?: string }
    | { type: "and"; conditions: Condition[] }
    | { type: "or"; conditions: Condition[] };

export interface Step {
    id: string;

    /**
     * 完成条件（Condition 逻辑树）
     * 不再是简单的字符串匹配，支持并发/组合判定
     */
    when: Condition;

    /**
     * 后继节点 ID 列表
     * 用于描述图（DAG）的边关系
     */
    next?: string[];
}
