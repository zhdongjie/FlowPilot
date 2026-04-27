// src/sdk/guide/orchestrator.ts
import type { FlowRuntime } from "../runtime/runtime";
import type { FlowConfig, GuideStep } from "../types";
import { DOMTracker } from "./dom-tracker";
import { StepScheduler } from "./scheduler";
import { GuideRenderer } from "./renderer";

/**
 * 编排层：负责将 Engine 的状态转化为 UI 的展示
 */
export class GuideOrchestrator {
    private readonly runtime: FlowRuntime;
    private readonly stepsMap: Map<string, GuideStep>;

    private readonly tracker = new DOMTracker();
    private readonly scheduler = new StepScheduler();
    private readonly renderer: GuideRenderer;

    private currentStepId: string | null = null;
    private running = false;

    private readonly config: FlowConfig;

    constructor(runtime: FlowRuntime, steps: GuideStep[], config: FlowConfig) {
        this.runtime = runtime;
        this.stepsMap = new Map(steps.map(s => [s.id, s]));
        this.config = config;
        this.renderer = new GuideRenderer(this.config);
    }

    /**
     * 启动编排轮询
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    /**
     * 停止编排并隐藏 UI
     */
    stop() {
        this.running = false;
        this.renderer.hide();
    }

    destroy() {
        this.stop();
        this.currentStepId = null;
        this.renderer.destroy();
    }

    /**
     * 独立的主循环，解耦 Engine 的判定频率
     */
    private async loop() {
        while (this.running) {
            await this.tick();
            // 降低轮询频率，平衡性能与即时性（默认 50ms）
            await new Promise(r => setTimeout(r, this.config.runtime.pollingInterval));
        }
    }

    /**
     * 核心调度逻辑
     */
    private async tick() {
        const active = this.runtime.activeSteps;
        const nextId = this.scheduler.pick(active);

        // 1. 如果当前没有活跃步骤，清空渲染
        if (!nextId) {
            this.renderer.hide();
            this.currentStepId = null;
            return;
        }

        // 2. 如果步骤未变化，仅执行渲染更新（例如处理页面滚动/位置同步）
        if (this.currentStepId === nextId) {
            this.renderer.update();
            return;
        }

        const step = this.stepsMap.get(nextId);
        if (!step?.ui) return;

        // 确保在单页应用页面切换时，能够等到下一个按钮出现
        const el = await this.tracker.waitFor(step.ui.selector);

        if (!this.running) {
            return;
        }

        if (!el) {
            // 如果超时未找到元素，隐藏引导以防错位
            this.renderer.hide();
            return;
        }

        // 4. 万事俱备，执行渲染
        this.currentStepId = nextId;
        this.renderer.render(step, el);
    }

    public getRenderer() {
        return this.renderer;
    }
}
