# FlowPilot SDK - Implementation Contract v1

------

## 0. Contract 定义

> Implementation Contract = FlowPilot SDK 的“强制执行规则层”

------

### 🚨 任何违反本 Contract 的实现 = 非法实现（即使功能正确）

------

## 1. 系统架构边界（强制）

------

### 1.1 三层架构（不可修改）

```text
[ Acquisition Layer ]
        ↓
[ Core Engine Layer ]
        ↓
[ State Store ]
        ↓
[ UI Layer (Vue/React) ]
```

------

### ❌ 禁止跨层调用

#### Acquisition ❌ 不能：

- 调用 Engine
- 修改 Store
- 访问 Vue

------

#### Engine ❌ 不能：

- 直接监听 DOM
- 调用 Acquisition
- 操作 UI

------

#### UI ❌ 不能：

- 直接修改 Store
- 绕过 Engine
- 生成 Signal

------

## 2. 数据流规则（单向强制）

------

### ✔ 唯一允许的数据流：

```text
DOM / Business / Route
        ↓
Acquisition
        ↓
Normalized Signal
        ↓
Engine
        ↓
Store
        ↓
UI
```

------

### ❌ 明确禁止：

- UI → Engine（直接调用业务逻辑）
- Engine → Acquisition（反向依赖）
- Store → Engine（双向绑定）

------

## 3. Signal 生成规则（强约束）

------

### 3.1 Signal 来源

| 类型        | 来源               |
| ----------- | ------------------ |
| interaction | data-guide-id      |
| navigation  | path-to-regexp     |
| custom      | FlowPilot.signal() |

------

### ❌ 禁止：

```text
selector → signal key 自动生成（严格禁止）
```

------

### ❌ 禁止：

- DOM结构推导语义
- innerText 推导 signal

------

### ✔ 唯一合法方式：

```ts
key 必须显式定义或映射生成
```

------

## 4. Store 结构锁死（不可变契约）

------

### 4.1 唯一合法结构

```ts
type Store = {
  events: Signal[];
  facts: Set<string>;
};
```

------

### ❌ 禁止替代结构：

- Map
- Object key-value store
- DB persistence layer（v1）
- Vue reactive store 替代核心 store

------

### 4.2 Store 行为规则

#### Event：

- 只追加
- 不修改
- 不删除（v1）

#### Fact：

- Set 去重
- 生命周期 = Flow Instance

------

## 5. Engine 行为契约（核心）

------

### 5.1 Engine 禁止行为

❌ Engine 不允许：

- 读取 DOM
- 直接触发 UI 更新
- 修改 Acquisition
- 访问 window / document

------

### 5.2 Engine 必须行为

✔ 必须：

- 只处理 Signal
- 只读 Store
- 只输出 Step 状态变化

------

### 5.3 Step 完成规则（强制）

```text
Step.complete = single Signal Key
```

------

❌ 禁止：

```ts
["a", "b"]
```

------

## 6. Event / Fact 分离契约（核心语义）

------

### 6.1 Event（瞬时）

```text
click / submit / route change
```

✔ 必须满足：

```text
timestamp > step.activatedAt
```

------

### 6.2 Fact（持久）

```text
login.success / form.valid
```

✔ 必须满足：

```text
只要存在于 Set 即可匹配
```

------

### ❌ 禁止：

- Fact 时间判断
- Fact 过期机制（v1）

------

## 7. Revert（回滚契约）

------

### 7.1 唯一合法方式

```ts
FlowPilot.control({
  type: "REVERT",
  toStep: "stepId"
});
```

------

### 7.2 行为规则

- Step 状态回到 ACTIVE
- activatedAt 更新为 now
- Store 不清理

------

### ❌ 禁止：

- 自动回滚
- Event 清空
- Fact 重置

------

## 8. Scope 契约（v1收敛）

------

### 8.1 v1 限制

- ❌ 不支持多 Flow 并行
- ❌ 不支持多 Instance Router

------

### 8.2 Scope 规则

```text
所有 Signal → 当前唯一 Active Flow
```

------

## 9. Acquisition Layer 契约（最重要之一）

------

### 9.1 DOM 规则（强制）

```text
❗只有 data-guide-id 才能生成 Signal
```

------

### ❌ 禁止：

- selector 直接生成 signal
- innerText 推导语义
- DOM结构推导 key

------

### 9.2 Navigation 规则

必须使用：

```ts
path-to-regexp
```

生成：

```text
nav./user/:id/profile
```

------

## 10. UI Layer 契约（Vue/React）

------

### ❌ 禁止：

- UI 直接修改 Store
- UI 直接调用 Engine 内部方法
- UI 绕过 Signal system

------

### ✔ 允许：

- 监听 Engine state
- 调用 FlowPilot.signal()
- 调用 FlowPilot.control()

------

## 11. Fail Fast 规则（非常关键）

------

### ❗任何非法行为必须：

- 直接 throw error
- 或 console warning + ignore

------

### 示例：

```ts
if (!signal.key.includes(".")) {
  throw new Error("Invalid Signal Key")
}
```

------

## 12. Performance 契约（v1约束）

------

- ❌ 不做 store 清理
- ❌ 不做 event GC
- ❌ 不做 diff 优化
- ✔ 简单线性处理即可

------

## 13. 系统不可变原则（核心）

------

### ❗以下内容在 v1 永远不可变：

- Signal 分类模型（3类）
- Event / Fact 分离模型
- Step 单 key 模型
- 单 Flow instance 模型

------

## 14. 一句话总结（必须写在文档首页）

> FlowPilot SDK is a strict, single-flow, signal-driven state machine with enforced architectural boundaries.