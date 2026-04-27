# FlowPilot Vue Example

这个 example 用来验证两件事：

- SDK 打包产物是否可以被真实项目直接消费
- 一个页面里存在多条 guide 时，是否可以按需初始化、运行、销毁和切换

## 相关文档

- [SDK 使用说明](../../flowpilot/README.md)
- [SDK 发布说明](../../flowpilot/RELEASE.md)
- [仓库文档索引](../../docs/README.md)

## 这个 demo 演示了什么

当前页面上有两个引导入口：

- `open-account`
  开卡引导，配置来自本地静态 JSON
- `profile-completion`
  资料完善引导，配置来自模拟请求，后续可直接替换成真实接口

引导生命周期是这样组织的：

1. 点击某个入口按钮
2. 销毁当前 guide，并清理当前 demo 状态
3. 初始化目标 guide
4. guide 完成后自动销毁
5. 再点击另一个入口时，重新走同样流程

## 先跑起来

先构建 SDK：

```bash
cd ../../flowpilot
npm install
npm run build
```

再安装并启动 example：

```bash
cd ../examples/flowpilot-vue
npm install
npm run dev
```

如果只是检查 example 是否能消费 SDK 产物：

```bash
npm run build
```

## 为什么一定要先构建 SDK

因为这个 example 当前不是直接引用 `../../flowpilot/src/`，而是把包名 `flowpilot` 映射到本地 dist：

```ts
resolve: {
  alias: {
    flowpilot: "../../flowpilot/dist/flowpilot.esm.js"
  }
}
```

这样做的好处是：

- example 验证的是“打包后的 SDK”而不是源码路径
- example 里的导入方式和外部真实项目一致
- 以后切到 npm 包时，业务代码基本不用改

## 关键文件

- `src/main.ts`
  挂载 Vue 应用，并用 `axios-mock-adapter` 模拟接口返回
- `src/App.vue`
  页面结构、两个入口按钮、业务表单和 guide 生命周期展示
- `src/guide-demo.ts`
  demo 层的轻量封装，统一组装默认插件、默认配置和 registry service
- `src/guides/catalog.ts`
  guide 注册表，决定有哪些 guide、各自配置从哪里来
- `src/guides/open-account-guide.json`
  静态 JSON guide
- `src/guides/profile-guide.mock.ts`
  模拟接口返回的 guide definition
- `vite.config.ts`
  将 `flowpilot` 指向本地 SDK dist

## `createDemoGuideService` 是干嘛的

`createDemoGuideService` 不是 SDK 必须暴露的核心 API，它是这个 demo 自己的一层薄封装。

它主要做三件事：

- 基于 SDK 的 `createGuideRegistryService` 组装 demo 需要的默认行为
- 注入 demo 默认插件，比如 logger 和 axios 响应码提取
- 如果外部再传入同名插件，就用用户插件覆盖默认插件

也就是说：

- 如果你只是想用 SDK，本质上可以直接调用 `createGuideRegistryService`
- 如果你想给某个业务系统约定一套“默认插件 + 默认主题 + 默认 runtime”，再对外暴露更简单的接口，这种封装方式就很合适

## mock 请求是怎么接进去的

`src/main.ts` 里使用了 `axios-mock-adapter`：

- `/api/login`
- `/api/submit`
- `/api/profile/save`
- `/api/guides/profile-completion`

后面接真实接口时，最小替换方式通常是：

1. 去掉 mock
2. 保留 `catalog.ts` 里异步 `source`
3. 让接口直接返回 `GuideDefinition`

## 如何继续扩一个第三条 guide

推荐步骤：

1. 新增一个 guide definition
2. 在 `src/guides/catalog.ts` 里注册 `id`、`title`、`source`
3. 如果需要新的业务交互区域，在 `src/App.vue` 补对应按钮和表单
4. 如果需要接口模式，在 `src/main.ts` 里补 mock，或者直接连真实接口

因为页面入口按钮是基于 catalog 渲染的，所以注册后 UI 会自动多出入口。

## 关于 `index.html`

example 打包出来会有 `index.html`，这是正常的。

原因很简单：

- `flowpilot/` 是 SDK，走的是 library build，不需要页面壳
- `examples/flowpilot-vue/` 是一个完整的前端应用，所以打包后必须有 `index.html`

这个 `index.html` 只属于 demo，不属于 SDK 发布产物。
