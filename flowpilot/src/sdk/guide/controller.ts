// src/sdk/guide/controller.ts
import { FlowRuntime } from "../runtime/runtime";
import { BehaviorCollector } from "../collector/collector";
import { GuideOrchestrator } from "./orchestrator";
import type { GuideStep } from "../types";
import { FlowParser } from "../compiler/parser";
import { FlowConfig, DEFAULT_CONFIG } from "../types";

export class GuideController {
    public readonly runtime: FlowRuntime;
    public readonly collector: BehaviorCollector;
    private readonly orchestrator: GuideOrchestrator;
    private readonly config: FlowConfig;

    constructor(options: {
        steps: GuideStep[];
        rootStepId: string;
        config?: Partial<FlowConfig>; // 🌟 接受部分配置覆盖
    }) {
        // 1. 深度合并配置 (用传入的覆盖默认的)
        this.config = {
            ...DEFAULT_CONFIG,
            ...options.config,
            ui: { ...DEFAULT_CONFIG.ui, ...options.config?.ui },
            runtime: { ...DEFAULT_CONFIG.runtime, ...options.config?.runtime }
        };

        // 2. 预处理 Steps (AST 编译)
        const compiledSteps = this.compileSteps(options.steps);

        // 3. 初始化内核
        this.runtime = new FlowRuntime({
            steps: compiledSteps,
            rootStepId: options.rootStepId
        });

        // 4. 初始化采集层 (从 config 中提取适配器) 🌟
        this.collector = new BehaviorCollector(this.runtime, this.config.adapters);

        // 5. 初始化编排层 (传入配置供 UI 使用)
        this.orchestrator = new GuideOrchestrator(this.runtime, compiledSteps, this.config);

        // 6. 绑定内置信号 (下一步按钮)
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
            const activeStepId = this.runtime.activeSteps[0];
            if (activeStepId) {
                this.runtime.dispatch({
                    id: `btn_${Date.now()}`,
                    key: `click_next_${activeStepId}`,
                    timestamp: Date.now()
                });
            }
        });
    }

    public start() {
        this.collector.mount();
        this.orchestrator.start();
        this.runtime.start();

        // 根据配置决定是否自启
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
