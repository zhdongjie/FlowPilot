# FlowPilot

FlowPilot 是一个面向多步骤业务引导的前端 SDK。
它把用户行为信号采集、步骤推进、可视化引导、持久化恢复、定时器控制，以及多引导切换，收敛成一套可组合的运行时能力。

## 当前仓库包含什么

- `flowpilot/`
  FlowPilot SDK 源码、测试、打包脚本和发布相关文档。
- `examples/flowpilot-vue/`
  Vue 3 demo，用来验证打包后的 SDK 是否可直接消费。
- `docs/`
  引擎设计、运行时语义和实现约束等规格文档。

## 目前已经完成的能力

- 支持静态 TypeScript、静态 JSON、异步请求三种 guide config 来源
- 支持 `enterWhen`、`cancelWhen`、`timer(...)`、`within(...)` 等组合路径
- 支持多引导注册、按需初始化、引导完成后销毁、切换时清理当前实例
- 支持持久化恢复、回溯重建、定时器重建
- SDK 可以独立打包，example 默认消费 `dist/flowpilot.esm.js`

## 快速开始

先构建 SDK，再启动 example。
因为 example 不是直接引用源码，而是通过别名引用 `flowpilot/dist/flowpilot.esm.js`。

```bash
cd flowpilot
npm install
npm run build
```

```bash
cd ../examples/flowpilot-vue
npm install
npm run dev
```

如果只想验证产物是否可构建：

```bash
cd flowpilot
npm run build
npm run build:min
npm run test:run
```

```bash
cd ../examples/flowpilot-vue
npm run build
```

## 文档导航

- [SDK 使用说明](./flowpilot/README.md)
- [SDK 发布说明](./flowpilot/RELEASE.md)
- [Example 说明](./examples/flowpilot-vue/README.md)
- [设计文档索引](./docs/README.md)

## 一些约定

- SDK 当前固定输出到 `flowpilot/dist/`
- example 当前通过 Vite alias 把 `flowpilot` 指向本地 dist 产物
- `flowpilot/package.json` 仍然保留 `"private": true`，用于避免误发布
- example 目录下打包出来的 `index.html` 属于 demo 应用壳，不属于 SDK 产物

## 下一步最自然的演进方向

- 完善公开发布前的 license、package name 和版本策略
- 给外部接入方补更多复制即可用的配置示例
- 继续围绕 persistence / revert / timer / enterWhen 组合路径补回归测试
- 如果后面要接真实后端配置中心，可以在现有 `GuideSource` 基础上直接切换到接口返回
