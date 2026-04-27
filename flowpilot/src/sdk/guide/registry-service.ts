import type { FlowConfigOverride, FlowPlugin, GuideSource } from "../types";
import type { GuideController } from "./controller";
import { mergePlugins } from "../plugins/merge";
import { GuideSessionManager, type GuideSessionLifecycleOptions } from "./session-manager";

export interface GuideRegistryEntry<Id extends string = string> {
    id: Id;
    source: GuideSource;
    config?: FlowConfigOverride;
}

export interface GuideRegistryServiceOptions<Id extends string = string>
    extends GuideSessionLifecycleOptions {
    guides: GuideRegistryEntry<Id>[];
    preset?: string;
    plugins?: FlowPlugin[];
    config?: FlowConfigOverride;
}

export interface GuideRegistryOpenOptions extends GuideSessionLifecycleOptions {
    preset?: string;
    plugins?: FlowPlugin[];
    config?: FlowConfigOverride;
}

export interface GuideRegistryService<Id extends string = string> {
    list(): GuideRegistryEntry<Id>[];
    get(id: Id): GuideRegistryEntry<Id> | null;
    open(id: Id, options?: GuideRegistryOpenOptions): Promise<GuideController | null>;
    closeCurrent(): GuideController | null;
    destroyCurrent(options?: { clearCache?: boolean }): GuideController | null;
    getCurrent(): GuideController | null;
    getCurrentGuideId(): string | null;
}

export function createGuideRegistryService<Id extends string = string>(
    options: GuideRegistryServiceOptions<Id>
): GuideRegistryService<Id> {
    const sessionManager = new GuideSessionManager();
    const registry = new Map<Id, GuideRegistryEntry<Id>>();

    for (const guide of options.guides) {
        registry.set(guide.id, {
            id: guide.id,
            source: guide.source,
            config: cloneFlowConfig(guide.config)
        });
    }

    return {
        list() {
            return Array.from(registry.values()).map((guide) => ({
                id: guide.id,
                source: guide.source,
                config: cloneFlowConfig(guide.config)
            }));
        },

        get(id) {
            const guide = registry.get(id);
            if (!guide) return null;

            return {
                id: guide.id,
                source: guide.source,
                config: cloneFlowConfig(guide.config)
            };
        },

        open(id, openOptions) {
            const guide = registry.get(id);
            if (!guide) {
                throw new Error(`Unknown guide registry entry: ${id}`);
            }

            return sessionManager.open({
                source: guide.source,
                preset: openOptions?.preset ?? options.preset,
                plugins: mergePlugins(
                    options.plugins ?? [],
                    openOptions?.plugins ?? []
                ),
                config: mergeFlowConfig(
                    options.config,
                    guide.config,
                    openOptions?.config
                ),
                autoStart: openOptions?.autoStart ?? options.autoStart,
                destroyOnComplete: openOptions?.destroyOnComplete ?? options.destroyOnComplete,
                clearCacheOnDestroy: openOptions?.clearCacheOnDestroy ?? options.clearCacheOnDestroy
            });
        },

        closeCurrent() {
            return sessionManager.closeCurrent();
        },

        destroyCurrent(destroyOptions) {
            return sessionManager.destroyCurrent(destroyOptions);
        },

        getCurrent() {
            return sessionManager.getCurrent();
        },

        getCurrentGuideId() {
            return sessionManager.getCurrentGuideId();
        }
    };
}

function mergeFlowConfig(
    ...configs: Array<FlowConfigOverride | undefined>
): FlowConfigOverride | undefined {
    let merged: FlowConfigOverride | undefined;

    for (const config of configs) {
        if (!config) continue;

        merged = {
            ...merged,
            ...config,
            theme: {
                ...merged?.theme,
                ...config.theme
            },
            ui: {
                ...merged?.ui,
                ...config.ui
            },
            runtime: {
                ...merged?.runtime,
                ...config.runtime,
                persistence: {
                    ...merged?.runtime?.persistence,
                    ...config.runtime?.persistence
                },
                signalPrefix: {
                    ...merged?.runtime?.signalPrefix,
                    ...config.runtime?.signalPrefix
                }
            }
        };
    }

    return merged;
}

function cloneFlowConfig(config?: FlowConfigOverride): FlowConfigOverride | undefined {
    if (!config) return undefined;

    return mergeFlowConfig(config);
}
