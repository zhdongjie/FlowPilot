// src/sdk/guide/renderer.ts

import type { GuideStep } from "../types";
import { TransitionLayer } from "./layer";
import { PositionEngine } from "./position";

export class GuideRenderer {
    private readonly layer = new TransitionLayer();
    private readonly position = new PositionEngine();
    private lastTarget: HTMLElement | null = null;
    private lastStep: GuideStep | null = null;

    /**
     * 纯同步渲染逻辑
     */
    render(step: GuideStep, el: HTMLElement) {
        this.lastTarget = el;
        this.lastStep = step;

        const rect = el.getBoundingClientRect();
        this.layer.highlight(rect);
        if(!step.ui) return

        const pos = this.position.compute(rect, step.ui.position);
        this.layer.show({
            ...pos,
            content: step.ui.content
        });
    }

    /**
     * 仅做视觉刷新，无任何业务逻辑判断
     */
    update() {
        if (!this.lastTarget || !this.lastStep) return;

        if (!document.body.contains(this.lastTarget)) {
            this.hide();
            return;
        }

        const rect = this.lastTarget.getBoundingClientRect();
        this.layer.highlight(rect);
        if(!this.lastStep.ui) return
        const pos = this.position.compute(rect, this.lastStep.ui.position);
        this.layer.update(pos);
    }

    hide() {
        this.layer.hide();
        this.lastTarget = null;
        this.lastStep = null;
    }
}
