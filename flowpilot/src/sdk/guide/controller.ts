// src/sdk/guide/controller.ts
import { FlowRuntime } from "../runtime/runtime";
import { GuideOrchestrator } from "./orchestrator";
import type { FlowPlugin, GuideStep } from "../types";
import { FlowParser } from "../compiler/parser";
import { FlowConfig, DEFAULT_CONFIG } from "../types";

export class GuideController {
    public readonly runtime: FlowRuntime
    private readonly orchestrator: GuideOrchestrator;
    public readonly config: FlowConfig;

    constructor(options: {
        steps: GuideStep[];
        rootStepId: string;
        config?: Partial<FlowConfig>;
        plugins?: FlowPlugin[];
    }) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...options.config,
            ui: { ...DEFAULT_CONFIG.ui, ...options.config?.ui },
            runtime: { ...DEFAULT_CONFIG.runtime, ...options.config?.runtime }
        };

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

    private compileSteps(steps: GuideStep[]) {
        return steps.map(step => {
            const parsed = { ...step };
            const p = FlowParser;
            if (typeof parsed.when === 'string') parsed.when = p.parse(parsed.when);
            if (typeof parsed.enterWhen === 'string') parsed.enterWhen = p.parse(parsed.enterWhen);
            if (typeof parsed.cancelWhen === 'string') parsed.cancelWhen = p.parse(parsed.cancelWhen);
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

        // 1. 最高优先级的拦截：检查是否已经全剧终
        if (persistence.enabled) {
            // 我们约定：全剧终的标记键名是配置 key 加上 '_finished'
            const isFinished = localStorage.getItem(`${persistence.key}_finished`);
            if (isFinished === 'true') {
                return;
            }
        }

        this.runtime.start();

        // 2. 正常启动流程
        this.orchestrator.start();

        // 3. 发射初始脉冲
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
}
