// src/sdk/guide/factory.ts

import { GuideController } from "./controller";
import { FlowConfig, FlowPlugin, GuideStep } from "../types";
import { resolvePresetPlugins } from "../plugins/presets";
import { mergePlugins } from "../plugins/merge";

export interface FlowPilotOptions {
    steps: GuideStep[];
    rootStepId: string;
    preset?: string;
    plugins?: FlowPlugin[];
    config?: Partial<FlowConfig>;
}

export function createFlowPilot(options: FlowPilotOptions) {

    // 1. preset plugins
    const presetPlugins = resolvePresetPlugins(
        options.preset as any
    );

    // 2. user plugins
    const userPlugins = options.plugins ?? [];

    // 3. merge (唯一策略点)
    const plugins = mergePlugins(presetPlugins, userPlugins);

    return new GuideController({
        steps: options.steps,
        rootStepId: options.rootStepId,
        config: options.config,
        plugins
    });
}
