// src/sdk/guide/factory.ts

import { GuideController } from "./controller";
import { resolvePresetPlugins } from "../plugins/presets";
import type { FlowPlugin, GuideStep, FlowConfig } from "../types";

export interface FlowPilotOptions {
    steps: GuideStep[];
    rootStepId: string;
    config?: Partial<FlowConfig>;
    plugins?: FlowPlugin[];
    preset?: string;
}

function normalizePlugins(
    presetPlugins: FlowPlugin[],
    userPlugins: FlowPlugin[] = []
): FlowPlugin[] {

    const map = new Map<string, FlowPlugin>();

    for (const p of presetPlugins) {
        if (p?.name) map.set(p.name, p);
    }

    for (const p of userPlugins) {
        if (p?.name) map.set(p.name, p);
    }

    return Array.from(map.values());
}

export function createFlowPilot(options: FlowPilotOptions) {

    // 1. preset layer
    const presetPlugins = resolvePresetPlugins(
        (options as any).preset
    );

    // 2. merge layer
    const plugins = normalizePlugins(
        presetPlugins,
        options.plugins ?? []
    );

    // 3. runtime layer
    return new GuideController({
        steps: options.steps,
        rootStepId: options.rootStepId,
        config: options.config,
        plugins
    });
}
