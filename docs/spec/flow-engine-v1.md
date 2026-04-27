# flow-engine-v1.md

## 1. 文件定位

这份文档保留为 FlowPilot 早期引擎设计的历史基线说明。
它可以帮助理解项目从“线性状态机 / 早期 DAG 草案”演进到当前实现的过程，但它**不再是当前版本的权威规范**。

当前权威文档请优先参考：

- [03 - Step & Flow Model](../03%20-%20Step%20%26%20Flow%20Model.md)
- [04 - Engine Runtime](../04%20-%20Engine%20Runtime.md)
- [07 - Implementation Contract](../07%20-%20Implementation%20Contract.md)

## 2. 这份历史基线仍然保留的价值

它记录了几个仍然成立的核心方向：

- Signal 驱动
- DAG 化流程
- append-only 历史
- 状态来自事件投影

## 3. 与当前实现的主要差异

当前代码相比这份早期基线，已经至少多出了这些能力：

- `pending / active / completed / cancelled` 四类步骤集合
- `enterWhen`
- `cancelWhen`
- `sequence / not / after / timer(...)` 等更丰富的条件表达能力
- `eventIndex + lowerBound` 这类时间索引优化
- Runtime 层的持久化、定时器调度和回溯接口
- `GuideSessionManager` 与 `createGuideRegistryService`
- DevTools 的单权威 replay 链路

## 4. 当前使用建议

如果你是在做新功能、修 bug 或补测试：

- 不要再以这份文件为实现准绳
- 把它当作“历史演进背景”即可

如果你是在重构底层引擎：

- 可以用它帮助判断哪些理念是延续下来的
- 但最终语义必须对齐当前代码和新版 docs
