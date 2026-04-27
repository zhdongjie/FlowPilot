# FlowPilot SDK

FlowPilot 是一个面向业务引导场景的前端 SDK。
它的目标不是只做一个浮层，而是把“信号采集 + 步骤推进 + 回放 / 回溯 + 定时器 + 持久化 + 多引导调度”统一成一套运行时能力。

## 适合什么场景

- 新手引导
- 开卡 / 开户 / 实名认证这类多步骤流程
- 产品功能 tour
- 一个系统里同时存在多条 guide，并且只允许单条 guide 激活的场景

## 当前支持的能力

- 步骤条件 DSL
- 基于 DOM 目标的引导气泡与高亮
- `enterWhen` / `cancelWhen` / `timer(...)` / `within(...)`
- 本地持久化与恢复
- 回溯后重建 pending step / active step / timer
- 多 guide 注册与按需开启
- 静态 TS、静态 JSON、异步请求三种配置来源

## 包状态

SDK 已经可以独立打包并从 `dist/` 消费。
当前仍保留 `"private": true`，是为了在正式发布前避免误传 npm。
如果你现在更关心“发包前还差什么”，可以直接看 [RELEASE.md](./RELEASE.md)。

默认产物：

- `dist/flowpilot.esm.js`
- `dist/flowpilot.umd.js`
- `dist/index.d.ts`

可选压缩产物：

- `dist/flowpilot.esm.min.js`
- `dist/flowpilot.umd.min.js`

## 安装与本地开发

```bash
cd flowpilot
npm install
```

构建标准产物：

```bash
npm run build
```

构建压缩产物：

```bash
npm run build:min
```

一次构建标准版和压缩版：

```bash
npm run build:all
```

类型检查：

```bash
npm run typecheck
```

运行测试：

```bash
npm run test:run
```

## 快速接入

当你的 guide 配置已经在代码里时，可以直接用 `createFlowPilot`。

```ts
import { createFlowPilot, PluginPresets } from "flowpilot";

const controller = createFlowPilot({
  guideId: "guide.open-account",
  rootStepId: "step_login",
  preset: PluginPresets.WEB_DEFAULT,
  steps: [
    {
      id: "step_login",
      when: "focus_login_btn && login_success",
      next: ["step_open_account"],
      ui: {
        selector: "#login-btn",
        content: "先完成登录，再进入后续流程。",
        position: "bottom"
      }
    }
  ]
});

controller.start();
```

## GuideDefinition 结构

最常用的是 `GuideDefinition`：

```ts
import type { GuideDefinition } from "flowpilot";

const definition: GuideDefinition = {
  id: "guide.profile-completion",
  rootStepId: "step_login",
  steps: [
    {
      id: "step_login",
      when: "focus_login_btn && login_success",
      next: ["step_profile_form"],
      ui: {
        selector: "#login-btn",
        content: "先登录系统。",
        position: "bottom"
      }
    }
  ]
};
```

单个 step 除了 `id`、`when`、`next` 之外，还可以继续用：

- `enterWhen`
- `cancelWhen`
- `ui.selector`
- `ui.content`
- `ui.position`
- `ui.nextLabel`

## 三种配置来源

### 1. 静态 TypeScript

```ts
import {
  createFlowPilotFromDefinition,
  PluginPresets,
  type GuideDefinition
} from "flowpilot";

const definition: GuideDefinition = {
  id: "guide.static-ts",
  rootStepId: "step_login",
  steps: []
};

const controller = createFlowPilotFromDefinition({
  definition,
  preset: PluginPresets.WEB_DEFAULT
});
```

### 2. 静态 JSON

```ts
import guideDefinition from "./guide.json";
import { createFlowPilotFromDefinition } from "flowpilot";

const controller = createFlowPilotFromDefinition({
  definition: guideDefinition
});
```

### 3. 异步加载

```ts
import { createFlowPilotAsync } from "flowpilot";

const controller = await createFlowPilotAsync({
  source: async () => {
    const response = await fetch("/api/guides/open-account");
    return response.json();
  }
});
```

这三种方式最终都会收敛成同一种 `GuideDefinition`。
所以后面从静态配置切换到接口返回时，调用方通常不用重写业务层结构。

## 多引导场景

如果一个系统里会存在多条 guide，但同一时刻只允许一条运行，推荐直接使用 `createGuideRegistryService`。

```ts
import {
  createGuideRegistryService,
  PluginPresets
} from "flowpilot";

const guides = createGuideRegistryService({
  preset: PluginPresets.WEB_DEFAULT,
  autoStart: true,
  destroyOnComplete: true,
  clearCacheOnDestroy: true,
  guides: [
    {
      id: "open-account",
      source: () => import("./open-account-guide.json").then((m) => m.default)
    },
    {
      id: "profile-completion",
      source: async () => {
        const response = await fetch("/api/guides/profile-completion");
        return response.json();
      }
    }
  ]
});

await guides.open("open-account");
guides.destroyCurrent({ clearCache: true });
await guides.open("profile-completion");
```

这套服务已经处理了几个高频动作：

- 打开指定 guide
- 关闭当前 guide
- 销毁当前 guide
- 获取当前运行中的 guide id

## 预设插件与可选插件

预设：

- `PluginPresets.WEB_DEFAULT`
  内置 `DOMPlugin`、`LoggerPlugin`、`DevToolsPlugin`
- `PluginPresets.TRACKING_ONLY`
  仅内置 `DOMPlugin`
- `PluginPresets.HEADLESS`
  不注入任何内置插件

可直接使用的插件：

- `DOMPlugin`
- `LoggerPlugin`
- `AxiosPlugin`
- `DevToolsPlugin`

## 配置覆盖

你可以通过 `config` 覆盖主题、UI 默认项和 runtime 行为。

```ts
import { createFlowPilotFromDefinition } from "flowpilot";

const controller = createFlowPilotFromDefinition({
  definition,
  config: {
    theme: {
      primaryColor: "#0f7bff",
      maskColor: "rgba(15, 23, 42, 0.58)"
    },
    ui: {
      defaultNextLabel: "继续"
    },
    runtime: {
      autoStart: true,
      pollingInterval: 50,
      persistence: {
        enabled: true
      }
    }
  }
});
```

## 和 example 的关系

仓库里的 Vue demo 不直接引用 SDK 源码，而是通过 Vite alias 消费本地 `dist/flowpilot.esm.js`。
这样做有两个目的：

- 验证打包产物本身是否真的能被业务项目消费
- 保持 example 中的导入写法和未来外部项目一致，仍然是 `import { ... } from "flowpilot"`

详细说明见：

- [`../examples/flowpilot-vue/README.md`](../examples/flowpilot-vue/README.md)

## 发布前说明

当前 `package.json` 的几个关键字段状态：

- `name: "flowpilot"`
- `version: "0.1.0"`
- `private: true`
- `license: "UNLICENSED"`

正式发布前，建议先看：

- [`./RELEASE.md`](./RELEASE.md)
