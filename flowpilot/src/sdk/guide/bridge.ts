import type { FlowRuntime } from "../runtime/runtime";
import { GuideRenderer } from "./renderer";
import type { GuideStep } from "../types";

export class GuideBridge {
    private readonly renderer = new GuideRenderer();
    private readonly runtime: FlowRuntime;
    private readonly steps: GuideStep[];

    constructor(runtime: FlowRuntime, steps: GuideStep[]) {
        this.runtime = runtime;
        this.steps = steps;
    }

    mount() {
        // 核心：监听引擎状态，状态一变，UI 立即同步
        // 我们利用 dispatch 后的微任务检查状态
        const originalDispatch = this.runtime.dispatch.bind(this.runtime);
        this.runtime.dispatch = (sig) => {
            originalDispatch(sig);
            this.syncUI();
        };
        this.syncUI();
    }

    private syncUI() {
        const activeId = this.runtime.activeSteps[0];
        const step = this.steps.find(s => s.id === activeId);

        if (step?.ui) {
            this.renderer.render(step.ui);
        } else {
            this.renderer.clear();
        }
    }
}
