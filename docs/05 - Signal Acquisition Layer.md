# 05 - Signal Acquisition Layer

## 1. 核心职责

采集层的职责不是推进流程，而是把外部事件转换成标准 Signal，并统一送入 Runtime。

当前项目中，采集层并不是单一模块，而是由多种来源共同组成：

- `DOMPlugin`
- `AxiosPlugin`
- 手动 `runtime.dispatch(...)`
- 插件上下文中的 `ctx.dispatch(...)`
- Guide 内部按钮触发的内部 Signal

## 2. 当前唯一合法入口

对于外部世界来说，当前真正的信号入口是：

```ts
FlowRuntime.dispatch(signal)
```

对插件来说，对应入口是：

```ts
ctx.dispatch(signal)
```

`FlowEngine.ingest(signal)` 属于引擎内部路径，不应被当作业务层直接入口。

## 3. 当前内置采集源

### 3.1 DOMPlugin

`DOMPlugin` 当前监听这些事件：

- `click`
- `focusin`
- `focusout`
- `input`

它会从事件目标开始，沿父节点向上查找，直到 `document.body`，寻找配置项 `runtime.attributeName` 对应的属性。

默认配置下：

```ts
runtime.attributeName = "data-fp"
```

所以当前默认写法是：

```html
<button data-fp="login_btn">
```

生成信号时会自动拼接事件前缀，例如：

- `click_`
- `focus_`
- `blur_`
- `input_`

因此上面的按钮点击后，默认会生成：

```ts
{
  id: "sig_xxx",
  key: "click_login_btn",
  timestamp: Date.now(),
  meta: {
    tagName: "BUTTON",
    value: ""
  }
}
```

### 3.2 AxiosPlugin

`AxiosPlugin` 当前通过响应拦截器工作。

它会：

1. 从响应中提取业务 key
2. 默认优先取 `extractor(response)` 的结果
3. 否则退回到 `response.data.code`
4. 将 key 转成小写后 dispatch

示例：

```ts
{
  id: "net_xxx",
  key: "login_success",
  timestamp: Date.now(),
  meta: {
    url: "/api/login",
    method: "post"
  }
}
```

### 3.3 手动业务信号

当前并没有一个公开的 `FlowPilot.signal()` 全局 API。
如果业务确实需要手动发信号，当前合法方式是：

```ts
controller.runtime.dispatch({
  id: "manual_1",
  key: "profile_save_success",
  timestamp: Date.now()
})
```

或在插件里使用：

```ts
ctx.dispatch(signal)
```

### 3.4 Guide 内部信号

Guide 层当前也会注入内部信号。
例如点击引导气泡“下一步”按钮时，会自动发出：

```ts
click_next_<activeStepId>
```

这也是当前 demo 中“概览步骤点继续再进入下一字段”的来源之一。

## 4. 当前未内置的采集能力

这些能力目前没有作为内置插件落地：

- Navigation / Route 采集
- 浏览器历史 API 模板化
- 全局自定义事件总线

它们仍然可以通过自定义插件或手动 dispatch 接入，但不应在当前文档中被描述成“默认已实现”。

## 5. 当前约束

### 合法做法

- 显式属性映射语义
- 插件提取业务语义
- 手动 dispatch 语义明确的 key

### 不推荐或禁止的做法

- 用 `innerText` 反推 key
- 用 CSS selector 自动生成 key
- 直接写 Store
- 绕过 Runtime 直接驱动 Engine

## 6. 一句话总结

> 当前 FlowPilot 的采集层本质上是“插件或业务事件 -> `runtime.dispatch` -> 标准 Signal”。
