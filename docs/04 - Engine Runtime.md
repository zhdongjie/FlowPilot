# FlowPilot SDK - Engine Runtime v1.1

## 1. 核心流程

```text
Signal → Store → Match → Transition
```

------

## 2. Signal 处理

```ts
onSignal(signal):
  store.record(signal)
  tryCompleteStep(signal)
```

------

## 3. 匹配规则（修复版）

------

### Event 匹配

```ts
signal.mode === "event"
AND signal.timestamp > step.activatedAt
```

------

### Fact 匹配

```ts
signal.mode === "fact"
AND store.facts.has(step.complete)
```

------

## 4. Step 完成逻辑

```ts
function completeStep():
  if step.status === COMPLETED:
    return

  step.status = COMPLETED
  moveToNextStep()
```

------

## 5. 推进逻辑

```ts
function moveToNextStep():
  currentStepIndex++
  activate(nextStep)
```

------

## 6. 回滚机制（新增）

```ts
FlowPilot.control({
  type: "REVERT",
  toStep: "stepId"
});
```

------

## 7. 回滚行为

```ts
onControl(REVERT):
  currentStep = targetStep
  step.status = ACTIVE
```

------

## 8. 幂等性

- Step 只能完成一次
- Fact 去重
- 重复 signal 忽略

------

## 9. 错误防护

- 忽略历史 Event
- Fact 不受时间限制
- 非当前 step 忽略