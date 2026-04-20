// src/sdk/types/runtime.ts

/**
 * 时间轴索引项
 */
export interface IndexedEvent {
    ts: number;
    id: string;
}

/**
 * 引擎执行闭包时的“富上下文”环境 (Rich Context)
 * 将引擎的状态只读地注入给闭包
 */
export interface EvalContext {
    factMap: Map<string, number>;
    eventIndex: Map<string, IndexedEvent[]>;
    activatedAt: Map<string, number>;
    completedSteps: Set<string>;

    currentStepId: string;
    currentEventTs: number;

    // 提供二分查找工具函数给闭包使用
    lowerBound: (list: IndexedEvent[], target: number) => number;
}

/**
 * 预编译后的条件闭包，极速 O(1) 调用
 */
export type CompiledCondition = (ctx: EvalContext) => boolean;
