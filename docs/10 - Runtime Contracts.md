# 10 - Runtime Contracts

## 1. 文件定位

这份文档只记录“当前已经被代码与测试共同锁定的运行时契约”。

它的目标不是讲设计理想，而是把最容易回归、最值得兜底的路径讲清楚。

如果某个行为这里写了，意味着：

- 当前实现依赖它
- 测试已经在兜它
- 后续改动如果改变了它，应该被当成行为变更处理

## 2. 持久化 key 与完成标记

### 2.1 默认 persistence key 派生规则

当使用：

- `createFlowPilotFromDefinition(...)`
- `createFlowPilotAsync(...)`

并且：

- `runtime.persistence.enabled === true`
- 没有显式传入 `runtime.persistence.key`

当前会自动派生：

`flowpilot:${guideId}`

例如：

- `guide.billing` -> `flowpilot:guide.billing`

### 2.2 持久化内容

当前 persistence 至少会使用两类 localStorage key：

- 主 key：保存已完成 step id 列表
- `${key}_finished`：保存整条 flow 是否已完成

### 2.3 finished marker 的启动语义

如果 `GuideController.start()` 发现：

- persistence 开启
- `${key}_finished === "true"`

它会直接返回，不再重新进入引导。

所以“完成过一次且未清缓存”的 guide，默认是不可重复自动启动的。

## 3. `autoStart` 的两层语义

当前存在两个同名但不同层级的概念。

### 3.1 Session / Registry 层 `autoStart`

用于决定：

- `open(...)` 后要不要自动调用 `controller.start()`

如果这里传 `autoStart: false`，controller 会被创建出来，但不会自动启动。

### 3.2 Runtime 配置层 `config.runtime.autoStart`

用于决定：

- `controller.start()` 之后，如果 runtime 还没有激活步骤，是否补发内部 `start` signal

它并不负责创建 controller，也不负责替代 session 层的自动启动。

## 4. `enterWhen` 与 pending 语义

### 4.1 父步骤完成，不等于子步骤立刻 active

当前只要 step 有 `enterWhen`，就存在这样的可能：

- 父步骤已经完成
- 子步骤已经进入 `pendingSteps`
- 但它还不在 `activeSteps`

也就是说：

- `pending` 不是“即将马上显示”
- 它表示“流程上已可到达，但还没真正进入活跃态”

### 4.2 pending 阶段不会提前启动激活后 timer

当前最关键的契约之一是：

- 一个带 `enterWhen` 的 step
- 在仅仅处于 pending、尚未真正 active 时
- 不会因为时间流逝就触发“激活后的 cancelWhen / timer 逻辑”

换句话说：

- timeout 以激活时刻为时间锚点
- 不是以父步骤完成时刻，也不是以持久化恢复时刻为锚点

### 4.3 激活前的信号不会被当成激活后的完成证据

对于依赖“激活后时间窗口”的条件，当前契约是：

- step 真正 active 之前到来的 signal
- 不应被拿来当成该 step 激活后的完成证据

这也是为什么：

- 恢复到 pending 的 step
- 必须等重新满足 `enterWhen`
- 之后再来一份新的业务 signal

才能继续完成。

## 5. persistence + `enterWhen` + timer 的恢复契约

当前测试已经锁住下面这条路径：

1. 某个 step 因 persistence 被恢复成“已完成”
2. 其后继 step 因 `enterWhen` 只进入 pending
3. runtime 重启后，pending step 仍然保持 pending
4. 在它重新 active 之前，timer 不应提前跑掉
5. 只有重新满足 `enterWhen` 后，才重新开始该 step 的超时窗口

这条契约是当前最容易回归的路径之一。

## 6. revert 契约

### 6.1 `runtime.revert(stepId)`

当前行为优先级是：

1. 先从 trace 中倒序找最近一次 `STEP_COMPLETE(stepId)`
2. 找到后直接回溯到那个完成时间点
3. 如果找不到，再回退到引擎内部的 `engine.revert(stepId)` 逻辑

也就是说，这个 API 更偏“按时间线里的最近一次完成事件回退”。

### 6.2 `runtime.revertToTime(targetTs)`

当前行为是：

- 只保留 `timestamp <= targetTs` 的 signal 历史
- 用 replay 链路重建 state
- 再重新调度 timer 与状态广播

如果当前 runtime 是从 persistence 恢复出来的，并且：

- `targetTs >= persistedRestoredAtTs`

那么 replay 时还会重新 bootstrap 已恢复的 persistence baseline。

### 6.3 `runtime.revertToStep(stepId)`

当前语义不是“回到 step 完成时”，而是：

- 回到该 step 第一次 `STEP_ACTIVATE` 的时间点

如果 trace 里没找到这个激活事件：

- 会打印 warning
- 并回到时间起点 `0`

## 7. revert 后的 gated timer 重建契约

当前测试已经覆盖下面这条路径：

1. 某个带 `enterWhen` 的 step 已经 active
2. 它的取消窗口已经部分流逝
3. 发生 `revertToTime(...)`
4. 该 step 回到 pending，而不是继续保持 active
5. 此时旧 timer 不应继续“偷偷倒计时”
6. 只有等它重新满足 `enterWhen` 后，timer 才重新开始

因此：

- revert 不是简单把 activeSteps 改回去
- 它必须连同激活时间锚点和 timer 一起重建

## 8. 会话切换与异步竞态契约

### 8.1 新 guide 打开时，旧 guide 会先 teardown

`GuideSessionManager.open(...)` 当前保证：

- 新 guide 创建前，会先清掉当前 guide

### 8.2 后发起的异步 open 胜出

如果出现这种情况：

- 第一次 `open(...)` 还在等异步 source
- 第二次 `open(...)` 又开始了

当前契约是：

- 后发起的那次调用获胜
- 旧的异步结果即使晚点返回，也会被销毁
- 那次 `open(...)` 的返回值会是 `null`

这是为了避免页面上被“过期 guide”重新覆盖当前状态。

## 9. 自动销毁与清缓存契约

### 9.1 `destroyOnComplete`

当 session / registry 打开 guide 时传入：

- `destroyOnComplete: true`

那么 guide 完成后，当前 controller 会被自动 destroy。

### 9.2 `clearCacheOnDestroy`

如果同时配置：

- `clearCacheOnDestroy: true`

那么自动销毁时，也会一并清掉：

- persistence 主 key
- `${key}_finished`

这条契约保证了“完成即销毁后还能重新打开同一条 guide”。

## 10. 同名插件覆盖契约

当前插件合并已经被测试锁住：

- 默认插件与用户插件 `name` 相同
- 用户插件覆盖默认插件

这条规则适用于：

- preset + user plugin
- registry 默认插件 + open 时临时插件

因此：

- 如果你想替换内置 logger / tracking 行为
- 优先复用同一个 `name`

而不是去改动整套 preset 结构。

## 11. DevTools 的权威重建链路

当前 DevTools 不再单独维护一套平行的状态推导逻辑。

它的契约是：

- 先读取真实 runtime 的 trace 与 signals
- 再通过共享 replay 链路重建 shadow engine

所以 DevTools 当前展示的状态，应该尽量与 runtime 的 replay 语义保持同源，而不是各算各的。
