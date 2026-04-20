// src/sdk/guide/orchestrator.ts

import type { FlowRuntime } from "../runtime/runtime"; //
import type { GuideStep } from "../types";
import { DOMTracker } from "./dom-tracker";
import { StepScheduler } from "./scheduler";
import { GuideRenderer } from "./renderer";

export class GuideOrchestrator {
    private readonly runtime: FlowRuntime; //
    private readonly stepsMap: Map<string, GuideStep>;

    private readonly tracker = new DOMTracker();
    private readonly scheduler = new StepScheduler();
    private readonly renderer = new GuideRenderer();

    private currentStepId: string | null = null;
    private running = false;

    // 符合 erasableSyntaxOnly 的构造函数
    constructor(runtime: FlowRuntime, steps: GuideStep[]) {
        this.runtime = runtime;
        this.stepsMap = new Map(steps.map(s => [s.id, s]));
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    stop() {
        this.running = false;
        this.renderer.hide();
    }

    private async loop() {
        while (this.running) {
            await this.tick();
            // 降低轮询频率至 20Hz (50ms)，平衡性能与即时性
            await new Promise(r => setTimeout(r, 50));
        }
    }

    private async tick() {
        const active = this.runtime.activeSteps; //
        const nextId = this.scheduler.pick(active);

        // 1. 如果没有活跃步骤，直接清空渲染
        if (!nextId) {
            this.renderer.hide();
            this.currentStepId = null;
            return;
        }

        // 2. 如果步骤没变，让 Renderer 仅做位置刷新（应对滚动）
        if (this.currentStepId === nextId) {
            this.renderer.update();
            return;
        }

        const step = this.stepsMap.get(nextId);
        if (!step?.ui) return;

        // 3. 异步 DOM 等待逻辑被“封印”在 Orchestrator
        const el = await this.tracker.waitFor(step.ui.selector);

        if (!el) {
            this.renderer.hide();
            return;
        }

        // 4. 只有当“万事俱备”时，才调用 Renderer 进行同步绘制
        this.currentStepId = nextId;
        this.renderer.render(step, el);
    }

    public getRenderer() {
        return this.renderer;
    }

}
