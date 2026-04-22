// flowpilot/src/sdk/index.ts

import { GuideController } from './guide/controller';
import type { GuideStep, FlowConfig } from './types';

// ==========================================
// 1. 核心导出
// ==========================================
export { GuideController } from './guide/controller';
export { FlowRuntime } from './runtime/runtime';
export { FlowParser } from './compiler/parser';
export type { GuideStep } from './types';

// ==========================================
// 2. 插件与配置
// ==========================================
export { AxiosAdapter } from "./collector/adapters";
export type { NetworkAdapter, EmitFunction } from "./types/collector";

// ==========================================
// 3. 开发者观测平台 (DevTools)
// ==========================================
export { FlowDevTools } from './devtools/controller';
export { FlowDevToolsPanel } from './devtools/viewer/panel';

// ==========================================
// 4. 工厂函数 (提供极简接入)
// ==========================================
export function createFlowPilot(options: {
    steps: GuideStep[];
    rootStepId: string;
    config?: Partial<FlowConfig>;
}): GuideController {
    // 直接返回你写好的、集成了采集、编排、渲染的总控类
    return new GuideController(options);
}
