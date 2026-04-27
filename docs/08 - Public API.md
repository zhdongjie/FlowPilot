# 08 - Public API

## 1. 文件定位

这份文档专门回答一个问题：

当前 FlowPilot 已经对外暴露了哪些入口，分别适合在什么层级使用。

它不是运行时语义文档，也不是设计意图文档。
如果你关心的是：

- 条件判定、回放、回溯、timer 语义
- pending / active / completed / cancelled 的状态流转

请优先看：

- [03 - Step & Flow Model](./03%20-%20Step%20%26%20Flow%20Model.md)
- [04 - Engine Runtime](./04%20-%20Engine%20Runtime.md)
- [10 - Runtime Contracts](./10%20-%20Runtime%20Contracts.md)

## 2. 推荐入口分层

当前公开 API 可以粗分为三层：

### 2.1 业务接入层

优先使用这些入口：

- `createFlowPilot(options)`
- `createFlowPilotFromDefinition(options)`
- `createFlowPilotAsync(options)`
- `GuideSessionManager`
- `createGuideRegistryService(options)`

这层 API 负责把：

- guide 配置
- 预设插件 / 用户插件
- runtime 配置
- 多 guide 生命周期

收敛成适合业务系统直接接入的能力。

### 2.2 运行时控制层

进阶场景可以直接使用：

- `GuideController`
- `FlowRuntime`

这层适合：

- 需要自己控制 start / stop / destroy
- 需要直接 dispatch 自定义 signal
- 需要读 trace / signals / debug snapshot

### 2.3 底层引擎层

更底层的导出包括：

- `FlowEngine`
- `FlowParser`

它们更适合：

- 底层引擎调试
- DevTools / replay / 单元测试
- 编译 DSL 或验证条件树

一般业务接入不建议直接从这一层开始。

## 3. 核心数据结构

### 3.1 `GuideDefinition`

`GuideDefinition` 是当前最重要的对外配置结构。

它至少包含：

- `id`
- `rootStepId`
- `steps`
- `config?`

其中：

- `id` 会作为 guide 实例的逻辑标识
- 当 persistence 开启且没有显式 key 时，它也会参与生成默认持久化 key
- `config` 是 guide 级别的配置覆盖，会在工厂层与外部传入配置合并

### 3.2 `GuideSource`

`GuideSource` 当前支持三种形态：

- 直接传一个 `GuideDefinition`
- 传一个 `Promise<GuideDefinition>`
- 传一个 `() => GuideDefinition | Promise<GuideDefinition>`

也就是说，静态 TS、静态 JSON、异步请求，最后都可以被统一解析成同一种 guide 定义。

当前实现里，`resolveGuideDefinition(source)` 会在解析后 clone 一份 definition。
这意味着调用方原始对象不会被 runtime 直接就地改写。

### 3.3 `GuideStepUI`

常用字段包括：

- `selector`
- `content`
- `position`
- `nextLabel`

当前行为约定：

- `nextLabel` 为字符串时，直接使用这个字符串
- `nextLabel === true` 时，使用 `config.ui.defaultNextLabel`
- `nextLabel` 缺省或为 `false` 时，不显示按钮

需要注意：

- `title` 字段当前存在于类型定义中
- 但当前 renderer 只消费 `content`，并没有真正渲染 `title`

因此 `title` 现在更像“已声明但未接线完成”的字段，而不是稳定可依赖的渲染能力。

## 4. Guide 创建入口

### 4.1 `createFlowPilot(options)`

适合：

- guide steps 直接写在业务代码里
- 不需要单独维护 `GuideDefinition`

最低必要参数：

- `steps`
- `rootStepId`

可选参数：

- `guideId`
- `preset`
- `plugins`
- `config`

返回值是一个 `GuideController`。

### 4.2 `createFlowPilotFromDefinition(options)`

适合：

- 已经有完整的 `GuideDefinition`
- 希望 guide 配置与业务接入代码解耦

输入：

- `definition`
- `preset?`
- `plugins?`
- `config?`

行为上，它会把：

- `definition.config`
- 调用方传入的 `config`

合并后再创建 `GuideController`。

### 4.3 `createFlowPilotAsync(options)`

适合：

- guide 需要异步加载
- 后续准备从 mock 切到真实接口

输入：

- `source`
- `preset?`
- `plugins?`
- `config?`

它会先 `resolveGuideDefinition(source)`，再走 `createFlowPilotFromDefinition(...)`。

## 5. `GuideController`

`GuideController` 是单条 guide 的总控对象。

当前最重要的公开成员有：

- `guideId`
- `config`
- `runtime`
- `start()`
- `stop()`
- `isFinished()`
- `destroy(options?)`

### 5.1 `start()`

`start()` 会做两件事：

1. 启动 `FlowRuntime`
2. 启动 UI 编排层 `GuideOrchestrator`

当前还有两个容易忽略的行为：

- 如果 persistence 开启，且 `${persistence.key}_finished` 已经是 `"true"`，`start()` 会直接返回，不再重新进入引导
- 如果 `config.runtime.autoStart === true`，并且 runtime 启动后没有立刻激活任何步骤，controller 会补发一个内部 `start` signal

