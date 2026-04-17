# FlowPilot SDK - Edge Case Addendum v1.1

------

## 1. Fact 生命周期（新增强约束）

------

### 结论（写死规则）

> Fact 的生命周期 = Flow Instance 生命周期

------

## 1.1 行为定义

- Fact 一旦写入 Store（facts: Set）
- 在当前 Flow Instance 内 **永久有效**
- 不会自动失效
- 不会被覆盖
- 不会被删除（v1）

------

## 1.2 示例

```ts
emit("event.login.success") → fact 存在

emit("event.logout") → 不影响已有 fact
```

------

## 1.3 设计原因

------

### 避免系统复杂化

如果允许 Fact 自动失效：

- 需要引入生命周期管理
- 需要引入依赖关系（login → logout）
- 需要引入状态一致性问题

直接变成“业务状态机” 

------

### 保持 SDK 纯粹性

> SDK 不理解 Fact 之间的关系

------

## 1.4 未来扩展（明确但不实现）

------

### 可选 API（v2）

```ts
FlowPilot.removeFact("event.login.success")
```

------

### v1 明确禁止：

- ❌ 自动失效
- ❌ 条件失效
- ❌ 依赖关系清理

------

## 1.5 一句话总结

> Fact 是“已发生的事实”，不是“当前状态”

------

------

## 2. Revert 后 Event 处理（确认设计正确性）

------

### 结论

> Event Store 不需要清理（必须保留）

------

## 2.1 核心机制

依赖 Runtime 规则：

```ts
signal.mode === "event"
AND signal.timestamp > step.activatedAt
```

------

## 2.2 Revert 行为

```ts
FlowPilot.control({
  type: "REVERT",
  toStep: "step2"
});
```

------

### 执行结果：

```ts
step2.activatedAt = now
```

------

## 2.3 匹配结果

------

### 旧 Event：

```ts
event.timestamp < activatedAt
→ 自动失效
```

------

### 新 Event：

```ts
event.timestamp > activatedAt
→ 可匹配
```

------

## 2.4 设计优势

------

### 无需清理 Store

- 避免复杂清理逻辑
- 避免误删数据
- 保持事件完整性（可调试）

------

### 天然幂等

- 重复事件不会触发
- 历史行为不会污染当前 Step

------

### 支持回放（Replay）

- 可以用于调试 / 分析
- 可以复现用户路径

------

## 2.5 风险边界（必须说明）

------

### Store 可能增长

```ts
events: Signal[]
```

------

### v1 处理方式：

- 不做裁剪（简化实现）

------

### v2 可选优化：

```ts
events = events.slice(-N)
```

或：

```ts
只保留最近 X 秒
```

------

## 2.6 一句话总结

> Event 用时间隔离，不用数据删除

------

------

## 3. 最终一致性模型（关键总结）

------

## FlowPilot v1 的真实一致性策略：

------

### Event：

```text
时间一致性（Temporal Consistency）
```

------

### Fact：

```text
状态一致性（State Consistency）
```

------

## 合并后：

```text
Event（时间流） + Fact（状态集）
→ 驱动 Step 状态机
```

------

------

## 4. v1 强约束总结（补充）

------

### 1. Fact 永不失效（Flow 生命周期内）

------

### 1. Event 永不删除（依赖时间过滤）

------

### 3. Revert 只更新时间，不清数据

------

### 4. SDK 不维护业务状态

------

## 5. 一句话总结（可以写在文档首页）

> FlowPilot 使用「时间隔离 Event + 持久 Fact」来实现无副作用的状态机推进