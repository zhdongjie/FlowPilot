// src/sdk/devtools/dag/renderer.ts
import { DAGRenderCore } from "./render-core";
import type { Graph } from "./types";

export class DAGUIController {
    private core = new DAGRenderCore();
    private ctx: CanvasRenderingContext2D;
    private mouseX = -1;
    private mouseY = -1;
    private currentGraph: Graph | null = null;
    private activeKey: string | null = null;
    private isRunning = false;

    constructor(private canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext("2d")!;
        this.setupDPR();
        this.initEvents();
    }

    private setupDPR() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        const loop = () => {
            if (!this.isRunning) return;
            this.renderFrame();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    public stop() {
        this.isRunning = false;
    }

    private renderFrame() {
        if (!this.currentGraph) return;
        const rect = this.canvas.getBoundingClientRect();

        // 🌟 驱动核心：注入“当前的系统时间”
        // 以后如果要做录像回放，这里传入的就不再是 performance.now()，而是录像的时间戳
        const hovered = this.core.draw(this.ctx, this.currentGraph, {
            width: rect.width,
            height: rect.height,
            now: performance.now(), // ✅ 统一的时间源
            activeEventKey: this.activeKey,
            mouseX: this.mouseX,
            mouseY: this.mouseY
        });

        this.canvas.style.cursor = hovered ? 'help' : 'default';
    }

    public update(graph: Graph, activeKey?: string | null) {
        this.currentGraph = graph;
        this.activeKey = activeKey || null;
    }

    private initEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
    }
}
