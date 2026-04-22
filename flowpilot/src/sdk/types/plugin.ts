// src/sdk/types/plugin.ts

import type { FlowRuntime } from "../runtime/runtime";
import type { FlowEngine } from "../core/engine";
import type { Signal } from "./signal";
import type { FlowConfig } from "./config";

export interface FlowPluginContext {
    // 1. 核心实例
    runtime: FlowRuntime;
    engine: FlowEngine;
    config: FlowConfig;

    // 2. 状态获取
    getState: () => {
        activeSteps: string[];
        completedSteps: string[];
        isFinished: boolean;
    };
    now: () => number;

    // 3. 行为控制
    dispatch: (signal: Signal) => void;

    // 4. 🌟 插件通信总线 (Event Bus)
    // 允许插件互相发消息，比如 emit('UI:ShowTooltip', { stepId: 'xxx' })
    emit: (event: string, payload?: any) => void;
    on: (event: string, callback: (payload: any) => void) => () => void; // 返回 unsubscribe 函数
}

export interface FlowPlugin {
    /** 插件唯一名称 */
    name: string;

    // ==========================================
    // 🚀 生命周期钩子
    // ==========================================
    setup?(ctx: FlowPluginContext): void;
    onStart?(ctx: FlowPluginContext): void;
    onStop?(ctx: FlowPluginContext): void;

    // ==========================================
    // 🛡️ 拦截器钩子 (Middleware)
    // ==========================================
    /**
     * 当信号到达时触发。
     * @returns 返回 false 则拦截该信号，阻止其进入 Engine；不返回或返回 true 则放行。
     */
    onSignal?(signal: Signal, ctx: FlowPluginContext): boolean | void;

    // ==========================================
    // 🔄 状态流转钩子
    // ==========================================
    onStepStart?(stepId: string, ctx: FlowPluginContext): void;
    onStepComplete?(stepId: string, ctx: FlowPluginContext): void;

    /** 🌟 整个剧本全部通关时触发 */
    onFlowComplete?(ctx: FlowPluginContext): void;

    /** 🌟 引擎或运行时发生错误时触发，方便做异常监控 */
    onError?(error: Error, ctx: FlowPluginContext): void;

    // ==========================================
    // 🎨 渲染钩子
    // ==========================================
    onRender?(ctx: FlowPluginContext): void;
}

export interface AxiosPluginOptions {
    instance: any;

    extractor?: (res: any) => string | null | undefined;
    
    name?: string;
    enableErrorHook?: boolean;
    timeout?: number;
}
