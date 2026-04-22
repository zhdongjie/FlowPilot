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
    public readonly config: FlowConfig;

    constructor(options: {
        steps: GuideStep[];
        rootStepId: string;
        config?: Partial<FlowConfig>; // 接受部分配置覆盖
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
            rootStepId: options.rootStepId,
            config: this.config
        });

        // 4. 初始化采集层 (从 config 中提取适配器)
        this.collector = new BehaviorCollector(this.runtime, this.config);

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
            const activeId = this.runtime.activeSteps[0];
            if (!activeId) return;

            // 调试模式日志
            if (this.config.debug) {
                console.log(`[FlowPilot] 🖱️ 用户点击“下一步”: ${activeId}`);
            }

            // 触发步骤完成钩子
            this.config.hooks.onStepComplete?.(activeId);

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
                if (this.config.debug) {
                    console.log(`💤 [FlowPilot] 检查到已通关记录，引导引擎自动休眠。`);
                }
                return; // 极速退出，一丁点性能都不浪费！
            }
        }

        if (this.config.debug) {
            console.log("🚀 [FlowPilot] 引导引擎启动...");
        }

        this.runtime.start();

        // 2. 正常启动流程
        this.collector.mount();
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
