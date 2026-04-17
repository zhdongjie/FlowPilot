# FlowPilot SDK - Engine Runtime v1.1
## 1. 概述
FlowEngine 是系统的核心状态机。它负责接收 Signal，并根据当前 Step 的配置及信号的时间戳，严格按单向顺序推进流程。Engine 不直接操作 UI。

## 2. 内部状态 (Engine State)
引擎维护的内部状态极简，核心是引入了时间隔离机制：

```ts
private state = {
    currentIndex: 0,
    activatedAt: new Map<number, number>() // 记录每个步骤激活的具体时间戳
};
```

## 3. 推进校验规则 (Transition Rules)
当引擎通过 `ingest(signal)` 接收到信号时，必须同时满足以下两个条件才会执行推进 (`advance`)：

1. **键值匹配**：`signal.key === currentStep.complete`。
2. **时间防线校验**：`signal.timestamp >= this.state.activatedAt.get(currentIndex)`。
    * *目的*：防止用户在旧步骤中产生的积压或延迟信号，错误地触发新步骤的完成条件。

## 4. 事实补算机制 (Projection Trigger)
推进到新步骤后，引擎会触发连环校验：
1. 更新新步骤的 `activatedAt` 时间。
2. 调用 Projection 层查询已有的时间轴日志 (`store.getEvents()`)。
3. 若新步骤的 `complete` 信号在历史记录中已存在，则引擎自动完成补算，直接跳入下一步。

## 5. 重建与回滚策略
基于时间隔离的纯事件流架构，状态干预策略如下：

* **重算 (Recompute)**：清空当前 `currentIndex` 与时间轴配置，将 Store 中的历史 Signal 依据时间戳排序后重新执行 `ingest`，以确保状态百分百确定。
* **回滚 (Revert)**：系统不删除 Store 中的历史 Signal。当执行回滚到指定 `index` 时：
    1. 重置 `currentIndex` 到目标索引。
    2. 将该步骤的 `activatedAt` 刷新为当前时间 (`Date.now()`)。
    3. 清理后续步骤的激活时间记录。
    * *结果*：通过更新时间戳防线，使过去的无效事件自动被引擎的时间校验规则拦截。
