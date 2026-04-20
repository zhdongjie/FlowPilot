// src/sdk/index.tx
import { FlowEngine } from './core/engine';
import { FlowCompiler } from './compiler/parser';
import type { Step, Condition } from './types';

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
                when: FlowCompiler.compile(step.when)
            };
        }
        return step as Step;
    });

    return new FlowEngine(compiledSteps, rootId);
}