所以：

- Session 层的 `autoStart` 决定“open 完后要不要自动调用 `controller.start()`”
- Runtime 配置里的 `autoStart` 决定“`start()` 之后要不要自动补一发 `start` 信号”

这是两层不同的概念。

### 5.2 `destroy(options?)`

当前支持：

- `destroy()`
- `destroy({ clearCache: true })`

当 `clearCache` 为 `true` 时，会同时清掉：

- persistence 主 key
- `${key}_finished` 完成标记

## 6. `GuideSessionManager`

`GuideSessionManager` 负责“同一时刻只维护一个 guide controller”。

当前公开 API：

- `open(options)`
- `closeCurrent()`
- `destroyCurrent(options?)`
- `getCurrent()`
- `getCurrentGuideId()`

### 6.1 `open(options)`

`open` 支持三种输入风格：

- 直接传 `steps + rootStepId`
- 传 `definition`
- 传 `source`

并额外支持生命周期选项：

- `autoStart?`
- `destroyOnComplete?`
- `clearCacheOnDestroy?`

当前运行契约：

- 每次 `open(...)` 前，都会先 teardown 当前 guide
- 如果两个异步 `open(...)` 发生竞态，后发起的调用获胜
- 先返回的旧 controller 会被销毁，并让 `open(...)` 返回 `null`

### 6.2 `closeCurrent()` 与 `destroyCurrent()`

区别是：

- `closeCurrent()` 只 stop 当前 guide，不清理缓存
- `destroyCurrent()` 会 destroy 当前 guide，并可选择 `clearCache`

## 7. `createGuideRegistryService(options)`

当一个系统里有多条 guide，并且只允许按 id 打开其中一条时，更推荐直接用 registry service。

当前公开 API：

- `list()`
- `get(id)`
- `open(id, options?)`
- `closeCurrent()`
- `destroyCurrent(options?)`
- `getCurrent()`
- `getCurrentGuideId()`

### 7.1 注册表项

每个 guide entry 至少包含：

- `id`
- `source`
- `config?`

### 7.2 配置合并顺序

当前实现里，registry 打开 guide 时的 config 合并顺序是：

1. service 级 `options.config`
2. guide entry 自己的 `guide.config`
3. `open(id, options)` 这一轮调用传入的 `options.config`

越靠后优先级越高。

### 7.3 插件合并顺序

当前实现里，插件合并遵循两个规则：

- service 默认插件在前
- 当前 `open(...)` 额外传入的插件在后
- 如果插件 `name` 相同，后者覆盖前者

也就是说，业务调用方可以通过“同名插件覆盖”替换默认实现。

## 8. `FlowRuntime`

`FlowRuntime` 是单 guide 的运行时内核，负责把：

- plugin pipeline
- persistence
- timer scheduling
- revert / replay
- state subscription

串起来。

当前常用公开 API：

- `start()`
- `stop()`
- `destroy(options?)`
- `dispatch(signal)`
- `subscribe(callback)`
- `revert(stepId)`
- `revertToTime(targetTs)`
- `revertToStep(stepId)`
- `clearCache()`
- `reset()`
- `isFinished()`
- `debug()`

以及只读接口：

- `activeSteps`
- `completedSteps`
- `getTraceStream()`
- `getSignals()`
- `getEngineConfig()`
- `getConfig()`

推荐把这层 API 当作“进阶控制接口”。
普通业务接入仍优先从 `GuideController` 或 registry service 开始。

## 9. `FlowEngine` 与 `FlowParser`

### 9.1 `FlowEngine`

`FlowEngine` 负责：

- signal ingest
- 条件判定
- 状态流转
- replay / revert
- trace 输出

它是 runtime 的核心，但通常不直接暴露给业务页面使用。

### 9.2 `FlowParser`

`FlowParser` 负责把 DSL 字符串解析成 condition AST。

适合：

- 底层调试
- 编译结果验证
- DSL 测试

## 10. 当前“已声明但不建议当稳定能力依赖”的字段

下面这些内容当前已经出现在导出类型或代码里，但文档需要明确降级说明：

### 10.1 `GuideStepUI.title`

- 类型里已声明
- 当前 renderer 不消费

### 10.2 `once(...)` / `EventCondition.once`

- parser 可以解析 `once(...)`
- 条件类型里也有 `once?: true`
- 但当前 condition compiler 没有针对 `once` 做特殊执行语义

因此不要把它当成已经完成的稳定 DSL 能力。

### 10.3 部分插件 hook

类型协议里存在这些 hook：

- `onPause`
- `onResume`
- `onStepStart`
- `onStepComplete`

但当前 runtime 并没有主动调度它们。
所以它们更像协议预留位，而不是当前已经稳定触发的运行时事件。

### 10.4 `AxiosPluginOptions.enableErrorHook` / `timeout`

- 这两个字段现在存在于类型里
- 但当前 `AxiosPlugin` 实现并没有消费它们

如果后面要真正开放这两个选项，建议先补实现，再把 README / docs 升级为正式能力说明。
