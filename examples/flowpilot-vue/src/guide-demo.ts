import type { InjectionKey } from "vue";
import axios from "axios";
import {
    AxiosPlugin,
    LoggerPlugin,
    PluginPresets,
    createGuideRegistryService,
    type FlowPlugin,
    type FlowConfigOverride,
    type GuideController
} from "flowpilot";

import {
    getDemoGuideMetaList,
    getDemoGuideRegistration,
    type DemoGuideId,
    type DemoGuideMeta
} from "./guides/catalog";

export type { DemoGuideId, DemoGuideMeta } from "./guides/catalog";

export interface DemoGuideService {
    listGuides(): DemoGuideMeta[];
    openGuide(id: DemoGuideId): Promise<GuideController | null>;
    destroyCurrentGuide(options?: { clearCache?: boolean }): GuideController | null;
    getCurrentGuideId(): string | null;
}

export interface DemoGuideServiceOptions {
    preset?: string;
    plugins?: FlowPlugin[];
    config?: FlowConfigOverride;
    autoStart?: boolean;
    destroyOnComplete?: boolean;
    clearCacheOnDestroy?: boolean;
}

export const demoGuideServiceKey: InjectionKey<DemoGuideService> = Symbol("demoGuideService");

const baseGuideConfig: FlowConfigOverride = {
    theme: {
        primaryColor: "#0f7bff",
        maskColor: "rgba(15, 23, 42, 0.58)",
        borderRadius: "12px",
        textColor: "#1f2937",
        zIndex: 9999
    },
    ui: {
        defaultPosition: "bottom",
        defaultNextLabel: "继续"
    },
    runtime: {
        pollingInterval: 50,
        autoStart: true,
        attributeName: "data-fp",
        signalPrefix: {
            click: "click_",
            focus: "focus_",
            blur: "blur_",
            input: "input_"
        },
        persistence: {
            enabled: true
        }
    }
};

function createGuidePlugins() {
    return [
        AxiosPlugin({
            instance: axios,
            extractor: (response) => {
                if (response.status === 200 && response.data?.code) {
                    return response.data.code;
                }

                return null;
            }
        }),
        LoggerPlugin({
            prefix: "FlowPilot-Demo",
            ignoreNoise: true,
            showTiming: true
        })
    ];
}

export function createDemoGuideService(
    options: DemoGuideServiceOptions = {}
): DemoGuideService {
    const registryService = createGuideRegistryService<DemoGuideId>({
        guides: getDemoGuideMetaList().map((guide) => {
            const registration = getDemoGuideRegistration(guide.id);

            if (!registration) {
                throw new Error(`Unknown demo guide registration: ${guide.id}`);
            }

            return {
                id: guide.id,
                source: registration.source,
                config: registration.config
            };
        }),
        preset: options.preset ?? PluginPresets.WEB_DEFAULT,
        plugins: mergeDemoPlugins(createGuidePlugins(), options.plugins ?? []),
        config: mergeGuideConfig(baseGuideConfig, options.config),
        autoStart: options.autoStart ?? true,
        destroyOnComplete: options.destroyOnComplete ?? true,
        clearCacheOnDestroy: options.clearCacheOnDestroy ?? true
    });

    return {
        listGuides() {
            return getDemoGuideMetaList();
        },

        openGuide(id) {
            return registryService.open(id);
        },

        destroyCurrentGuide(options) {
            return registryService.destroyCurrent({
                clearCache: options?.clearCache ?? true
            });
        },

        getCurrentGuideId() {
            return registryService.getCurrentGuideId();
        }
    };
}

function mergeGuideConfig(
    base: FlowConfigOverride,
    override?: FlowConfigOverride
): FlowConfigOverride {
    if (!override) {
        return {
            ...base,
            theme: { ...base.theme },
            ui: { ...base.ui },
            runtime: {
                ...base.runtime,
                persistence: { ...base.runtime?.persistence },
                signalPrefix: { ...base.runtime?.signalPrefix }
            }
        };
    }

    return {
        ...base,
        ...override,
        theme: {
            ...base.theme,
            ...override.theme
        },
        ui: {
            ...base.ui,
            ...override.ui
        },
        runtime: {
            ...base.runtime,
            ...override.runtime,
            persistence: {
                ...base.runtime?.persistence,
                ...override.runtime?.persistence
            },
            signalPrefix: {
                ...base.runtime?.signalPrefix,
                ...override.runtime?.signalPrefix
            }
        }
    };
}

function mergeDemoPlugins(
    defaultPlugins: FlowPlugin[],
    userPlugins: FlowPlugin[]
): FlowPlugin[] {
    const pluginsByName = new Map<string, FlowPlugin>();

    for (const plugin of defaultPlugins) {
        pluginsByName.set(plugin.name, plugin);
    }

    for (const plugin of userPlugins) {
        pluginsByName.set(plugin.name, plugin);
    }

    return Array.from(pluginsByName.values());
}
