# FlowPilot SDK - Core Principles

## 1. 核心目标

FlowPilot 的核心目标只有一个：

> 在前端系统中，基于可追踪的信号流，判断用户是否完成了某个步骤，以及当前流程推进到了哪里。

它不是单纯的浮层组件，而是一套围绕“步骤推进”组织起来的运行时。

## 2. 当前代码中的职责边界

### SDK负责

- 接收并处理语义化 Signal
- 维护 append-only 的信号历史
- 基于条件树推进步骤状态
- 处理 `enterWhen`、`cancelWhen`、`timer(...)` 等时间和门控语义
- 提供重放、回溯、持久化恢复、定时器重建能力
- 提供 Guide、Session、Registry、DevTools 这些上层能力

### SDK不负责

- 不替业务决定接口是否成功，除非业务或插件显式把结果转换成 Signal
- 不做表单校验
- 不理解 DOM 的业务语义
- 不维护后端业务状态
- 当前没有内置 Navigation 采集插件

## 3. 核心原则

### 原则1：Signal First

引擎只认 Signal，不直接认 DOM、按钮、接口或页面名称。
步骤是否完成，取决于条件树在当前时间语义下是否成立。

### 原则2：语义必须显式存在

没有语义化 key，就不应该生成 Signal。
SDK 当前允许通过配置属性名、插件提取器或手动 dispatch 明确提供语义，但不鼓励从 `innerText`、样式或 DOM 结构推断语义。

### 原则3：历史优先于可变状态

当前实现以信号历史为基础，再由引擎维护派生索引和步骤状态。
这让重放、回溯和 DevTools 调试都建立在同一条事实链路上。

### 原则4：流程模型是 DAG，不是单指针 FSM

当前实现允许：

- 多个步骤同时处于 `active`
- 后继步骤先进入 `pending`，等待 `enterWhen`
- 分支被 `cancelWhen` 主动切断

所以“同一时间只有一个 ACTIVE Step”的旧说法已经不适用。

### 原则5：确定性优先

Signal 必须带绝对时间戳。
在相同步骤定义和相同信号历史下，重放结果必须一致。

### 原则6：回溯是时间切片，不是硬改状态

当前实现的回溯语义不是“把状态改回去”，而是：

1. 截断目标时间之后的信号
2. 重建引擎状态
3. 重建定时器和派生索引

### 原则7：一条 Runtime 对应一条 Flow

单个 `FlowRuntime` / `GuideController` 只承载一条 guide 实例。
如果一个系统里有多条 guide，需要通过 `GuideSessionManager` 或 `createGuideRegistryService` 在更外层做切换和销毁。

## 4. 当前系统本质

> FlowPilot 是一套 signal-driven、time-aware、DAG-based 的步骤运行时。
