import { GuideController } from "./controller";
import { resolveGuideDefinition } from "./definition";
import type {
    FlowConfigOverride,
    FlowPlugin,
    GuideDefinition,
    GuideSource,
    GuideStep
} from "../types";
import { resolvePresetPlugins } from "../plugins/presets";
import { mergePlugins } from "../plugins/merge";

export interface FlowPilotOptions {
    guideId?: string;
    steps: GuideStep[];
    rootStepId: string;
    preset?: string;
    plugins?: FlowPlugin[];
    config?: FlowConfigOverride;
}

export interface FlowPilotDefinitionOptions {
    definition: GuideDefinition;
    preset?: string;
    plugins?: FlowPlugin[];
    config?: FlowConfigOverride;
}

export interface FlowPilotAsyncOptions {
    source: GuideSource;
    preset?: string;
    plugins?: FlowPlugin[];
    config?: FlowConfigOverride;
}

function resolveMergedPlugins(preset?: string, plugins?: FlowPlugin[]) {
    const presetPlugins = resolvePresetPlugins(preset as any);
    const userPlugins = plugins ?? [];

    return mergePlugins(presetPlugins, userPlugins);
}

function mergeFlowConfig(
    base?: FlowConfigOverride,
    override?: FlowConfigOverride
): FlowConfigOverride | undefined {
    if (!base && !override) return undefined;

    return {
        ...base,
        ...override,
        theme: {
            ...base?.theme,
            ...override?.theme
        },
        ui: {
            ...base?.ui,
            ...override?.ui
        },
        runtime: {
            ...base?.runtime,
            ...override?.runtime,
            persistence: {
                ...base?.runtime?.persistence,
                ...override?.runtime?.persistence
            },
            signalPrefix: {
                ...base?.runtime?.signalPrefix,
                ...override?.runtime?.signalPrefix
            }
        }
    };
}

export function createFlowPilot(options: FlowPilotOptions) {
    const plugins = resolveMergedPlugins(options.preset, options.plugins);

    return new GuideController({
        guideId: options.guideId,
        steps: options.steps,
        rootStepId: options.rootStepId,
        config: options.config,
        plugins
    });
}

export function createFlowPilotFromDefinition(options: FlowPilotDefinitionOptions) {
    const plugins = resolveMergedPlugins(options.preset, options.plugins);
    const config = mergeFlowConfig(options.definition.config, options.config);

    return new GuideController({
        guideId: options.definition.id,
        steps: options.definition.steps,
        rootStepId: options.definition.rootStepId,
        config,
        plugins
    });
}

export async function createFlowPilotAsync(options: FlowPilotAsyncOptions) {
    const definition = await resolveGuideDefinition(options.source);

    return createFlowPilotFromDefinition({
        definition,
        preset: options.preset,
        plugins: options.plugins,
        config: options.config
    });
}
