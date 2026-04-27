# FlowPilot 文档索引

这个目录现在主要放两类文档：

- 设计 / 规格文档
- 运行时实现约束文档

如果你是第一次接手这个项目，推荐按下面顺序看。

## 推荐阅读顺序

1. [仓库总览](../README.md)
2. [SDK 使用说明](../flowpilot/README.md)
3. [Example 说明](../examples/flowpilot-vue/README.md)
4. 下面这些底层规格文档

## 规格文档

- [01 - Core Principles](./01%20-%20Core%20Principles.md)
- [02 - Signal Schema](./02%20-%20Signal%20Schema.md)
- [03 - Step & Flow Model](./03%20-%20Step%20%26%20Flow%20Model.md)
- [04 - Engine Runtime](./04%20-%20Engine%20Runtime.md)
- [05 - Signal Acquisition Layer](./05%20-%20Signal%20Acquisition%20Layer.md)
- [06 - Edge Case Addendum](./06%20-%20Edge%20Case%20Addendum.md)
- [07 - Implementation Contract](./07%20-%20Implementation%20Contract.md)
- [08 - Public API](./08%20-%20Public%20API.md)
- [09 - Plugin System](./09%20-%20Plugin%20System.md)
- [10 - Runtime Contracts](./10%20-%20Runtime%20Contracts.md)
- [flow-engine-v1（历史版本）](./spec/flow-engine-v1.md)

## 怎么理解这些文档和当前代码的关系

- `docs/` 更偏“设计意图”和“语义边界”
- `flowpilot/README.md` 更偏“当前已经能怎么用”
- 实际对外导出的权威入口以 `flowpilot/src/index.ts` 和 `flowpilot/package.json` 为准
- example 的接入方式以 `examples/flowpilot-vue/README.md` 和 `examples/flowpilot-vue/vite.config.ts` 为准
- `docs/spec/flow-engine-v1.md` 现在保留为历史演进说明，不再作为当前实现的权威规范

## 适合什么时候看哪份文档

- 想接 SDK：先看 `flowpilot/README.md`
- 想跑 demo：先看 `examples/flowpilot-vue/README.md`
- 想理解 revert / timer / persistence 语义：优先看 `04 - Engine Runtime.md`
- 想找公开入口怎么用：优先看 `08 - Public API.md`
- 想扩插件或替换默认插件：优先看 `09 - Plugin System.md`
- 想确认哪些边界行为已经被代码和测试锁住：优先看 `10 - Runtime Contracts.md`
- 想理解架构边界：优先看 `07 - Implementation Contract.md`
