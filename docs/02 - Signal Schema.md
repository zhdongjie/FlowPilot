# FlowPilot SDK - Signal Schema v1.1

## 1. Signal 定义

```ts
type Signal = {
  key: string;

  type: "interaction" | "navigation" | "custom";

  mode: "event" | "fact"; // ⭐新增（关键）

  timestamp: number;

  scope?: {
    flowId?: string;
    instanceId?: string;
  };
};
```

------

## 2. Signal Key 规范

```text
<domain>.<feature>.<action>
```

------

## 示例：

```text
ui.login.submit
ui.modal.close

nav./dashboard
nav./user/:id/profile

event.login.success
event.form.valid
```

------

## 3. Event vs Fact（强制规则）

------

### Event（瞬时）

- interaction
- navigation
- 一次性触发

------

### Fact（持久）

- login.success
- form.valid

------

## 4. Signal Store（升级版）

```ts
type SignalStore = {
  events: Signal[];
  facts: Set<string>;
};
```

------

## 5. 规则

- Event 进入 events
- Fact 进入 facts（去重）

------

## 6. Scope（v1限制）

- v1 只允许单 Flow
- scope 字段预留，不强依赖

------

## 7. 强约束

- ❗禁止 selector 直接生成 key
- ❗key 必须具备业务语义