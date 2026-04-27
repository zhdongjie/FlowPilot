# 09 - Plugin System

## 1. 文件定位

这份文档专门描述 FlowPilot 当前插件系统的真实行为。

它关注的是：

- 插件怎么接到 runtime 上
- 插件执行顺序怎么决定
- 哪些 hook 当前真的会触发
- 内置插件各自负责什么

如果你更关心的是 guide 配置和业务入口，请先看：

- [08 - Public API](./08%20-%20Public%20API.md)

## 2. 插件在运行时里的位置

当前 runtime 链路可以简化理解为：

`signal source -> plugin onSignal middleware -> FlowEngine -> runtime state change -> render / flow-complete hooks`

插件系统主要承担四类职责：

- 采集 signal
- 拦截 / 过滤 signal
- 在状态变化后做副作用
- 挂接调试工具或外部集成

## 3. 注册、覆盖与顺序

### 3.1 同名覆盖

当前插件系统默认以 `name` 作为唯一键。

无论是在：

- preset + user plugin 合并
- runtime / session / registry 中再次注册

只要插件 `name` 相同，后注册者都会覆盖前注册者。

这条规则直接支撑了一个常见用法：

- SDK 给一套默认插件
- 业务方只替换其中某一个实现

而不需要把整套 preset 拆开重写。

### 3.2 priority 排序

插件最终会按 `priority` 从大到小排序。

也就是说：

- 数值越大，越先执行
- 如果没写，默认按 `0` 处理

当前内置插件里：

- `AxiosPlugin` 是 `10`
- `DOMPlugin` 是 `5`
- `LoggerPlugin` 是 `0`

## 4. 当前真正生效的 hook

下面这些 hook 是当前 runtime 确实会调度的：

- `setup(ctx)`
- `onSignal(signal, ctx)`
- `onStart(ctx)`
- `onStop(ctx)`
- `onRender(ctx)`
- `onFlowComplete(ctx)`
- `onDispose(ctx)`
- `onError(error, ctx)`

### 4.1 `setup(ctx)`

适合做资源初始化：

- 监听 DOM 事件
- 注册 axios 拦截器
- 挂载调试面板

当前实现保证同一个插件实例的 `setup` 只执行一次。

### 4.2 `onSignal(signal, ctx)`

这是 signal 中间件链。

当前行为：

- 所有插件按顺序依次执行
- 任何一个插件返回 `false`，这条 signal 就会被熔断
- 被熔断后，不会进入 `FlowEngine.ingest(...)`

如果插件在 `onSignal` 里抛错：

- 错误会被捕获
- runtime 会尝试触发 `onError`
- 其他插件和主流程不会因此整体崩掉

### 4.3 `onStart(ctx)` / `onStop(ctx)`

这两个 hook 当前由 `FlowRuntime.start()` 和 `FlowRuntime.stop()` 触发。

适合：

- 打日志
- 启动或停止外围观察逻辑
- 同步业务层状态

### 4.4 `onRender(ctx)`

当前每次 runtime 状态变化后都会触发 `onRender(ctx)`。

它更适合：

- DevTools 同步
- 调试面板刷新
- 状态快照观察

不建议把很重的异步逻辑塞进这里。

### 4.5 `onFlowComplete(ctx)`

整条 flow 完成时触发。

当前契约：

- 完成后只会发一次
- 如果之后发生 revert / reset 使流程重新回到未完成态，这个“已上报”状态会被清掉
- 再次完整完成时，可以再次触发

### 4.6 `onDispose(ctx)`

适合释放资源：

- 移除 DOM 监听
- eject axios interceptor
- 销毁调试面板

## 5. 当前协议里存在、但 runtime 还没有正式调度的 hook

类型协议里还有这些字段：

- `onPause`
- `onResume`
- `onStepStart`
- `onStepComplete`

当前要特别说明：

- 它们已经在 `FlowPlugin` 类型里声明
- 但当前 runtime 并没有稳定调度这些 hook

所以：

- 可以把它们视为协议预留位
- 不建议业务逻辑把它们当成已实现能力依赖

