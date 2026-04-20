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

    private async syncUI() {
        // 1. 获取当前活跃的步骤 ID
        const activeId = this.runtime.activeSteps[0];

        // 2. 从剧本库中找到对应的完整 Step 对象
        const step = this.steps.find(s => s.id === activeId);

        // 3. 核心逻辑判断
        if (step?.ui) {
            const targetElement = document.querySelector(step.ui.selector) as HTMLElement;

            if (targetElement) {
                this.renderer.render(step, targetElement);
            } else {
                // 如果没找到元素（可能还没渲染出来），则暂时隐藏
                this.renderer.hide();
            }
        } else {
            this.renderer.hide();
        }
    }
}
