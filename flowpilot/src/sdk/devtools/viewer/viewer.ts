// src/sdk/devtools/viewer/viewer.ts
import { DAGRenderCore } from "../dag/render-core";
import { buildGraph } from "../dag/builder";
import type { FlowDevTools } from "../controller";

export class FlowDevToolsViewer {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private readonly renderer = new DAGRenderCore();

    private animationId = 0;

    private mouseX = -1;
    private mouseY = -1;

    constructor(private readonly options: {
        devtools: FlowDevTools;
        container: HTMLElement;
    }) {}

    mount() {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d")!;

        this.options.container.appendChild(this.canvas);

        this.resize();
        window.addEventListener("resize", this.resize);

        this.canvas.addEventListener("mousemove", this.onMouseMove);
        this.canvas.addEventListener("mouseleave", this.onMouseLeave);

        this.loop();
    }

    unmount() {
        cancelAnimationFrame(this.animationId);
        window.removeEventListener("resize", this.resize);
    }

    private readonly resize = () => {
        const rect = this.options.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
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
        const devtools = this.options.devtools;

        const diagnostics = devtools.getActiveDiagnostics();
        const active = diagnostics[0];

        if (active) {
            const graph = buildGraph(active.tree, active.stepId);

            this.renderer.draw(this.ctx, graph, {
                width: this.canvas.width,
                height: this.canvas.height,
                now: performance.now(),
                activeEventKey: devtools.getHoveredEventKey?.() ?? null,
                mouseX: this.mouseX,
                mouseY: this.mouseY
            });
        }

        this.animationId = requestAnimationFrame(this.loop);
    };
}
