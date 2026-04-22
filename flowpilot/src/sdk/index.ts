// flowpilot/src/sdk/index.ts

// ---------------- Core ----------------
export { FlowEngine } from './core/engine';
export { FlowParser } from './compiler/parser';
export { GuideController } from "./guide/controller";
export { FlowRuntime } from './runtime/runtime';

// ---------------- Types ----------------
export type { GuideStep } from "./types/guide";
export type { NetworkAdapter, EmitFunction } from "./types/collector";

// ---------------- Collector ----------------
export { AxiosAdapter } from "./collector/adapters";

// ---------------- DevTools Core ----------------
export { FlowDevTools } from './devtools/controller';
export { buildGraph } from "./devtools/dag/builder";
export { DevToolsPlugin } from './devtools/plugin';

// ---------------- DevTools UI（可选导出）----------------
export { FlowDevToolsPanel } from "./devtools/viewer/panel";

export { createFlowGuide } from "./guide/factory";


// ---------------- DSL 工厂 ----------------
import { FlowEngine } from './core/engine';
import { FlowParser } from './compiler/parser';
import type { Condition, Step } from './types';

export interface DslStep extends Omit<Step, 'when'> {
    when: string | Condition;
}

/**
 * FlowPilot 工业级入口点
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
