// src/sdk/guide/renderer.ts

import type { FlowConfig, GuideStep } from "../types";
import { TransitionLayer } from "./layer";
import { PositionEngine } from "./position";

export class GuideRenderer {
    private readonly layer: TransitionLayer;
    private readonly position = new PositionEngine();
    private lastTarget: HTMLElement | null = null;
    private lastStep: GuideStep | null = null;
    private readonly config: FlowConfig;

    constructor(config: FlowConfig) {
        this.layer = new TransitionLayer(config);
        this.config = config;
    }

    /**
     * 纯同步渲染逻辑
     */
    render(step: GuideStep, el: HTMLElement, config: FlowConfig) {
        this.lastTarget = el;
        this.lastStep = step;

        const rect = el.getBoundingClientRect();
        this.layer.highlight(rect);
        if(!step.ui) return

        let finalNextLabel: string | undefined = undefined;

        const position = step.ui.position || config.ui.defaultPosition;

        if (typeof step.ui.nextLabel === 'string') {
            finalNextLabel = step.ui.nextLabel;
        } else if (step.ui.nextLabel === true) {
            finalNextLabel = config.ui.defaultNextLabel;
        }

        const pos = this.position.compute(rect, position);

        this.layer.show({
            x: pos.x,
            y: pos.y,
            content: step.ui.content,
            nextLabel: finalNextLabel
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

        let finalNextLabel: string | undefined = undefined;
        if (typeof this.lastStep.ui.nextLabel === 'string') {
            finalNextLabel = this.lastStep.ui.nextLabel;
        } else if (this.lastStep.ui.nextLabel === true) {
            finalNextLabel = this.config.ui.defaultNextLabel;
        }

        this.layer.update({
            x: pos.x,
            y: pos.y,
            content: this.lastStep.ui.content,
            nextLabel: finalNextLabel
        });
    }

    hide() {
        this.layer.hide();
        this.lastTarget = null;
        this.lastStep = null;
    }

    public getLayer() {
        return this.layer;
    }

}
