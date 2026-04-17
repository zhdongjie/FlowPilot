# 🚀 FlowPilot SDK 实现路线（v1.6+ 实战版）

---

# 🧱 Phase 0：基础工程（地基）

## 🎯 目标

项目可运行 + 测试体系存在

## 状态

👉 ✅ **已完成**

你已经有：

* Vitest
* killer tests
* 工程结构

---

# 🧠 Phase 1：Signal 模型（事件源）

## 🎯 目标

统一事件模型（唯一真相）

## 核心能力

* append-only
* 不可变
* timestamp 驱动

## 状态

👉 ✅ **已完成（而且超标）**

你已经有：

* id（幂等）
* timestamp（强约束）
* SignalStore（去重）

---

# 🧱 Phase 2：Store（事件存储 + 幂等）

## 🎯 目标

构建可靠事件日志

## 核心能力

* 去重（id）
* 顺序存储
* replay 支持

## 状态

👉 ✅ **已完成**

甚至你做了：

```ts
seen Set
```

👉 工业级做法

---

# ⚙️ Phase 3：Engine Kernel（DAG + 并发）

## 🎯 目标

从 FSM → DAG 引擎

## 核心能力

* activeSteps（并发）
* completedSteps
* DAG next
* evaluateLoop 收敛

## 状态

👉 ✅ **已完成（核心突破）**

你已经：

✔ 从 currentIndex → Set
✔ 支持并发
✔ 支持多分支

👉 这是架构级跨越

---

# 🧩 Phase 4：Condition System（AND / OR）

## 🎯 目标

支持复杂逻辑表达

## 核心能力

* event
* and
* or

## 状态

👉 ✅ **已完成**

---

# ⏱ Phase 5：Temporal Model（时间语义）

## 🎯 目标

引入“局部时间线”

## 核心能力

* activatedAt
* cutoff
* afterStep
* 时间过滤

## 状态

👉 🟡 **已完成 90%**

你已经有：

✔ activatedAt
✔ afterStep
✔ temporal evaluate

---

### ❗缺的点（重要）

```text
Temporal Index（性能）
```

你现在：

```ts
events.some(...)
```

👉 还是 O(n)

---

# 🔁 Phase 6：Recompute（确定性重建）

## 🎯 目标

保证：

```text
same events → same state
```

## 核心能力

* sort by timestamp
* replay
* 无副作用

## 状态

👉 ✅ **已完成**

---

# 🔙 Phase 7：Revert（时间回溯）

## 🎯 目标

真正的“时间切片”

## 核心能力

* revertToTime
* completedAt 作为锚点
* 截断未来事件

## 状态

👉 ✅ **已完成（你刚修复关键点）**

✔ 用 completedAt（正确）
✔ 时间切片（正确）

👉 这一块已经是**正确语义实现**

---

# 🛡 Phase 8：安全机制（防炸）

## 🎯 目标

防止错误配置炸系统

## 核心能力

* DAG 校验（cycle）
* dangling 检测
* loop guard

## 状态

👉 ✅ **已完成**

---

# 🧪 Phase 9：测试体系（Killer Tests）

## 🎯 目标

保证复杂行为不回归

## 核心能力

* DAG convergence
* 幂等性
* revert consistency
* temporal correctness

## 状态

👉 🟡 **已完成（很强，但还能再加）**

你已经有：

✔ convergence
✔ idempotency
✔ revert
✔ temporal

---

### ❗还能补的（下一阶段）

* 并发 + revert 组合测试
* afterStep + revert 混合
* 大规模事件压测

---

# 🚀 Phase 10：性能层（关键分水岭）

## 🎯 目标

从“能用” → “能扛业务”

---

## ❌ 当前状态

👉 **未完成**

---

## 问题

```ts
store.getEvents().some(...)
```

👉 每次 evaluate 都是 O(n)

---

## 必须引入

### Temporal Index

```ts
Map<string, Signal[]>
```

或：

```ts
Map<string, number[]> // timestamps
```

---

## 目标

```text
O(n) → O(log n)
```

---

# 🧠 Phase 11：Condition DSL（表达能力）

## 🎯 目标

让业务可以“写规则”，而不是写代码

---

## ❌ 当前状态

👉 **未完成**

---

## 未来能力

```ts
count >= 3
within 5s
sequence A → B → C
```

---

# 🔍 Phase 12：Debug / 可观测性

## 🎯 目标

让引擎“可解释”

---

## ❌ 当前状态

👉 **未完成**

---

## 需要能力

```ts
whyStepCompleted(stepId)
timeline()
eventTrace()
```

---

# 🖥 Phase 13：Vue Integration（UI 层）

## 🎯 目标

驱动 UI

---

## 状态

👉 🟡 **初级完成，但不适配 DAG**

你现在类似：

```ts
currentStep
```

---

但你需要：

```ts
activeSteps[]
completedSteps[]
```
