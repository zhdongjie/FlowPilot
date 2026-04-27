import type { GuideController } from "./controller";
import {
    createFlowPilot,
    createFlowPilotAsync,
    createFlowPilotFromDefinition,
    type FlowPilotAsyncOptions,
    type FlowPilotDefinitionOptions,
    type FlowPilotOptions
} from "./factory";

export interface GuideSessionLifecycleOptions {
    autoStart?: boolean;
    destroyOnComplete?: boolean;
    clearCacheOnDestroy?: boolean;
}

export type GuideSessionOpenOptions =
    (FlowPilotOptions | FlowPilotDefinitionOptions | FlowPilotAsyncOptions) &
    GuideSessionLifecycleOptions;

export class GuideSessionManager {
    private current: GuideController | null = null;
    private currentSub: (() => void) | null = null;
    private currentClearCacheOnDestroy = false;
    private openToken = 0;

    async open(options: GuideSessionOpenOptions): Promise<GuideController | null> {
        const token = ++this.openToken;

        this.teardownCurrent("destroy");

        const controller = await this.createController(options);

        if (token !== this.openToken) {
            controller.destroy();
            return null;
        }

        this.current = controller;
        this.currentClearCacheOnDestroy = options.clearCacheOnDestroy ?? false;
        this.currentSub = controller.runtime.subscribe(() => {
            if (this.current !== controller) return;
            if (!options.destroyOnComplete) return;
            if (!controller.isFinished()) return;

            this.destroyCurrent({
                clearCache: options.clearCacheOnDestroy
            });
        });

        if (options.autoStart !== false) {
            controller.start();
        }

        return controller;
    }

    closeCurrent(): GuideController | null {
        this.openToken++;
        return this.teardownCurrent("stop");
    }

    destroyCurrent(options?: { clearCache?: boolean }): GuideController | null {
        this.openToken++;
        return this.teardownCurrent("destroy", options?.clearCache);
    }

    getCurrent() {
        return this.current;
    }

    getCurrentGuideId() {
        return this.current?.guideId ?? null;
    }

    private async createController(options: GuideSessionOpenOptions): Promise<GuideController> {
        if ("source" in options) {
            return createFlowPilotAsync({
                source: options.source,
                preset: options.preset,
                plugins: options.plugins,
                config: options.config
            });
        }

        if ("definition" in options) {
            return createFlowPilotFromDefinition({
                definition: options.definition,
                preset: options.preset,
                plugins: options.plugins,
                config: options.config
            });
        }

        return createFlowPilot({
            guideId: options.guideId,
            steps: options.steps,
            rootStepId: options.rootStepId,
            preset: options.preset,
            plugins: options.plugins,
            config: options.config
        });
    }

    private teardownCurrent(
        action: "stop" | "destroy",
        clearCache?: boolean
    ): GuideController | null {
        const controller = this.current;
        if (!controller) return null;

        const resolvedClearCache = clearCache ?? this.currentClearCacheOnDestroy;

        this.currentSub?.();
        this.currentSub = null;
        this.current = null;
        this.currentClearCacheOnDestroy = false;

        if (action === "destroy") {
            controller.destroy({ clearCache: resolvedClearCache });
        } else {
            controller.stop();
        }

        return controller;
    }
}