同样，`plugin.state` 目前更多是内部状态字段，不建议把它当成稳定对外契约。

## 6. 插件上下文 `FlowPluginContext`

插件当前能拿到的上下文包括：

- `runtime`
- `engine`
- `config`
- `getState()`
- `now()`
- `dispatch(signal)`
- `emit(event, payload?)`
- `on(event, callback)`

### 6.1 `dispatch(signal)`

允许插件主动补发 signal。

例如：

- `AxiosPlugin` 在响应成功后补发业务 signal
- 业务自定义插件在外部 SDK 回调里补发 signal

### 6.2 `emit/on`

这是插件之间的轻量事件总线。

适合：

- 插件间通信
- DevTools 或 UI 扩展之间的局部联动

它不是业务级全局 event bus，更适合当前 runtime 内部协作。

## 7. 内置插件说明

## 7.1 `DOMPlugin`

职责：

- 监听 DOM 交互
- 将交互转换成 signal

当前监听事件：

- `click`
- `focusin`
- `focusout`
- `input`

当前查找规则：

- 从事件目标开始向上冒泡查找
- 找到带有 `config.runtime.attributeName` 属性的元素就停止
- 默认属性名是 `data-fp`

默认 signal 前缀来自：

- `runtime.signalPrefix.click`
- `runtime.signalPrefix.focus`
- `runtime.signalPrefix.blur`
- `runtime.signalPrefix.input`

默认前缀分别是：

- `click_`
- `focus_`
- `blur_`
- `input_`

signal 的 `meta` 当前会附带：

- `tagName`
- `value`

## 7.2 `LoggerPlugin`

职责：

- 输出运行时日志

当前支持的参数：

- `prefix?`
- `ignoreNoise?`
- `showTiming?`

行为上：

- `ignoreNoise` 默认为 `true`
- 会默认忽略高频 `focus_` / `blur_` / `input_` 噪音日志
- `showTiming` 开启时，会记录 step 启动到完成的耗时

## 7.3 `AxiosPlugin`

职责：

- 从 axios 响应里抽取业务 signal

当前工作方式：

- 注册 response interceptor
- 默认优先使用 `extractor(response)` 的返回值
- 如果没有 extractor 返回值，则回退到 `response.data.code`

如果最终拿到了 key，就会补发 signal，并在 `meta` 中带上：

- `url`
- `method`

当前实现要注意两点：

- 只对成功响应路径做 signal 提取
- `enableErrorHook` 和 `timeout` 虽然存在于类型中，但当前实现没有真正消费

## 7.4 `DevToolsPlugin`

职责：

- 挂接调试控制器
- 挂载 DevTools 面板

当前实现里：

- 插件初始化时会创建 `FlowDevTools`
- 再创建 panel 并 mount
- dispose 时会 unmount panel 并 disconnect devtools

它更适合开发环境，而不是默认假设生产环境长期打开。

## 8. 预设插件集 `PluginPresets`

当前内置 preset 有三组：

### 8.1 `PluginPresets.WEB_DEFAULT`

包含：

- `DOMPlugin()`
- `LoggerPlugin({ prefix: "FlowPilot" })`
- `DevToolsPlugin()`

### 8.2 `PluginPresets.TRACKING_ONLY`

包含：

- `DOMPlugin()`

### 8.3 `PluginPresets.HEADLESS`

包含：

- 空插件集

适合：

- 只要引擎，不要内置 DOM / UI / 调试能力
- 用于测试、无头环境或自定义集成

## 9. 推荐使用方式

如果你只是业务接入：

- 优先用 preset
- 只在确实有需要时用同名插件覆盖默认插件

如果你是在扩 SDK：

- 先决定插件是“采集型”“渲染型”还是“调试型”
- 再选择挂在 `onSignal`、`onRender` 还是 `setup/onDispose`

如果你要依赖某个 hook 做正式业务语义：

- 先确认这个 hook 是当前 runtime 真的会调度的
- 不要只因为类型里声明了它，就默认它已经是稳定契约
