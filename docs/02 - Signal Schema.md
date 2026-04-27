# 02 - Signal Schema

## 1. 概述

Signal 是 FlowPilot 中唯一的输入数据结构。
无论信号来自 DOM、Axios 响应、内部按钮还是手动 dispatch，最终都要收敛到同一种结构后进入 Runtime。

当前实现采用 append-only 模型：

- Signal 进入 `FlowRuntime.dispatch`
- 经过插件链过滤
- 写入 `SignalStore`
- 由 Engine 更新派生索引并推进步骤状态

## 2. 当前数据结构

```ts
export type SignalType = "interaction" | "navigation" | "custom";

export interface Signal {
    id: string;
    key: string;
    type?: SignalType;
    timestamp: number;
    payload?: any;
    meta?: Record<string, any>;
}
```

## 3. 字段语义

### `id`

- 用于幂等去重
- 当前 `SignalStore` 会基于 `id` 拦截重复信号
- 相同 `id` 的信号不会重复写入历史

### `key`

- 语义化键值
- 例如：`click_login_btn`、`login_success`、`click_next_step_form_overview`
- 条件树匹配主要依赖它

### `type`

- 当前是可选字段
- 引擎推进并不依赖 `type`
- 内置 `DOMPlugin` 和 `AxiosPlugin` 目前都可能只填写 `key`、`timestamp` 和 `meta`

### `timestamp`

- 当前实现中的强制字段
- 引擎要求每个 Signal 都带绝对时间戳
- 用于时间隔离、定时器、回溯、重放和确定性重算

### `payload` / `meta`

- 用于业务附加信息和调试信息
- 当前引擎不直接依赖这些字段做步骤推进
- `DOMPlugin` 会在 `meta` 中带上 `tagName`、`value`
- `AxiosPlugin` 会在 `meta` 中带上 `url`、`method`

## 4. 当前实现的信号历史模型

`SignalStore` 当前只保存一份 append-only 的事件历史：

```ts
class SignalStore {
  private events: Signal[] = [];
  private readonly seen = new Set<string>();
}
```

它不再维护文档旧版本里的 `facts: Set<string>` 结构。

## 5. 派生索引

当前 Engine 会基于信号历史维护两类派生索引：

- `factMap: Map<string, number>`
  用于统计某个 key 出现的次数
- `eventIndex: Map<string, IndexedEvent[]>`
  用于按 key 建立时间有序索引，支撑 `within`、`count`、`sequence` 等条件

这些索引是从信号历史推导出来的，不是额外的权威数据源。

## 6. 关于 `mode`

旧文档里的 `mode: "event" | "fact"` 已经不再是当前实现的一部分。

当前代码的语义是：

- 所有输入统一先作为 Signal 历史写入
- “是否可作为事实存在”与“是否满足时间窗口”由 Engine 在求值时解释
- 条件匹配依赖时间切片、计数、序列和逻辑树，不依赖显式 `mode`

## 7. 当前信号示例

### DOM 采集

```ts
{
  id: "sig_1710000000000_xxx",
  key: "click_login_btn",
  timestamp: 1710000000000,
  meta: {
    tagName: "BUTTON",
    value: ""
  }
}
```

### Axios 响应提取

```ts
{
  id: "net_1710000001000_abcd",
  key: "login_success",
  timestamp: 1710000001000,
  meta: {
    url: "/api/login",
    method: "post"
  }
}
```

### 手动 dispatch

```ts
{
  id: "manual_1",
  key: "profile_save_success",
  timestamp: Date.now(),
  payload: {
    source: "business"
  }
}
```

## 8. 当前权威结论

- Signal 是唯一输入模型
- `timestamp` 是强约束
- `id` 用于去重
- `key` 是步骤推进的核心语义键
- `mode` 不再属于当前实现
