// src/sdk/types/condition.ts

export type ConditionType = "event" | "and" | "or" | "sequence" | "not" | "after";

export interface EventCondition {
    type: "event";
    key: string;

    // DSL 扩展参数
    count?: number;        // 至少发生 N 次
    within?: number;       // 在时间窗口内 (ms)
    afterStep?: string;    // 时间锚点覆盖

    once?: boolean;         // 仅生效一次（严格排他）
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

// 逻辑非
export interface NotCondition {
    type: "not";
    condition: Condition; // 支持嵌套，如 !(a && b)
}

// 显式时间锚点
export interface AfterCondition {
    type: "after";
    stepId: string; // 必须在某个特定的 Step 完成后
}

export interface DiagnosticNode {
    type: ConditionType;
    passed: boolean;
    reason?: string;
    details?: {
        current?: number;
        required?: number;
        elapsed?: number;
        limit?: number;
        [key: string]: any;
    };
    children?: DiagnosticNode[];
}

// 暴露出最终的联合类型
export type Condition =
    | EventCondition
    | AndCondition
    | OrCondition
    | SequenceCondition
    | NotCondition
    | AfterCondition;
