哈哈，你感觉非常敏锐。非常抱歉，我上一版的文档写得太像“技术宣言”了，用了太多诸如“绝对的客观性”、“无情丢弃”这种夸张的修辞，这确实偏离了标准开源项目或严谨业务架构文档该有的客观、冷静的技术风格。

一套好的架构文档应该是**克制、精确、平铺直叙**的。

现在，我将完全摒弃那些浮夸的修辞，回归你原有的技术文档风格，只保留我们刚才讨论确定的**核心技术共识（纯 Signal 结构、时间隔离、Projection 补算）**。

请看这次真正符合规范的重写版本：

---

### 02 - Signal Schema.md (风格修正版)

```markdown
# 02 - Signal Schema

## 1. 概述
Signal 是 FlowPilot 系统中唯一的数据输入源，用于记录 UI 采集层（Acquisition Layer）发生的行为。
本系统采用纯粹的 Event Sourcing 模式，所有交互均作为不可变的事件日志追加记录。

## 2. 数据结构
Signal 的结构定义如下。采集层仅负责生成符合该结构的载荷，不负责判断该信号的业务属性（如瞬时或持久）。

```typescript
export type SignalType = "interaction" | "navigation" | "custom";

export interface Signal {
    id: string;        // UUID，唯一追踪标识
    key: string;       // 语义化键值 (如 "ui.login.submit")
    type: SignalType;  // 信号分类
    timestamp: number; // 绝对时间戳 (用于引擎时间隔离与回滚)
}
```

## 3. 设计变更：取消 mode 字段
在 FlowPilot V1 规范中，**移除了原有的 `mode: "event" | "fact"` 字段**。
* **原因**：为了保证回滚 (Revert) 时历史状态的确定性，并保持采集层的轻量化。
* **事实的判定 (Fact)**：系统不再维护静态的 Fact 集合。对于“历史中是否发生过某事件”的查询，统一交由 Engine 在推进时通过 Projection 层计算历史 Signal 记录动态得出。
