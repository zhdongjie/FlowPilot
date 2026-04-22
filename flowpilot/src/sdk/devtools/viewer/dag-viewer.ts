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

    // 🌟🌟 摄像机状态机 🌟🌟
    private displayStepId: string | null = null; // 当前屏幕实际在画的步骤
    private holdUntil: number = 0;               // 锁存时间戳

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
        const now = performance.now();

        // 1. 获取引擎当下的“真实”状态
        const diagnostics = this.devtools.getActiveDiagnostics();
        const realActiveId = diagnostics[0]?.stepId || null;

        // 智能运镜与通关锁存
        if (realActiveId !== this.displayStepId) {
            if (this.displayStepId && this.holdUntil === 0) {
                // 如果发生了切换，获取上一个画面的最终状态
                const oldDiag = this.devtools.getDiagnostic(this.displayStepId);

                // 如果旧画面是“通关（passed: true）”的状态，说明是正常前进
                if (oldDiag?.tree?.passed) {
                    // 强行把旧画面锁存在屏幕上 1000 毫秒，让用户欣赏绿光扩散动画！
                    this.holdUntil = now + 1000;
                } else {
                    // 如果旧画面没通关就被切了（说明用户点击了“⏪回放”或重置），立刻切镜头
                    this.displayStepId = realActiveId;
                }
            } else if (!this.displayStepId) {
                // 初次加载，直接赋值
                this.displayStepId = realActiveId;
            }
        }

        // 检查 1000ms 的锁存期是否结束，结束了就切到新步骤
        if (this.holdUntil > 0 && now >= this.holdUntil) {
            this.displayStepId = realActiveId;
            this.holdUntil = 0;
        }

        // 2. 决定当前到底要画哪棵树
        const targetDiag = this.displayStepId
            ? this.devtools.getDiagnostic(this.displayStepId)
            : null;

        if (targetDiag && targetDiag.tree) {
            const graph = buildGraph(targetDiag.tree, targetDiag.stepId);
            const rect = this.container.getBoundingClientRect();

            const hovered = this.renderer.draw(this.ctx, graph, {
                width: rect.width,
                height: rect.height,
                now: now,
                activeEventKey: this.devtools.getHoveredEventKey(),
                mouseX: this.mouseX,
                mouseY: this.mouseY
            });

            this.canvas.style.cursor = hovered ? 'help' : 'default';
        } else {
            const rect = this.container.getBoundingClientRect();

            if (this.devtools.isFlowFinished()) {
                const finishedGraph: any = {
                    rootId: "flow_finished",
                    nodes: [{
                        id: "flow_finished",
                        label: "🎉 所有流程执行完毕",
                        type: "step", // 借用 step 的圆角矩形外观
                        passed: true,
                        reason: "ALL_DONE"
                    }],
                    edges: []
                };

                const hovered = this.renderer.draw(this.ctx, finishedGraph, {
                    width: rect.width,
                    height: rect.height,
                    now: now,
                    activeEventKey: null,
                    mouseX: this.mouseX,
                    mouseY: this.mouseY
                });
                this.canvas.style.cursor = hovered ? 'help' : 'default';
            } else {
                this.ctx.clearRect(0, 0, rect.width, rect.height);
                this.canvas.style.cursor = 'default';
            }
        }

        this.animationId = requestAnimationFrame(this.loop);
    };
}
