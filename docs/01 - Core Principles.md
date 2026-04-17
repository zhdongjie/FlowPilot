# FlowPilot SDK - Core Principles v1.1

## 1. SDK 核心目标

FlowPilot 只解决一个问题：

> 在前端系统中，判断用户是否完成某个步骤

------

## 2. SDK 职责边界

### ✅ SDK负责：

- 采集用户行为信号（interaction / navigation / custom）
- 统一转换为 Signal Key
- 维护 Signal Store（Event + Fact）
- 推进 Step 状态机
- 提供可控的状态回滚能力（Control）

------

### ❌ SDK不负责：

- 不判断接口成功或失败（默认）
- 不解析业务逻辑
- 不做表单校验
- 不劫持网络请求
- 不理解 DOM 结构语义

------

## 3. 核心设计原则

### 原则1：Signal First

Step 完成只依赖 Signal Key

------

### 原则2：语义唯一性

> ❗没有语义 Key，就没有 Signal

------

### 原则3：Event / Fact 分离

- Event：瞬时行为（click / route）
- Fact：持久状态（login.success）

------

### 原则4：单 Step 推进

- 同一时间只有一个 ACTIVE Step
- 不允许并行推进

------

### 原则5：可回滚（但不自动）

- SDK 不判断失败
- 但允许业务触发回滚

------

## 4. 系统本质

> Signal-driven Step State Machine with controlled rollback