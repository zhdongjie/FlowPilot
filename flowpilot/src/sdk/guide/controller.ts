import { FlowRuntime } from "../runtime/runtime";
import { GuideOrchestrator } from "./orchestrator";
import type { FlowPlugin, GuideStep } from "../types";
import { FlowParser } from "../compiler/parser";
import { FlowConfig, FlowConfigOverride, DEFAULT_CONFIG } from "../types";

export class GuideController {
    public readonly runtime: FlowRuntime;
    public readonly guideId: string;
    private readonly orchestrator: GuideOrchestrator;
    public readonly config: FlowConfig;

    constructor(options: {
        guideId?: string;
        steps: GuideStep[];
        rootStepId: string;
        config?: FlowConfigOverride;
        plugins?: FlowPlugin[];
    }) {
        this.guideId = options.guideId ?? options.rootStepId;
        this.config = this.resolveConfig(this.guideId, options.config);

        const compiledSteps = this.compileSteps(options.steps);

        this.runtime = new FlowRuntime({
            steps: compiledSteps,
            rootStepId: options.rootStepId,
            config: this.config,
            plugins: options.plugins
        });

        this.orchestrator = new GuideOrchestrator(this.runtime, compiledSteps, this.config);

        this.bindInternalSignals();
    }

    private resolveConfig(guideId: string, config?: FlowConfigOverride): FlowConfig {
        const merged: FlowConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            theme: { ...DEFAULT_CONFIG.theme, ...config?.theme },
            ui: { ...DEFAULT_CONFIG.ui, ...config?.ui },
            runtime: {
                ...DEFAULT_CONFIG.runtime,
                ...config?.runtime,
                persistence: {
                    ...DEFAULT_CONFIG.runtime.persistence,
                    ...config?.runtime?.persistence
                },
                signalPrefix: {
                    ...DEFAULT_CONFIG.runtime.signalPrefix,
                    ...config?.runtime?.signalPrefix
                }
            }
        };

        const hasExplicitPersistenceKey = Boolean(config?.runtime?.persistence?.key);
        if (!hasExplicitPersistenceKey && merged.runtime.persistence.enabled) {
            merged.runtime.persistence.key = `flowpilot:${guideId}`;
        }

        return merged;
    }

    private compileSteps(steps: GuideStep[]) {
        return steps.map(step => {
            const parsed = { ...step };
            const p = FlowParser;
            if (typeof parsed.when === "string") parsed.when = p.parse(parsed.when);
            if (typeof parsed.enterWhen === "string") parsed.enterWhen = p.parse(parsed.enterWhen);
            if (typeof parsed.cancelWhen === "string") parsed.cancelWhen = p.parse(parsed.cancelWhen);
            return parsed;
        });
    }

    private bindInternalSignals() {
        this.orchestrator.getRenderer().getLayer().setOnNext(() => {
            const activeId = this.runtime.activeSteps[0];
            if (!activeId) return;

            const clickPrefix = this.config.runtime.signalPrefix.click;
            this.runtime.dispatch({
                id: `btn_${Date.now()}`,
                key: `${clickPrefix}next_${activeId}`,
                timestamp: Date.now()
            });
        });
    }

    public start() {
        const { persistence } = this.config.runtime;

        if (persistence.enabled) {
            const isFinished = localStorage.getItem(`${persistence.key}_finished`);
            if (isFinished === "true") {
                return;
            }
        }

        this.runtime.start();
        this.orchestrator.start();

        if (this.config.runtime.autoStart && this.runtime.activeSteps.length === 0) {
            this.runtime.dispatch({
                id: `init_${Date.now()}`,
                key: "start",
                timestamp: Date.now()
            });
        }
    }

    public stop() {
        this.orchestrator.stop();
        this.runtime.stop();
    }

    public isFinished() {
        return this.runtime.isFinished();
    }

    public destroy(options?: { clearCache?: boolean }) {
        this.orchestrator.destroy();
        this.runtime.destroy(options);
    }
}
