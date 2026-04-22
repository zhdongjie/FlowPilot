// src/sdk/types/plugin.ts

import type { FlowRuntime } from "../runtime/runtime";
import type { FlowEngine } from "../core/engine";
import type { Signal } from "./signal";

export interface FlowPluginContext {
    runtime: FlowRuntime;
    engine: FlowEngine;
    // 允许插件安全地向引擎发射信号
    dispatch: (signal: Signal) => void;
    getState: () => {
        activeSteps: string[];
        completedSteps: string[];
    };
    now: () => number;
}

export interface FlowPlugin {
    name: string;
    setup?(ctx: FlowPluginContext): void;
    onStart?(ctx: FlowPluginContext): void;
    onStop?(ctx: FlowPluginContext): void;
    onSignal?(signal: Signal, ctx: FlowPluginContext): void;
    onStepStart?(stepId: string, ctx: FlowPluginContext): void;
    onStepComplete?(stepId: string, ctx: FlowPluginContext): void;
    onRender?(ctx: FlowPluginContext): void;
}
