# 07 - Implementation Contract

## 0. 目标

这份文档不是历史设想，而是当前实现的约束说明。
如果文档与代码冲突，以当前代码导出的真实行为为准，并优先修正文档。

## 1. 当前架构分层

当前更准确的结构是：

```text
[ Signal Sources / Plugins ]
            ↓
[ FlowRuntime.dispatch ]
            ↓
[ FlowEngine ]
            ↓
[ SignalStore + Derived Indexes + Trace ]
            ↓
[ Guide / Renderer / DevTools / UI ]
```

其中：

- 采集层负责生成 Signal
- Runtime 负责统一入口、插件、定时器、持久化和订阅
- Engine 负责状态推进
- Guide / UI 层负责展示，不直接修改引擎内部状态

## 2. 当前允许的数据流

### 合法主链路

```text
DOM / Axios / Business / Internal Guide Action
                    ↓
               dispatch(signal)
                    ↓
                 Runtime
                    ↓
                 Engine
                    ↓
         Store / Index / Trace / State
                    ↓
              Guide / DevTools / UI
```

### 明确不允许

- UI 直接写 `SignalStore`
- UI 直接改 `FlowState`
- 业务直接依赖 Engine 内部集合做写操作
- 采集层绕过 Runtime 直接驱动 Engine

## 3. Signal 契约

### 当前公共入口

对外合法入口是：

```ts
runtime.dispatch(signal)
```

对插件合法入口是：

```ts
ctx.dispatch(signal)
```

`engine.ingest(signal)` 视为内部实现接口。

### Signal 最小有效结构

```ts
{
  id: string,
  key: string,
  timestamp: number
}
```

`type`、`payload`、`meta` 当前是可选扩展字段。

## 4. 采集层契约

### DOM

当前内置 DOM 采集规则是：

- 查找 `config.runtime.attributeName`
- 默认值是 `data-fp`
- 不再是旧文档里的 `data-guide-id`

### 网络

当前内置网络采集来自 `AxiosPlugin`，通过响应拦截器把业务结果映射成 Signal。

### 手动业务信号

当前没有 `FlowPilot.signal()` 这类全局 API。
若业务需要手动发信号，应通过 `runtime.dispatch(...)` 或插件上下文 dispatch。

### 当前未内置

- Navigation route 模板化
- 通用浏览器 history 采集

这些不应被当作当前默认能力。

## 5. Step 契约

当前合法 Step 结构包括：

- `id`
- `when`
- `next`
- `enterWhen`
- `cancelWhen`

这意味着当前系统已经不是“Step 只能由单 key 完成”的旧模型。
`when` 可以是字符串 DSL，也可以是 AST。

## 6. 状态契约

当前权威状态集合是：

- `pendingSteps`
- `activeSteps`
- `completedSteps`
- `cancelledSteps`

而不是旧版只包含 `active/completed` 的二元状态。

## 7. Runtime 与多 Guide 契约

### 单 Runtime

单个 `FlowRuntime` / `GuideController` 只承载一条 flow 实例。

### 多 Guide

当前项目已经支持多 guide，但方式是：

- `GuideSessionManager`
- `createGuideRegistryService`

也就是说：

> 多 guide 是 session 层能力，不是单个 Engine 同时跑多条流程。

当前一个 session manager 同一时刻只维护一个当前 controller。

## 8. Persistence 契约

当前持久化保存的是：

- `completedStepIds`
- `finished flag`

不是完整 signal history。

因此恢复语义是“恢复流程进度 baseline”，不是“完整恢复所有历史上下文”。

## 9. Revert 契约

当前合法回溯接口是：

- `runtime.revert(stepId)`
- `runtime.revertToTime(targetTs)`
- `runtime.revertToStep(stepId)`

当前行为是：

- 截断时间线
- 重建状态
- 重建索引
- 重建 timer

而不是简单地把某个 step 重新设成 active。

## 10. DevTools 契约

当前 DevTools 不能依赖另一份独立的派生状态当真相。
它必须基于：

1. Runtime trace
2. Runtime signals
3. `FlowReplayer.replay(...)`

来重建 shadow engine。

这是当前“单权威链路”的实现约束。

## 11. Fail Fast 契约

以下配置问题当前应尽早失败：

- DAG cycle
- dangling step reference
- 缺失 timestamp 的 signal

这类错误应该尽量在构造期或 ingest 期暴露，而不是默默吞掉。

## 12. 性能契约

当前实现已经不是“简单线性即可”的阶段，至少已经包括：

- `SignalStore.seen`
- `factMap`
- `eventIndex`
- `lowerBound` 二分查找

但当前仍未做：

- signal GC
- 长历史增量压缩
- 持久化完整 trace / history

## 13. 当前一句话总结

> FlowPilot 当前是一套以 `dispatch(signal)` 为唯一信号入口、以 DAG 和时间语义驱动步骤推进、并通过 session 与 replay 扩展上层能力的运行时系统。
