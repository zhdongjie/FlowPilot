// flowpilot/src/sdk/index.ts

// ==========================================
// 1. 核心导出 (Core & Logic)
// ==========================================
export { GuideController } from './guide/controller';
export { FlowRuntime } from './runtime/runtime';
export { FlowParser } from './compiler/parser';
export { FlowEngine } from './core/engine';

// ==========================================
// 2. 插件系统 (Plugin System)
// ==========================================
// 导出插件协议与官方内置插件
export type { FlowPlugin, FlowPluginContext } from './types/plugin';
export { DevToolsPlugin } from './devtools/plugin';
export { LoggerPlugin } from './plugins/logger';
export { AxiosPlugin } from './plugins/axios';
export { DOMPlugin } from "./plugins/dom";

// ==========================================
// 3. 类型定义 (Types)
// ==========================================
export type {
    GuideStep,
    GuideDefinition,
    GuideSource,
    FlowConfig,
    FlowConfigOverride,
    Step,
    Condition,
    Signal
} from './types'
export { PluginPresets } from './plugins/presets'

// ==========================================
// 4. 工厂函数
// ==========================================
/**
 * FlowPilot 工业级入口点
 * * @param options.steps 引导步骤定义
 * @param options.rootStepId 初始步骤 ID
 * @param options.config 全局配置覆盖
 * @param options.plugins 插件列表 (如 DevToolsPlugin, LoggerPlugin)
 * * @returns 返回集成了采集、编排、渲染、插件系统的 GuideController 总控类
 */
// ==========================================
// 5. 工厂函数 (提供极简接入)
// ==========================================
export {
    createFlowPilot,
    createFlowPilotFromDefinition,
    createFlowPilotAsync
} from './guide/factory';
export type {
    FlowPilotOptions,
    FlowPilotDefinitionOptions,
    FlowPilotAsyncOptions
} from './guide/factory';
export { GuideSessionManager } from './guide/session-manager';
export type {
    GuideSessionLifecycleOptions,
    GuideSessionOpenOptions
} from './guide/session-manager';
export { createGuideRegistryService } from './guide/registry-service';
export type {
    GuideRegistryEntry,
    GuideRegistryOpenOptions,
    GuideRegistryService,
    GuideRegistryServiceOptions
} from './guide/registry-service';
