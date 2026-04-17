# 📜 flow-engine-v1.md（工程版 / FSM 内核 + 可扩展）

---

# 🧱 1. 核心模型（稳定不动）

## 1.1 Signal（事件）

```ts
export interface Signal {
    id: string;
    key: string;
    type?: string;
    timestamp?: number;
}
```

### 语义

* append-only（追加）
* 不删除（revert = 截断副本）
* 可重复（需要幂等处理）

---

## 1.2 Step（升级版）

```ts
export interface Step {
    id: string;

    /**
     * 完成条件（支持表达式）
     */
    when: Condition;

    /**
     * 后继节点（DAG）
     */
    next?: string[];
}
```

---

## 1.3 Condition（核心升级）

```ts
export type Condition =
    | { type: "event"; key: string }
    | { type: "and"; conditions: Condition[] }
    | { type: "or"; conditions: Condition[] };
```

---

## 1.4 Engine State（仍然极简）

```ts
export interface State {
    activeSteps: Set<string>;   // 当前激活的步骤（并发）
    completedSteps: Set<string>;
}
```

---

# 🧠 2. 核心理念（非常重要）

## 👉 不再是“指针推进”

旧模型：

```text
currentIndex → 单线推进
```

新模型：

```text
activeSteps（多个并发节点）
```

---

## 👉 状态 = 事件的投影

```text
state = f(events)
```

---

## 👉 Step 是“可被满足的条件节点”

不是顺序，而是：

> “当条件满足 → 激活后继节点”

---

# 🔁 3. Engine 行为模型

---

## 3.1 初始化

```ts
activeSteps = { rootStep }
completedSteps = {}
```

---

## 3.2 ingest(signal)

```text
1. append signal
2. 重新评估 activeSteps
3. 找到满足条件的 step
4. 标记为 completed
5. 激活 next steps
```

---

## 3.3 条件判断（核心）

```ts
function evaluate(condition, events): boolean
```

---

### 示例

#### 单事件

```ts
{ type: "event", key: "a" }
```

---

#### AND

```ts
{ type: "and", conditions: [
    { type: "event", key: "a" },
    { type: "event", key: "b" }
]}
```

---

#### OR

```ts
{ type: "or", conditions: [
    { type: "event", key: "a" },
    { type: "event", key: "b" }
]}
```

---

# 🔀 4. DAG 执行模型

---

## 示例流程

```text
        A
       / \
      B   C
       \ /
        D
```

---

## Step 定义

```ts
A → next: [B, C]
B → next: [D]
C → next: [D]
```

---

## 执行语义

| Step | 条件      |
| ---- | ------- |
| A    | start   |
| B    | a       |
| C    | a       |
| D    | b AND c |

---

---

# ⚙️ 5. 引擎核心算法（伪代码）

---

## ingest

```ts
ingest(signal):
    store.push(signal)

    loop:
        changed = false

        for step in activeSteps:
            if step not completed:
                if evaluate(step.when):
                    mark completed
                    activate next steps
                    changed = true

        if not changed:
            break
```

---

## evaluate

```ts
function evaluate(cond):
    switch cond.type:
        case "event":
            return hasEvent(cond.key)

        case "and":
            return cond.conditions.every(evaluate)

        case "or":
            return cond.conditions.some(evaluate)
```

---

# 🔁 6. Recompute（核心能力）

```ts
recompute():
    reset state
    for e in events:
        ingest(e)
```

---

👉 必须满足：

```text
same events → same state
```

---

# 🔙 7. Revert（正确版本）

```ts
revert(stepId):
    找到达到该 step 所需的最小事件集
    截断 events
    recompute()
```

---

👉 注意：

* ❌ 不允许直接改 state
* ✔ 必须通过 events 驱动

---

# 🧩 8. 幂等性（必须实现）

---

## 问题

```ts
a, a, a
```

不能导致多次推进

---

## 方案

```ts
Signal.id 唯一
或
(key + timestamp) 去重
```

---

---

# 🚀 9. Projection（性能层）

---

## 当前

```ts
hasEvent(events, key) → O(n)
```

---

## 优化

```ts
Map<key, count>
```

---

---

# 🔒 10. 约束（必须遵守）

---

## ✔ 单向数据流

```text
signal → state
```

---

## ✔ 无隐式状态

禁止：

* Date.now()
* step 内部状态

---

## ✔ deterministic

```text
same input → same output
```

---

---

# 🧨 11. 和你当前版本的关系

---

## 你现在

```text
线性 FSM（index）
```

---

## 新版本

```text
DAG + 条件 + 并发
```

---

## 升级路径

```text
index → activeSteps(Set)
complete → when(condition)
线性 → DAG
```
