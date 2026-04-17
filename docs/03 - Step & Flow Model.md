# 03 - Step & Flow Model (v1.6 Temporal DAG)

## 1. 概述
在 v1.6 版本中，FlowPilot 的流程模型从早期的线性有限状态机 (Linear FSM) 彻底升级为**有向无环图 (DAG) 与并发逻辑状态机**。Step 不再是简单的线性节点，而是支持逻辑组合判定和多路径分发的条件节点。

## 2. Step 定义 (强约束)

Step 的定义涵盖了节点的唯一标识、完成条件的逻辑树，以及图拓扑的边关系。

```typescript
export interface Step {
    id: string;

    /**
     * 完成条件 (Condition 逻辑树)
     * 支持 event, and, or 以及时间约束 afterStep
     */
    when: Condition;

    /**
     * 后继节点 ID 列表 (描述 DAG 边关系)
     * 允许一个步骤完成后同时激活多个后续步骤
     */
    next?: string[];
}
```

## 3. Condition 逻辑树
条件不再是单一的 Signal Key 字符串，而是一棵支持深层嵌套的抽象语法树 (AST)。

```typescript
export type Condition =
    | { type: "event"; key: string; afterStep?: string }
    | { type: "and"; conditions: Condition[] }
    | { type: "or"; conditions: Condition[] };
```

## 4. 强约束规则
- **并发激活 (Concurrency)**：系统天然支持并允许多个步骤同时处于活跃状态。
- **逻辑收敛 (Convergence)**：通过 `and` 类型条件，可以实现 DAG 中多个并行分支在某一节点的安全汇聚判定。
- **时间隔离 (Temporal Isolation)**：默认情况下，步骤的 `event` 判定只接受发生在其**激活时间**之后的信号。可通过显式指定 `afterStep` 约束来打破此限制并继承祖先节点的时间线。

## 5. Step 状态模型
不再使用单一的 `currentIndex` 指针，状态由两个动态集合共同定义：
- **`activeSteps: Set<string>`**：当前已被激活，正在等待条件满足的步骤集合。
- **`completedSteps: Set<string>`**：历史中已成功达成 `when` 条件的步骤集合。

## 6. DAG 执行语义
- **激活 (Activate)**：当一个步骤的父节点全部完成，或作为流程的根节点启动时，它进入 `activeSteps`，并记录其处于活跃状态的时间戳 `activatedAt`。
- **完成 (Complete)**：当 `when` 条件的逻辑树在当前时间线约束下求值为 `true`，步骤移出 `activeSteps`，进入 `completedSteps`，并记录其完成的精确时间戳 `completedAt`。
