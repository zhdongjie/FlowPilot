# 📜 FlowPilot Spec v1（建议你直接作为项目根）

---

## 🧱 1. 基本模型

系统由三种对象构成：

### 1. Signal（事件流）

```ts
// src/sdk/types/signal.ts

export type SignalType = "interaction" | "navigation" | "custom";

export interface Signal {
    id: string;

    key: string;

    type: SignalType;

    timestamp: number;
}

```

👉 语义：

* 不可变
* 只追加
* 永远不删除

---

### 2. Step（状态节点）

```ts
// src/sdk/types/step.ts

export interface Step {
    id: string;

    /**
     * 完成条件（Signal key）
     */
    complete: string;
}

```

👉 语义：

* step 不存时间
* step 是“判断点”
* 是否完成由 signal 决定

---

### 3. Engine State（运行态）

```ts
export interface State {
  currentIndex: number
  activatedAt: Map<stepIndex, number>
}
```

👉 关键点：

* state 是 **派生结果**
* 不可直接作为真相
* 可以重建

---

# ⏱ 2. 时间模型（核心）

系统中唯一时间源：

> Signal.timestamp

❌ 禁止：

* Date.now() 作为业务逻辑依据（只能用于 debug）

✔ 正确：

* 所有判断必须基于 signal.timestamp

---

# 🧩 3. Step 迁移规则（核心规则）

## ✔ 规则 1：顺序推进

```text
step[i] → step[i+1]
```

---

## ✔ 规则 2：触发条件

step 进入下一步仅当：

```text
signal.key === step.complete
AND
signal.timestamp >= activatedAt(step)
```

---

## ✔ 规则 3：activatedAt 含义

不是“时间记录”，而是：

> 🚨 “这个 step 从什么时候开始有效”

---

# 🧠 4. Fact（你现在最大混乱点）

我们统一定义：

## ✔ Fact = 历史中是否发生过某事件

但必须分清：

### A. 全局 fact（global fact）

> 曾经发生过就永远成立

### B. 时间 fact（temporal fact）✔推荐你现在用这个

```text
signal.timestamp < cutoff
```

👉 用于：

* revert
* replay
* 时间隔离

---

# 🔁 5. Revert（你现在测试全挂的根源）

你现在必须选这个定义：

## ✔ Revert 定义（严格）

> revert = reset pointer + 从 signal log 重新计算状态

但限制：

### ❗不能污染未来状态

---

## 正确行为：

```text
1. 截断 state
2. 回到 index
3. 重新 replay signals（按 timestamp）
```

---

# 🔄 6. Recompute（全量一致性）

```text
recompute = 从 0 重建整个状态机
```

特点：

* 必须 deterministic
* 不能依赖任何 runtime cache
* 只依赖 signal log

---

# ⚙️ 7. Engine 运行规则（统一）

FlowEngine 必须满足：

## ✔ 单向规则

```text
signal → state
```

不能反向修改 signal

---

## ✔ 无隐式状态规则

禁止：

* Date.now() 驱动逻辑
* step 内部存状态
* hidden mutation

---

## ✔ 确定性规则

```text
same signals → same state
```

---

# 🚨 8. 你现在代码失败的真正原因

不是 bug，是：

| 问题       | 本质                |
|----------|-------------------|
| revert失败 | 没有“时间切片重建”        |
| chain失败  | resolver 语义混乱     |
| fact失败   | fact 没定义边界        |
| init失败   | activatedAt 语义不统一 |
