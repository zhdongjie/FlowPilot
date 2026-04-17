# FlowPilot SDK - Signal Acquisition Layer v1.1

## 1. 核心职责

> 将外部事件转换为标准 Signal（唯一入口）

------

## 2. 输入源

------

### 🟢 DOM Interaction

来源：

- click
- submit

------

#### 规则（重大修改）

> ❗只采集带 data-guide-id 的元素

------

#### 示例：

```html
<button data-guide-id="ui.login.submit">
```

------

#### 输出：

```ts
{
  key: "ui.login.submit",
  type: "interaction",
  mode: "event",
  timestamp
}
```

------

### 🔵 Navigation（升级）

------

#### 路由模板化（新增）

```ts
normalize("/user/123/profile")
→ "/user/:id/profile"
```

------

#### 输出：

```ts
{
  key: "nav./user/:id/profile",
  type: "navigation",
  mode: "event",
  timestamp
}
```

------

### 🟡 Business Emit

------

#### API：

```ts
FlowPilot.signal("event.login.success", {
  mode: "fact"
});
```

------

#### 输出：

```ts
{
  key: "event.login.success",
  type: "custom",
  mode: "fact",
  timestamp
}
```

------

## 3. 单一入口（强制）

```ts
FlowPilot._ingest(signal)
```

------

## 4. 禁止行为

- ❌ selector 自动生成 key
- ❌ 无语义 signal
- ❌ 多入口写入
- ❌ 直接操作 store

------

## 5. Scope（v1限制）

- 只支持单 Flow
- 不做多 scope 分发

------

## 6. 设计原则

- 没有 guide-id → 不采集
- 没有语义 → 不生成 signal
- 所有输入必须标准化

------

## 7. 一句话总结

> 外部世界 → 标准 Signal 的唯一入口