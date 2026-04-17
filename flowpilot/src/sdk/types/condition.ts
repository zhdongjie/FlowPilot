// src/sdk/types/condition.ts

export interface EventCondition {
    type: "event";
    key: string;

    // DSL 扩展参数
    count?: number;        // 至少发生 N 次
    within?: number;       // 在时间窗口内 (ms)
    afterStep?: string;    // 时间锚点覆盖
}

export interface AndCondition {
    type: "and";
    conditions: Condition[];
}

export interface OrCondition {
    type: "or";
    conditions: Condition[];
}

export interface SequenceCondition {
    type: "sequence";
    keys: string[];

    // DSL 扩展参数
    within?: number;        // 整个序列必须在基准时间后的 N ms 内完成
    afterStep?: string;     // 时间锚点覆盖
}

// 暴露出最终的联合类型
export type Condition =
    | EventCondition
    | AndCondition
    | OrCondition
    | SequenceCondition;
