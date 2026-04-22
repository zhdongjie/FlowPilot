// src/sdk/devtools/viewer/dag-viewer.ts
import { DAGRenderCore } from "../dag/render-core";
import { buildGraph } from "../dag/builder";
import type { FlowDevTools } from "../controller";

export class DAGViewer {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private readonly renderer = new DAGRenderCore();
    private animationId = 0;

    private mouseX = -1;
    private mouseY = -1;
    private isRunning = false;

    constructor(
        private readonly devtools: FlowDevTools,
        private readonly container: HTMLElement
    ) {}

    mount() {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d")!;
        this.container.appendChild(this.canvas);

        this.resize();
        window.addEventListener("resize", this.resize);

        this.canvas.addEventListener("mousemove", this.onMouseMove);
        this.canvas.addEventListener("mouseleave", this.onMouseLeave);

        this.isRunning = true;
        this.loop();
    }

    unmount() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationId);
        window.removeEventListener("resize", this.resize);
    }

    private readonly resize = () => {
        const rect = this.container.getBoundingClientRect();
        // 适配 DPR 保证高清渲染
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);
    };

    private readonly onMouseMove = (e: MouseEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    };

    private readonly onMouseLeave = () => {
        this.mouseX = -1;
        this.mouseY = -1;
    };

    private readonly loop = () => {
        if (!this.isRunning) return;

        const diagnostics = this.devtools.getActiveDiagnostics();
        const active = diagnostics[0]; // 目前默认渲染第一个活跃树

        if (active) {
            const graph = buildGraph(active.tree, active.stepId);
            const rect = this.container.getBoundingClientRect();

            const hovered = this.renderer.draw(this.ctx, graph, {
                width: rect.width,
                height: rect.height,
                now: performance.now(), // 🌟 注入系统时间驱动动画
                activeEventKey: this.devtools.getHoveredEventKey(), // 🌟 获取全局联动高亮
                mouseX: this.mouseX,
                mouseY: this.mouseY
            });

            this.canvas.style.cursor = hovered ? 'help' : 'default';
        } else {
            // 如果没有活跃树，清屏
            const rect = this.container.getBoundingClientRect();
            this.ctx.clearRect(0, 0, rect.width, rect.height);
        }

        this.animationId = requestAnimationFrame(this.loop);
    };
}
