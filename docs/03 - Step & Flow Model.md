# 03 - Step & Flow Model

## 1. 概述

当前 FlowPilot 的流程模型已经不是线性 FSM，而是带时间语义的 DAG。
步骤既可以并发存在，也可以在 `pending`、`active`、`completed`、`cancelled` 之间流转。

## 2. 当前 Step 结构

```ts
export interface Step {
    id: string;
    when: Condition | string;
    next?: string[];
    enterWhen?: Condition | string;
    cancelWhen?: Condition | string;
}
```

其中：

- `when`
  步骤完成条件
- `next`
  后继步骤列表
- `enterWhen`
  父步骤完成后，步骤先进入 `pending`，满足该条件后才转入 `active`
- `cancelWhen`
  步骤处于 `active` 期间，若满足该条件则直接被取消，不触发完成

## 3. 当前 Condition 模型

```ts
export type Condition =
    | EventCondition
    | AndCondition
    | OrCondition
    | SequenceCondition
    | NotCondition
    | AfterCondition;
```

当前支持的核心语义：

- `event`
- `and`
- `or`
- `sequence`
- `not`
- `after`

`event` 节点当前还支持这些修饰字段：

- `count`
- `within`
- `afterStep`
- `once`

## 4. DSL 与 AST 的关系

外部可以直接传 AST，也可以传 DSL 字符串。
当前 Parser 支持的典型语法包括：

- `a && b`
- `a || b`
- `!a`
- `a within(2000)`
- `count(login_success, 3)`
- `seq(a, b, c, 5000)`
- `after(step_login)`
- `timer(3000)`

其中 `timer(...)` 是 DSL 语法糖，底层仍然会被编译进当前条件系统和调度器，不作为单独公开的 Condition 类型暴露。

## 5. 当前状态模型

当前 `FlowState` 由以下集合与时间戳映射组成：

```ts
activeSteps: Set<string>
pendingSteps: Set<string>
completedSteps: Set<string>
cancelledSteps: Set<string>
activatedAt: Map<string, number>
completedAt: Map<string, number>
```

这比旧文档中的 `active + completed` 二元模型更完整，也更贴近当前实现。

## 6. 当前流转语义

### 根步骤启动

- `rootStepId` 在初始化时先进入 `pending`
- 如果没有 `enterWhen` 拦截，会立即转成 `active`

### `pending -> active`

- 由 `enterWhen` 控制
- 如果没有 `enterWhen`，步骤会直接激活

### `active -> cancelled`

- `cancelWhen` 优先级高于 `when`
- 一旦命中，步骤进入 `cancelled`
- 当前实现不会把它视为完成

### `active -> completed`

- `when` 条件成立时，步骤进入 `completed`
- 记录 `completedAt`
- 它的后继步骤会被放入 `pending`

## 7. 并发与收敛

当前实现允许：

- 一个步骤同时扩散出多个 `next`
- 多个步骤同时处于 `active`
- 汇聚节点通过 `and` 或 `sequence` 安全收敛

因此当前模型是“并发 DAG 状态机”，而不是“单 currentIndex 顺序推进”。

## 8. 流程结束条件

当前 Runtime 认为流程结束的条件是：

- `activeSteps` 为空
- `pendingSteps` 为空
- `completedSteps` 非空

也就是说，流程结束不只看“有没有 active step”，还要看是否还有待激活的 `pending` 步骤。
