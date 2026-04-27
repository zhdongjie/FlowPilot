import type {
    FlowConfigOverride,
    GuideDefinition,
    GuideSource,
    GuideStep
} from "../types";
import { cloneStepSnapshot } from "../runtime/step-snapshot";

function isGuideLoader(source: GuideSource): source is () => GuideDefinition | Promise<GuideDefinition> {
    return typeof source === "function";
}

function cloneGuideConfig(config?: FlowConfigOverride): FlowConfigOverride | undefined {
    if (!config) return undefined;

    return {
        ...config,
        theme: config.theme ? { ...config.theme } : undefined,
        ui: config.ui ? { ...config.ui } : undefined,
        runtime: config.runtime
            ? {
                ...config.runtime,
                persistence: config.runtime.persistence
                    ? { ...config.runtime.persistence }
                    : undefined,
                signalPrefix: config.runtime.signalPrefix
                    ? { ...config.runtime.signalPrefix }
                    : undefined
            }
            : undefined
    };
}

function cloneGuideStep(step: GuideStep): GuideStep {
    return {
        ...cloneStepSnapshot(step),
        ui: step.ui ? { ...step.ui } : undefined
    };
}

export function cloneGuideDefinition(definition: GuideDefinition): GuideDefinition {
    return {
        id: definition.id,
        rootStepId: definition.rootStepId,
        steps: definition.steps.map(step => cloneGuideStep(step)),
        config: cloneGuideConfig(definition.config)
    };
}

export async function resolveGuideDefinition(source: GuideSource): Promise<GuideDefinition> {
    const resolved = isGuideLoader(source) ? source() : source;
    const definition = await resolved;

    return cloneGuideDefinition(definition);
}
