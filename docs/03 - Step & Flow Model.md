# FlowPilot SDK - Step & Flow Model v1.1

## 1. Step 定义（强约束）

```ts
type Step = {
  id: string;

  complete: string; // ⭐唯一 Signal Key（必须唯一）

  when?: {
    route?: string;
  };
};
```

------

## 2. 强约束规则

### ❗一个 Step 只能绑定一个 completion key

```ts
// ❌ 禁止
complete: ["a", "b"]

// ✅ 必须
complete: "event.login.success"
```

------

## 3. Step 状态

```text
WAITING
ACTIVE
COMPLETED
```

------

## 4. Step 激活机制

```ts
step.activatedAt = timestamp
```

------

## 5. Fact 补算机制（新增关键）

```ts
onStepActivate(step):
  if store.facts.has(step.complete):
    completeStep()
```

------

## 6. Flow 定义

```ts
type Flow = {
  id: string;
  steps: Step[];
};
```

------

## 7. Flow Instance（v1）

```ts
type FlowInstance = {
  currentStepIndex: number;
};
```

------

## 8. 单推进规则

- 只允许 currentStep 完成
- 不允许跳跃
- 不允许并行