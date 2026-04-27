// src/sdk/guide/renderer.ts

import type { FlowConfig, GuideStep } from "../types";
import { TransitionLayer } from "./layer";
import { PositionEngine } from "./position";

export class GuideRenderer {
    private readonly layer: TransitionLayer;
    private readonly position = new PositionEngine();
    private readonly resizeObserver =
        typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => this.handleViewportChange())
            : null;
    private readonly handleViewportChange = () => {
        if (!this.lastTarget) return;
        this.update();
        this.scheduleSettledUpdate();
    };
    private lastTarget: HTMLElement | null = null;
    private lastStep: GuideStep | null = null;
    private frameId: number | null = null;
    private readonly config: FlowConfig;

    constructor(config: FlowConfig) {
        this.layer = new TransitionLayer(config);
        this.config = config;
        this.bindViewportSync();
    }

    /**
     * 纯同步渲染逻辑
     */
    render(step: GuideStep, el: HTMLElement) {
        this.observeTarget(el);
        this.lastTarget = el;
        this.lastStep = step;

        const rect = el.getBoundingClientRect();
        this.layer.highlight(rect, { animate: true });
        if(!step.ui) return

        const pos = this.position.compute(rect, this.resolvePosition(step));

        this.layer.show({
            x: pos.x,
            y: pos.y,
            content: step.ui.content,
            nextLabel: this.resolveNextLabel(step)
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
        this.layer.highlight(rect, { animate: false });
        if(!this.lastStep.ui) return
        const pos = this.position.compute(rect, this.resolvePosition(this.lastStep));

        this.layer.update({
            x: pos.x,
            y: pos.y,
            content: this.lastStep.ui.content,
            nextLabel: this.resolveNextLabel(this.lastStep)
        });
    }

    hide() {
        this.cancelScheduledUpdate();
        this.resizeObserver?.disconnect();
        this.layer.hide();
        this.lastTarget = null;
        this.lastStep = null;
    }

    destroy() {
        this.unbindViewportSync();
        this.cancelScheduledUpdate();
        this.hide();
        this.layer.destroy();
    }

    public getLayer() {
        return this.layer;
    }

    private bindViewportSync() {
        document.addEventListener("scroll", this.handleViewportChange, true);
        window.addEventListener("resize", this.handleViewportChange, { passive: true });
        window.visualViewport?.addEventListener("scroll", this.handleViewportChange, { passive: true });
        window.visualViewport?.addEventListener("resize", this.handleViewportChange, { passive: true });
    }

    private unbindViewportSync() {
        document.removeEventListener("scroll", this.handleViewportChange, true);
        window.removeEventListener("resize", this.handleViewportChange);
        window.visualViewport?.removeEventListener("scroll", this.handleViewportChange);
        window.visualViewport?.removeEventListener("resize", this.handleViewportChange);
    }

    private cancelScheduledUpdate() {
        if (this.frameId === null) return;
        window.cancelAnimationFrame(this.frameId);
        this.frameId = null;
    }

    private scheduleSettledUpdate() {
        if (this.frameId !== null) return;
        this.frameId = window.requestAnimationFrame(() => {
            this.frameId = null;
            this.update();
        });
    }

    private observeTarget(el: HTMLElement) {
        if (!this.resizeObserver) return;
        this.resizeObserver.disconnect();
        this.resizeObserver.observe(el);
    }

    private resolvePosition(step: GuideStep) {
        return step.ui?.position || this.config.ui.defaultPosition;
    }

    private resolveNextLabel(step: GuideStep) {
        if (!step.ui) return undefined;
        if (typeof step.ui.nextLabel === "string") {
            return step.ui.nextLabel;
        }
        if (step.ui.nextLabel === true) {
            return this.config.ui.defaultNextLabel;
        }
        return undefined;
    }
}
