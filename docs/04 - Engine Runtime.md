# 04 - Engine Runtime

## 1. 概述

当前 Runtime 由以下几部分协作完成：

- `FlowRuntime`
- `FlowEngine`
- `SignalStore`
- `TimerScheduler`
- `PluginManager`
- `Trace / Replay / DevTools`

其中真正负责步骤推进的是 `FlowEngine`，`FlowRuntime` 负责把插件、持久化、定时器调度、外部订阅和回溯接口串起来。

## 2. 当前内部状态

### FlowState

```ts
activeSteps: Set<string>
pendingSteps: Set<string>
completedSteps: Set<string>
cancelledSteps: Set<string>
activatedAt: Map<string, number>
completedAt: Map<string, number>
```

### 派生索引

```ts
factMap: Map<string, number>
eventIndex: Map<string, IndexedEvent[]>
```

### 信号历史

```ts
SignalStore.events: Signal[]
SignalStore.seen: Set<string>
```

## 3. 当前推进循环

当 `FlowRuntime.dispatch(signal)` 放行后，会进入 `FlowEngine.ingest(signal)`。
当前执行过程可以概括为：

1. 校验 `timestamp`
2. 写入 `SignalStore`
3. 更新 `factMap` 和 `eventIndex`
4. 以当前时间戳驱动 `evaluateLoop`
5. 在循环中先处理 timer，再处理 `pending`、`active`
6. 如果状态发生变化，则继续收敛，直到没有新的 patch

## 4. 当前状态迁移顺序

### `processPendingSteps`

- 为每个 `pending` step 创建求值上下文
- 若没有 `enterWhen`，或 `enterWhen` 为真，则转入 `active`

### `processActiveSteps`

当前优先级是：

1. `cancelWhen`
2. `when`

也就是说，若某个步骤在同一轮里同时满足取消和完成条件，当前实现优先视为取消。

## 5. 时间语义

当前引擎的时间能力主要体现在：

- `activatedAt`
- `completedAt`
- `afterStep`
- `within`
- `sequence`
- `timer(...)`

`eventIndex` 会为每个 key 维护按时间排序的索引，`lowerBound` 用于高效查找切片起点，而不是每次全量扫描历史事件。

## 6. Timer 与心跳

当前实现中：

- `TimerScheduler` 维护未来到期任务
- `FlowRuntime.scheduleNext()` 只调度最近的下一个 timer
- timer 到期后，Runtime 会调用 `engine.tick(next.ts)`
- 只有当前仍处于 `active` 的步骤，其定时任务才会真正生效

这保证了回溯、取消和步骤切换后，不会错误消费旧 timer。

## 7. 确定性重放

当前引擎仍然坚持：

> Same steps + same ordered signals => same state

这体现在几个方面：

- Signal 必须带时间戳
- 历史信号按时间排序后可重放
- 回溯不是原地改状态，而是重建
- DevTools 阴影引擎也走同一条 replay 链路

## 8. 当前回溯语义

### `runtime.revert(stepId)`

优先基于 trace 找到该步骤最近一次 `STEP_COMPLETE` 的时间戳，再回溯到那个时间点。

### `runtime.revertToTime(targetTs)`

当前语义是：

1. 截断未来信号
2. 重建引擎状态
3. 在需要时恢复持久化基线
4. 重建定时器
5. 重新广播状态

### `runtime.revertToStep(stepId)`

当前实现会优先找该步骤的 `STEP_ACTIVATE` 事件；如果找不到，则回退到起点。

## 9. 当前持久化模型

当前 Runtime 持久化的不是完整信号历史，而是：

- `completedSteps`
- `finished flag`

即：

```ts
localStorage[persistence.key] = JSON.stringify(completedStepIds)
localStorage[`${persistence.key}_finished`] = "true"
```

启动时，Runtime 会尝试把这些已完成步骤恢复成 baseline，再由后续交互继续推进。

## 10. DevTools 当前链路

当前 DevTools 已被收敛成一条权威链路：

1. 读取 Runtime trace
2. 收集真实 signals
3. 通过 `FlowReplayer.replay(...)` 重建 shadow engine
4. 用 shadow engine 做诊断和时间回放

这意味着 DevTools 不再依赖额外的派生状态副本作为真相来源。

## 11. 当前性能边界

已经具备的优化：

- 去重 `seen`
- `factMap`
- `eventIndex`
- 二分查找 `lowerBound`

当前仍然保留的边界：

- 原始信号历史不做 GC
- Replay / Revert 仍是“重建优先”策略
- 超大规模历史下仍需后续增量优化
