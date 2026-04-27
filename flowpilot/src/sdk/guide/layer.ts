// src/sdk/guide/layer.ts

import { FlowConfig } from "../types";

export class TransitionLayer {
    private static readonly SPOTLIGHT_TRANSITION = "clip-path 0.18s ease-out";
    private readonly overlay: HTMLDivElement;
    private readonly tooltip: HTMLDivElement;
    private readonly contentBox: HTMLDivElement;
    private readonly nextBtn: HTMLButtonElement;
    private onNextClick?: () => void;

    constructor(config: FlowConfig) {
        this.overlay = document.createElement("div");
        this.tooltip = document.createElement("div");
        this.contentBox = document.createElement("div");
        this.nextBtn = document.createElement("button");
        this.init(config);
    }

    private init(config: FlowConfig) {
        const { theme } = config;

        Object.assign(this.overlay.style, {
            position: "fixed", inset: "0", zIndex: String(theme.zIndex - 1),
            background: theme.maskColor, pointerEvents: "none",
            transition: "none", display: "none", willChange: "clip-path"
        });

        Object.assign(this.tooltip.style, {
            position: "fixed", top: "0px", left: "0px",
            zIndex: String(theme.zIndex), background: "#fff",
            padding: "16px", borderRadius: theme.borderRadius, display: "none",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)", willChange: "transform"
        });

        Object.assign(this.nextBtn.style, {
            marginTop: "12px", padding: "6px 12px",
            background: theme.primaryColor, color: "#fff",
            border: "none", borderRadius: "4px", cursor: "pointer"
        });

        this.nextBtn.onclick = (e) => {
            e.stopPropagation();
            this.onNextClick?.();
        };

        this.tooltip.appendChild(this.contentBox);
        this.tooltip.appendChild(this.nextBtn);
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.tooltip);
    }

    public setOnNext(cb: () => void) {
        this.onNextClick = cb;
    }

    public highlight(rect: DOMRect, options?: { animate?: boolean }) {
        const left = Math.round(rect.left);
        const top = Math.round(rect.top);
        const right = Math.round(rect.right);
        const bottom = Math.round(rect.bottom);

        this.overlay.style.display = "block";
        this.overlay.style.transition = options?.animate
            ? TransitionLayer.SPOTLIGHT_TRANSITION
            : "none";
        this.overlay.style.clipPath = `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${left}px ${top}px, 
            ${left}px ${bottom}px, 
            ${right}px ${bottom}px, 
            ${right}px ${top}px, 
            ${left}px ${top}px
        )`;
    }

    /**
     * 🌟 恢复 show 方法，兼容 Renderer 的 render() 调用
     */
    public show(options: { x: number; y: number; content: string; nextLabel?: string }) {
        this.tooltip.style.display = "block";
        this.internalUpdate(options.x, options.y, options.content, options.nextLabel);
    }

    /**
     * 🌟 恢复 update 方法，兼容 Renderer 的 update() 调用
     */
    public update(options: { x: number; y: number; content?: string; nextLabel?: string }) {
        this.internalUpdate(options.x, options.y, options.content, options.nextLabel);
    }

    /**
     * 内部统一更新逻辑
     */
    private internalUpdate(x: number, y: number, content?: string, nextLabel?: string) {
        if (content !== undefined) {
            this.contentBox.innerHTML = content;
        }

        if (nextLabel) {
            this.nextBtn.innerText = nextLabel;
            this.nextBtn.style.display = "block";
        } else {
            this.nextBtn.style.display = "none";
        }

        const snappedX = Math.round(x);
        const snappedY = Math.round(y);
        this.tooltip.style.transform = `translate3d(${snappedX}px, ${snappedY}px, 0)`;
    }

    public hide() {
        this.overlay.style.display = "none";
        this.tooltip.style.display = "none";
    }

    public destroy() {
        this.hide();
        this.onNextClick = undefined;
        this.nextBtn.onclick = null;
        this.overlay.remove();
        this.tooltip.remove();
    }
}
