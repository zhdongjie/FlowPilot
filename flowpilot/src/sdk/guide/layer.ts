// src/sdk/guide/layer.ts
export class TransitionLayer {
    private readonly overlay: HTMLDivElement;
    private readonly tooltip: HTMLDivElement;

    constructor() {
        this.overlay = document.createElement("div");
        this.tooltip = document.createElement("div");
        this.init();
    }

    private init() {
        Object.assign(this.overlay.style, {
            position: "fixed", inset: "0", zIndex: "9998",
            background: "rgba(0,0,0,0.6)", pointerEvents: "none",
            transition: "clip-path 0.25s ease-out", display: "none"
        });

        Object.assign(this.tooltip.style, {
            position: "fixed", top: "0px", left: "0px",
            zIndex: "9999", background: "#fff",
            padding: "16px", borderRadius: "8px", display: "none",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)", transition: "all 0.2s ease-out"
        });

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.tooltip);
    }

    highlight(rect: DOMRect) {
        this.overlay.style.display = "block";
        this.overlay.style.clipPath = `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${rect.left}px ${rect.top}px, 
            ${rect.left}px ${rect.bottom}px, 
            ${rect.right}px ${rect.bottom}px, 
            ${rect.right}px ${rect.top}px, 
            ${rect.left}px ${rect.top}px
        )`;
    }

    show({ x, y, content }: any) {
        this.tooltip.style.display = "block";
        this.update({ x, y });
        this.tooltip.innerHTML = content;
    }

    update({ x, y }: any) {
        this.tooltip.style.transform = `translate(${x}px, ${y}px)`;
    }

    hide() {
        this.overlay.style.display = "none";
        this.tooltip.style.display = "none";
    }
}
