// flowpilot/src/sdk/index.ts

import {FlowEngine} from './core/engine';
import {FlowParser} from './compiler/parser';
import type {Condition, Step} from './types';

export { FlowEngine } from './core/engine';
export { FlowParser } from './compiler/parser';
export { GuideController } from "./guide/controller";
export type { GuideStep } from "./types/guide";

export { AxiosAdapter } from "./collector/adapters";
export type { NetworkAdapter, EmitFunction } from "./types/collector";

export { FlowDevTools } from './devtools/controller';
export type { FlowRuntime } from './runtime/runtime';

// 定义用户可能传入的带字符串语法糖的 Step
export interface DslStep extends Omit<Step, 'when'> {
    when: string | Condition;
}

/**
 * FlowPilot 工业级入口点
 * 自动拦截字符串 DSL 并将其编译为 AST，随后启动引擎
 */
export function createFlowPilot(steps: DslStep[], rootId: string): FlowEngine {
    const compiledSteps: Step[] = steps.map(step => {
        if (typeof step.when === 'string') {
            return {
                ...step,
                when: FlowParser.parse(step.when)
            };
        }
        return step as Step;
    });

    return new FlowEngine(compiledSteps, rootId);
}

