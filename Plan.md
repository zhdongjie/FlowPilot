# 🧠 FlowPilot SDK 实现路线

------

# 🚀 Phase 0：项目初始化（环境地基）

## 🎯 目标

建立 Vue + TS + Vitest 的干净工程骨架

------

## 🧱 执行步骤

```bash
npm create vite@latest flowpilot -- --template vue-ts
cd flowpilot
npm install
npm install -D vitest
```

------

## 📁 目录结构（初始）

```
src/
  sdk/
  tests/
```

------

## ✅ 成果

- Vue 项目可以正常启动
- TypeScript 无报错
- Vitest 可以运行

------

## 🧪 验证

```bash
npm run dev
npm run test
```

✔ 都能跑通

------

# 🚀 Phase 1：测试体系建立（强制）

## 🎯 目标

让 SDK 未来所有逻辑**必须可测试**

------

## 🧱 执行

创建：

```
src/sdk/core/__tests__/bootstrap.test.ts
```

------

## 🧪 测试内容

```ts
import { describe, it, expect } from "vitest";

describe("bootstrap", () => {
  it("should run test system", () => {
    expect(1 + 1).toBe(2);
  });
});
```

------

## ✅ 成果

- vitest 正常运行
- 测试结构存在

------

## ❌ 失败标准

- 没有测试目录 = 停止

------

# 🚀 Phase 2：Signal 最小模型

## 🎯 目标

建立 Signal 数据结构（不写逻辑）

------

## 📁 文件

```
src/sdk/types/signal.ts
```

------

## 🧱 内容

```ts
export type SignalType = "interaction" | "navigation" | "custom";

export type SignalMode = "event" | "fact";

export interface Signal {
  key: string;
  type: SignalType;
  mode: SignalMode;
  timestamp: number;
}
```

------

## 🧪 验证

写类型测试（可选）：

```ts
const s: Signal = {
  key: "ui.login.submit",
  type: "interaction",
  mode: "event",
  timestamp: Date.now()
};
```

------

## ✅ 成果

- 类型系统通过
- 无 runtime 逻辑

------

# 🚀 Phase 3：Store（最小状态层）

## 🎯 目标

实现 event + fact 存储

------

## 📁 文件

```
src/sdk/core/store.ts
```

------

## 🧱 实现

```ts
import { Signal } from "../types/signal";

export class SignalStore {
  events: Signal[] = [];
  facts: Set<string> = new Set();

  pushEvent(signal: Signal) {
    this.events.push(signal);
  }

  pushFact(key: string) {
    this.facts.add(key);
  }
}
```

------

## 🧪 测试

```ts
it("stores facts uniquely", () => {
  const store = new SignalStore();

  store.pushFact("login.success");
  store.pushFact("login.success");

  expect(store.facts.size).toBe(1);
});
```

------

## ✅ 成果

- Event 有序
- Fact 去重

------

# 🚀 Phase 4：Signal Ingest（统一入口）

## 🎯 目标

建立唯一入口 `_ingest`

------

## 📁 文件

```
src/sdk/core/engine.ts
```

------

## 🧱 实现（最小版）

```ts
import { Signal } from "../types/signal";
import { SignalStore } from "./store";

export class FlowEngine {
  store = new SignalStore();

  _ingest(signal: Signal) {
    if (signal.mode === "event") {
      this.store.pushEvent(signal);
    }

    if (signal.mode === "fact") {
      this.store.pushFact(signal.key);
    }
  }
}
```

------

## 🧪 验证

```ts
engine._ingest({
  key: "ui.login.submit",
  type: "interaction",
  mode: "event",
  timestamp: Date.now()
});
```

✔ event 进入 store

------

## ❌ 失败标准

- 直接操作 store ❌（禁止）

------

# 🚀 Phase 5：Step Engine（核心最小版）

## 🎯 目标

实现 step 推进

------

## 📁 文件

```
src/sdk/core/engine.ts
```

------

## 🧱 Step

```ts
export interface Step {
  id: string;
  complete: string;
  activatedAt?: number;
}
```

------

## 🧱 Engine（核心）

```ts
export class FlowEngine {
  steps: Step[] = [];
  currentIndex = 0;

  store = new SignalStore();

  get currentStep() {
    return this.steps[this.currentIndex];
  }

  activateStep() {
    this.currentStep.activatedAt = Date.now();
  }
}
```

------

## 🧪 验证

- step 能激活
- currentStep 正确

------

# 🚀 Phase 6：匹配逻辑（Event）

## 🎯 目标

实现 Event 时间过滤

------

## 🧱 逻辑

```ts
matchEvent(signal: Signal, step: Step) {
  return (
    signal.key === step.complete &&
    signal.timestamp > step.activatedAt!
  );
}
```

------

## 🧪 测试

- old event ❌
- new event ✔

------

# 🚀 Phase 7：Fact 补算机制

## 🎯 目标

Step 激活时自动检查 fact

------

## 🧱 实现

```ts
checkFact(step: Step) {
  if (this.store.facts.has(step.complete)) {
    this.nextStep();
  }
}
```

------

## 🧪 验证

- fact 存在 → 自动跳步

------

# 🚀 Phase 8：Revert（状态回滚）

## 🎯 目标

支持 step 回退

------

## 🧱 实现

```ts
revert(toIndex: number) {
  this.currentIndex = toIndex;
  this.activateStep();
}
```

------

## 🧪 验证

- step 回退成功
- activatedAt 更新

------

# 🚀 Phase 9：Vue 集成（桥接层）

## 🎯 目标

让 UI 响应 Engine

------

## 📁 文件

```
src/sdk/vue/useFlowPilot.ts
```

------

## 🧱 实现

```ts
import { ref } from "vue";
import { FlowEngine } from "../core/engine";

export function useFlowPilot(steps) {
  const engine = new FlowEngine();
  engine.steps = steps;

  const currentStep = ref(engine.currentStep);

  return {
    engine,
    currentStep
  };
}
```

------

## 🧪 验证

- Vue UI 能显示 step
- step 变化 UI 更新

------

# 🚀 Phase 10（最终验证）：完整 Demo

## 🎯 目标

跑通完整 Flow

------

## 页面结构：

- step1 → 点击 → step2
- step2 → fact → step3
- revert → step2

------

## 成果：

✔ 无 if (step === x)
✔ 全 signal 驱动
✔ UI 完全解耦

