# FlowPilot SDK 发布说明

这份文档专门回答两类问题：

- 现在这个包处于什么发布状态
- 真要往外发 npm 包时，还需要补哪些动作

## 当前状态

`flowpilot/package.json` 当前关键信息如下：

- `name`: `flowpilot`
- `version`: `0.1.0`
- `private`: `true`
- `license`: `UNLICENSED`
- `main`: `./dist/flowpilot.umd.js`
- `module`: `./dist/flowpilot.esm.js`
- `types`: `./dist/index.d.ts`

这说明它已经具备“可打包、可被项目消费”的条件，但还没有进入“可直接公开发布”的状态。

## 现在已经具备的发布基础

- Vite library build
- ESM / UMD 双产物
- TypeScript 声明文件输出
- `exports` 已指向 dist 产物
- Vitest 可独立运行，不再依赖 Vite build 配置
- example 已通过本地 dist 验证接入链路

## 正式发布前建议完成的事项

### 1. 确认 license

当前是 `UNLICENSED`。
如果后面准备公开发布，需要先明确：

- 开源许可证
- 还是仅内部 / 商业闭源使用

### 2. 决定是否移除 `private: true`

只有在明确准备发布时，才建议移除。
在此之前保留 `private: true` 是一个很好的保险丝。

### 3. 复核 package name

真正发布到 npm 前，最好先确认：

- `flowpilot` 这个名字是否要沿用
- 是否需要带 scope，比如 `@your-scope/flowpilot`

### 4. 复核对外入口

发布前至少再检查一次：

- `src/index.ts` 是否只暴露准备长期维护的 API
- `package.json` 的 `exports` 是否覆盖预期入口
- 是否需要补子路径导出

### 5. 补 changelog / 首发说明

第一次对外发布时，建议明确告诉接入方：

- 当前已经稳定的能力
- 仍在演进的能力
- 暂时不承诺兼容的部分

## 发布前检查清单

推荐最少执行这组验证：

```bash
cd flowpilot
npm install
npm run build
npm run build:min
npm run test:run
```

再验证 example：

```bash
cd ../examples/flowpilot-vue
npm install
npm run build
```

## 关于 example 为啥会产出 `index.html`

这是正常的，不是 SDK 打包配置错了。

- `flowpilot/` 是 SDK，构建结果只有 JS + d.ts
- `examples/flowpilot-vue/` 是应用 demo，所以构建后会有 `index.html`

发布 SDK 时，只看 `flowpilot/dist/` 即可，不需要把 example 的页面产物带出去。

## 关于为什么 example 通过 alias 使用 dist

当前 example 通过 `vite.config.ts` 把 `flowpilot` 映射到本地 `dist/flowpilot.esm.js`。
这套方式的核心价值是：

- 提前验证“包产物”而不是“源码路径”
- 让 example 的写法和未来业务项目一致
- 后面切换到 npm 包时，业务导入路径不需要大改

## 一句话建议

如果你现在是内部阶段、还在继续收敛 API，维持当前状态最稳妥：

- 保留 `private: true`
- 保留 `UNLICENSED`
- 继续通过 example 验证 dist
- 等 README、测试和对外 API 再稳定一轮后再考虑首发
