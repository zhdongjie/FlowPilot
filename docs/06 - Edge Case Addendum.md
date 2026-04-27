# 06 - Edge Case Addendum

## 1. 不再使用旧的 `facts: Set` 模型

当前代码已经不再以 `facts: Set<string>` 作为权威存储结构。

真实实现是：

- `SignalStore` 保存 append-only 的 `events`
- `FlowEngine` 基于历史信号维护 `factMap` 和 `eventIndex`

因此，旧文档中“Fact 生命周期 = Flow 生命周期”的说法不再适合作为实现描述。

更准确的说法是：

> 当前系统把“某个 key 是否已经发生过”视为从信号历史推导出来的派生结果。

## 2. 重复信号如何处理

当前 `SignalStore` 会基于 `signal.id` 去重。

这意味着：

- 同一个 `id` 重复 dispatch，不会重复写入历史
- 不同 `id` 但相同 `key` 的信号，会被当作多次发生

这对 `count(...)`、`within(...)` 这类条件很重要。

## 3. Revert 的真实语义

当前回溯不是“把步骤状态改回去”，而是：

1. 找到目标时间点
2. 截断未来信号
3. 重建状态
4. 重建索引
5. 重建 timer

因此当前正确理解应该是：

> Revert 是 time-slice rebuild，不是 mutable state patch。

## 4. 历史事件为什么不会污染当前步骤

当前实现有两层防线：

### 4.1 时间切片

回溯到某个时间点时，未来信号会被截断，不再进入重建后的历史。

### 4.2 激活时间切口

即使某个 key 在更早之前出现过，步骤求值也会基于：

- 当前 step 的 `activatedAt`
- 或 `afterStep` 指向的时间锚点

来决定哪些历史信号对当前步骤仍然有效。

## 5. `cancelWhen` 与 `when` 同时成立怎么办

当前实现中，`cancelWhen` 优先于 `when`。

也就是说，如果同一轮求值里两者都为真：

- 步骤会进入 `cancelled`
- 不会被标记为 `completed`

这属于当前运行时的重要边界条件。

## 6. `enterWhen` + persistence 的恢复语义

当前持久化恢复不是把完整历史信号重放回来，而是恢复已完成步骤 baseline。

这意味着：

- 恢复后，某些后继步骤可能重新出现在 `pending`
- 仍然要等待新的 `enterWhen` 成立，才会真正进入 `active`

这正是最近组合测试重点兜住的路径之一。

## 7. timer 在 revert / replay 后如何处理

当前系统会在以下场景重建 timer：

- Runtime 启动
- Revert 后
- Replay / DevTools 重建 shadow engine 后

只有仍然处于当前有效时间线、且仍在 `active` 的步骤，相关 timer 才会继续生效。

## 8. 流程完成与 finished 标记

当前 Runtime 的完成条件不是“某个终点步骤完成”，而是：

- `activeSteps` 为空
- `pendingSteps` 为空
- `completedSteps` 非空

一旦完成，若开启持久化，会额外写入：

```ts
${persistence.key}_finished = "true"
```

## 9. 当前持久化边界

当前只持久化：

- `completedStepIds`
- `finished flag`

当前不会持久化：

- 原始 Signal 历史
- `eventIndex`
- `factMap`
- trace

因此跨页面恢复更像“基于已完成步骤恢复流程位置”，而不是“完整恢复调试现场”。

## 10. 当前性能边界

当前实现已经用索引避免了纯 O(n) 的全量扫描，但仍有几个边界：

- 原始历史仍会增长
- 回溯和 replay 仍以重建为主
- 没有 signal GC
- 超大历史下仍需后续增量优化

## 11. 当前一句话结论

> FlowPilot 当前依赖“append-only signal history + derived indexes + time-slice rebuild”来保证步骤推进的可解释性与一致性。
