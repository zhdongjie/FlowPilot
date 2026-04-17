# 04 - Engine Runtime (v1.6 Temporal Engine)

## 1. 概述
FlowEngine 演进为基于 **事件溯源 (Event Sourcing)** 的确定性时序状态机。它不维护可变的业务状态，而是通过单向投影不可变的历史信号流 (Signal Stream) 来推导出当前的并发步骤状态。

## 2. 内部状态 (Engine State)
引擎维护的状态完全基于集合与绝对时间戳，保证极简与纯函数特性：

```typescript
private state = {
    activeSteps: new Set<string>(),      // 当前活跃节点
    completedSteps: new Set<string>(),   // 已完成节点
    activatedAt: new Map<string, number>(), // 步骤进入活跃状态的时间戳
    completedAt: new Map<string, number>()  // 步骤判定为完成的时间戳
};
```

## 3. 推进逻辑 (The Evaluate Loop)
每当通过 `ingest(signal)` 注入带有时间戳的合法信号时，引擎会执行递归评估循环 (`evaluateLoop`)，直到状态不再发生任何变化 (收敛)：

1. **时间过滤 (Cutoff Firewall)**：检查信号的 `timestamp` 是否晚于当前步骤的 `cutoff` 时间（默认为该步骤的 `activatedAt`，或由 `afterStep` 指定的祖先激活时间）。
2. **条件求值 (AST Evaluation)**：深度优先遍历 `Condition` 树。对于底层的 `event` 判定，引擎会检索 `SignalStore` 中符合时间防线要求的记录。
3. **拓扑迁移 (Topology Migration)**：若某活跃步骤求值为 `true`：
    - 记录其 `completedAt` 为当前驱动引擎的信号时间戳。
    - 将其移入 `completedSteps`。
    - 遍历其 `next` 节点，将未完成且未活跃的子节点加入 `activeSteps`，并以**当前信号的时间戳**作为新步骤的 `activatedAt` 激活起点。

## 4. 确定性重算 (Deterministic Recompute)
系统强制要求所有输入的 Signal 必须具备绝对 `timestamp`，以保证严格的确定性：`Same Events + Same Steps = Same State`。
- **执行方式**：引擎清空所有内存状态集合，将 Store 中的信号按时间戳正序排序后，以 `timestamp = 0` 的基准重新模拟单步注入。

## 5. 绝对时间切片回滚 (Time-Slice Revert)
回滚不再是简单的指针跳转或状态强行修改，而是**时间维度的降维截断**。

- **物理语义**：`revert(stepId)` 的本质是“回溯到该目标步骤成为既定事实（完成）的那一时空节点”。
- **执行过程**：
    1. 从 `completedAt` 中获取该目标步骤精确的完成时间戳 `targetTs`。
    2. 对 `SignalStore` 进行时间切片：丢弃所有 `timestamp > targetTs` 的“未来信号”。
    3. 触发确定性重算 (`Recompute`)。
- **结果**：系统完美且一致地恢复到目标步骤刚刚完成、后续步骤刚刚被激活等待用户交互的历史瞬间，彻底斩断未来事件的污染。
